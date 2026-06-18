import { spawnSync } from "child_process";
import { logger } from "./logger";

const BATCH_SIZE = 10;

function getOpenCommand(): string {
  const platform = process.platform;
  switch (platform) {
    case "darwin":
      return "open";
    case "linux":
      return "xdg-open";
    case "win32":
      return "start";
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function getUserInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim());
    });
  });
}

export async function openUrlsInBatches(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    logger.warn("No URLs to open");
    return;
  }

  const openCmd = getOpenCommand();
  logger.info(`Opening ${urls.length} course URLs (${BATCH_SIZE} at a time)...`);
  console.log();

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(urls.length / BATCH_SIZE);

    console.log(`📱 Batch ${batchNum}/${totalBatches} (${batch.length} URLs)`);

    for (const url of batch) {
      try {
        spawnSync(openCmd, [url], { stdio: "ignore" });
        console.log(`  ✓ ${url}`);
      } catch (error) {
        logger.error(`Failed to open URL: ${url}`);
      }
    }

    if (i + BATCH_SIZE < urls.length) {
      console.log();
      await getUserInput(
        `Press Enter to open next batch (${BATCH_SIZE} URLs)...`
      );
      console.log();
    }
  }

  console.log("✅ All URLs opened!");
  console.log();
}
