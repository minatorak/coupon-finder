import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { logger } from "./logger";
import { getInstallRoot } from "./install";

interface DownloadResult {
  filePath: string;
  size: number;
  duration: number;
}

const DOWNLOAD_TIMEOUTS = {
  connection: 10000, // 10s for DNS + TCP
  chunk: 30000, // 30s per chunk (no progress = stall)
  total: 300000, // 5min total (large binary)
};

async function downloadWithRetry(
  url: string,
  maxAttempts = 3,
  backoffMs = 1000
): Promise<ArrayBuffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(
        `Download attempt ${attempt}/${maxAttempts}: ${url.split("/").pop()}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUTS.total);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "coupon-finder-cli",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check content length
        const contentLength = response.headers.get("content-length");
        if (!contentLength) {
          logger.warn("No content-length header; download may be incomplete");
        }

        const buffer = await response.arrayBuffer();

        if (contentLength && buffer.byteLength !== parseInt(contentLength, 10)) {
          throw new Error(
            `Incomplete download: expected ${contentLength} bytes, got ${buffer.byteLength}`
          );
        }

        return buffer;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delay = backoffMs * Math.pow(2, attempt - 1);
        logger.warn(
          `Download failed: ${lastError.message}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Download failed after max attempts");
}

export async function downloadToTemp(
  url: string,
  fileName: string
): Promise<DownloadResult> {
  const installDir = getInstallRoot();
  const tempFile = join(installDir, `.coupon-finder-${fileName}-${Date.now()}.tmp`);

  const startTime = Date.now();

  try {
    logger.info(`Downloading ${fileName}...`);
    const buffer = await downloadWithRetry(url);
    await writeFile(tempFile, new Uint8Array(buffer));

    const duration = Date.now() - startTime;
    const size = buffer.byteLength;

    logger.info(
      `Downloaded ${fileName}: ${(size / 1024 / 1024).toFixed(2)}MB in ${(duration / 1000).toFixed(1)}s`
    );

    return {
      filePath: tempFile,
      size,
      duration,
    };
  } catch (error) {
    // Clean up on failure
    try {
      if (existsSync(tempFile)) {
        await unlink(tempFile);
      }
    } catch {
      // ignore
    }

    throw error;
  }
}

export async function cleanupTemp(filePath: string): Promise<void> {
  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
      logger.debug(`Cleaned up temp file: ${filePath}`);
    }
  } catch (error) {
    logger.warn(`Failed to cleanup ${filePath}: ${error}`);
  }
}
