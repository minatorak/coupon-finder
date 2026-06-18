import { logger } from "./logger";

export type SupportedPlatform = "darwin-x64" | "darwin-arm64" | "linux-x64";

export function getPlatformArch(): SupportedPlatform {
  const platform = process.platform;
  const arch = process.arch;

  // Normalize platform/arch to supported format
  if (platform === "darwin") {
    if (arch === "x64") {
      return "darwin-x64";
    } else if (arch === "arm64") {
      return "darwin-arm64";
    }
  } else if (platform === "linux") {
    if (arch === "x64") {
      return "linux-x64";
    }
  }

  // Unsupported
  throw new Error(
    `Unsupported platform: ${platform}-${arch}. Reinstall from source.`
  );
}

export function validatePlatform(): SupportedPlatform {
  try {
    return getPlatformArch();
  } catch (error) {
    logger.error(`Platform check failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
