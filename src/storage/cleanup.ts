import { readdir, unlink, stat } from "fs/promises";
import { RESULTS_DIR } from "../utils/paths";
import { logger } from "../utils/logger";

export async function cleanupOldResults(maxAgeMs = 3 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const files = await readdir(RESULTS_DIR);
    const now = Date.now();
    let deleted = 0;

    for (const file of files) {
      const filepath = `${RESULTS_DIR}/${file}`;
      const stats = await stat(filepath);
      const age = now - stats.mtime.getTime();

      if (age > maxAgeMs) {
        await unlink(filepath);
        deleted++;
        logger.debug(`Deleted old file: ${file}`);
      }
    }

    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old result files`);
    }
  } catch (error) {
    logger.warn(`Failed to cleanup old results: ${error}`);
  }
}
