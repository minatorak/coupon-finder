import { createReadStream } from "fs";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { unlink, writeFile } from "fs/promises";
import { RELEASE_PUBLIC_KEY } from "./release-key";
import { logger } from "./logger";

export interface ParsedChecksum {
  hash: string;
  filename?: string;
}

function parseChecksumLine(line: string): ParsedChecksum {
  const trimmed = line.trim();
  const hashOnly = trimmed.match(/^([a-fA-F0-9]{64})$/);
  if (hashOnly) return { hash: hashOnly[1].toLowerCase() };

  const withFilename = trimmed.match(/^([a-fA-F0-9]{64})\s+[*]?([^\s]+)$/);
  if (!withFilename) {
    throw new Error(`Invalid checksum entry: "${line}"`);
  }

  return {
    hash: withFilename[1].toLowerCase(),
    filename: withFilename[2],
  };
}

export function parseChecksum(
  checksumText: string,
  expectedFileName?: string,
): ParsedChecksum {
  const lines = checksumText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("Empty checksum file");
  }

  const entries = lines.map(parseChecksumLine);
  if (expectedFileName) {
    const matchingEntry = entries.find(
      (entry) => entry.filename === expectedFileName,
    );
    if (!matchingEntry) {
      throw new Error(
        `Checksum manifest has no entry for ${expectedFileName}`,
      );
    }
    return matchingEntry;
  }

  if (entries.length !== 1) {
    throw new Error("Checksum manifest contains multiple files; expected a filename");
  }
  return entries[0];
}

export async function computeSHA256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (error) => reject(error));
  });
}

export async function verifyChecksum(
  filePath: string,
  checksumText: string,
  expectedFileName?: string,
): Promise<boolean> {
  try {
    logger.info("Verifying checksum...");
    const parsed = parseChecksum(checksumText, expectedFileName);
    const computed = await computeSHA256(filePath);

    if (computed !== parsed.hash) {
      logger.error(
        `Checksum mismatch: expected ${parsed.hash}, got ${computed}`,
      );
      return false;
    }

    logger.info("✓ Checksum verified");
    return true;
  } catch (error) {
    logger.error(
      `Checksum verification failed: ${error instanceof Error ? error.message : error}`,
    );
    return false;
  }
}

export async function verifyManifestSignature(
  manifestPath: string,
  signaturePath: string,
): Promise<boolean> {
  const publicKeyPath = join(
    tmpdir(),
    `coupon-finder-release-public-${process.pid}-${Date.now()}.pem`,
  );

  try {
    await writeFile(publicKeyPath, RELEASE_PUBLIC_KEY, { mode: 0o600 });
    const verifier = Bun.spawn(
      [
        "openssl",
        "dgst",
        "-sha256",
        "-verify",
        publicKeyPath,
        "-signature",
        signaturePath,
        manifestPath,
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
    const exitCode = await verifier.exited;
    if (exitCode !== 0) {
      logger.error("Release checksum signature is invalid");
      return false;
    }
    logger.info("✓ Release checksum signature verified");
    return true;
  } catch (error) {
    logger.error(
      `Signature verification failed: ${error instanceof Error ? error.message : error}`,
    );
    return false;
  } finally {
    try {
      await unlink(publicKeyPath);
    } catch {
      // Ignore cleanup failures in the temporary directory.
    }
  }
}
