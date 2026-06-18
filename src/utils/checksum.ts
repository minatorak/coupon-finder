import { createReadStream } from "fs";
import { createHash } from "crypto";
import { logger } from "./logger";

export interface ParsedChecksum {
  hash: string;
  filename?: string;
}

export function parseChecksum(checksumText: string): ParsedChecksum {
  const trimmed = checksumText.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length === 0) {
    throw new Error("Empty checksum file");
  }

  const hash = parts[0];

  // Strict validation: exactly 64 hex characters
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error(
      `Invalid SHA256 hash format: expected 64 hex chars, got "${hash}"`
    );
  }

  // Optional: filename (second element)
  const filename = parts.length > 1 ? parts[1] : undefined;

  return {
    hash: hash.toLowerCase(),
    filename,
  };
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
  expectedFileName?: string
): Promise<boolean> {
  try {
    logger.info("Verifying checksum...");

    const parsed = parseChecksum(checksumText);

    // Optional: validate filename if present
    if (parsed.filename && expectedFileName) {
      if (parsed.filename !== expectedFileName) {
        logger.warn(
          `Checksum filename mismatch: expected "${expectedFileName}", got "${parsed.filename}"`
        );
        // Don't fail; some tools add just the filename
      }
    }

    const computed = await computeSHA256(filePath);

    if (computed !== parsed.hash) {
      logger.error(
        `Checksum mismatch: expected ${parsed.hash}, got ${computed}`
      );
      return false;
    }

    logger.info("✓ Checksum verified");
    return true;
  } catch (error) {
    logger.error(
      `Checksum verification failed: ${error instanceof Error ? error.message : error}`
    );
    return false;
  }
}
