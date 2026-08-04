import { constants } from "fs";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from "fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "path";
import {
  registry as playwrightRegistry,
  utils as playwrightUtils,
} from "playwright-core/lib/coreBundle";
import { logger } from "./logger";

export type ManagedBrowser = "firefox" | "chromium";

export interface ManagedBrowserExecutable {
  browserVersion?: string;
  directory: string;
  downloadURLs: string[];
  executablePath: string;
  title: string;
}

export interface BrowserInstallDependencies {
  download(url: string, destination: string): Promise<void>;
  extract(archivePath: string, destination: string): Promise<void>;
  resolve(browser: ManagedBrowser): ManagedBrowserExecutable;
}

const activeInstalls = new Map<string, Promise<string>>();

async function isExecutable(path: string): Promise<boolean> {
  return access(path, constants.X_OK).then(
    () => true,
    () => false,
  );
}

function resolveManagedExecutable(
  browser: ManagedBrowser,
): ManagedBrowserExecutable {
  const executable = playwrightRegistry.registry.findExecutable(browser);
  const executablePath = executable?.executablePath();
  if (!executable?.directory || !executablePath) {
    throw new Error(`Playwright does not provide ${browser} for this platform.`);
  }

  return {
    browserVersion: executable.browserVersion,
    directory: executable.directory,
    downloadURLs: executable.downloadURLs,
    executablePath,
    title: executable.title ?? browser,
  };
}

async function download(url: string, destination: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) throw new Error("Download response has no body.");

  const totalBytes = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const writer = Bun.file(destination).writer({ highWaterMark: 1024 * 1024 });
  let downloadedBytes = 0;
  let reportedQuarter = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
      downloadedBytes += value.byteLength;

      if (totalBytes > 0) {
        const quarter = Math.floor((downloadedBytes / totalBytes) * 4);
        if (quarter > reportedQuarter && quarter < 4) {
          reportedQuarter = quarter;
          logger.info(`Browser download: ${quarter * 25}%`);
        }
      }
    }
    await writer.end();
  } catch (error) {
    await writer.end(error instanceof Error ? error : undefined);
    throw error;
  }
}

const defaultDependencies: BrowserInstallDependencies = {
  download,
  extract: (archivePath, destination) =>
    playwrightUtils.extractZip(archivePath, { dir: destination }),
  resolve: resolveManagedExecutable,
};

async function installBrowser(
  browser: ManagedBrowser,
  executable: ManagedBrowserExecutable,
  dependencies: BrowserInstallDependencies,
): Promise<string> {
  const relativeExecutable = relative(
    executable.directory,
    executable.executablePath,
  );
  if (isAbsolute(relativeExecutable) || relativeExecutable.startsWith("..")) {
    throw new Error(`Invalid Playwright ${browser} executable path.`);
  }

  const parentDirectory = dirname(executable.directory);
  await mkdir(parentDirectory, { recursive: true });
  const stagingDirectory = await mkdtemp(
    join(parentDirectory, `.${basename(executable.directory)}-`),
  );
  const archivePath = `${stagingDirectory}.zip`;

  try {
    let lastError: unknown;
    for (const url of executable.downloadURLs) {
      try {
        await dependencies.download(url, archivePath);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        await rm(archivePath, { force: true });
      }
    }

    if (lastError || executable.downloadURLs.length === 0) {
      throw new Error(
        `Failed to download ${executable.title}: ${lastError ?? "no download URL available"}`,
      );
    }

    await dependencies.extract(archivePath, stagingDirectory);
    const stagedExecutable = join(stagingDirectory, relativeExecutable);
    if (!(await isExecutable(stagedExecutable))) {
      await chmod(stagedExecutable, 0o755).catch(() => undefined);
    }
    if (!(await isExecutable(stagedExecutable))) {
      throw new Error(
        `Downloaded ${executable.title} is missing its executable.`,
      );
    }

    await writeFile(join(stagingDirectory, "INSTALLATION_COMPLETE"), "");
    await rm(executable.directory, { recursive: true, force: true });
    await rename(stagingDirectory, executable.directory);
    return executable.executablePath;
  } finally {
    await Promise.all([
      rm(archivePath, { force: true }),
      rm(stagingDirectory, { recursive: true, force: true }),
    ]);
  }
}

export async function ensureManagedBrowser(
  browser: ManagedBrowser,
  dependencies: BrowserInstallDependencies = defaultDependencies,
): Promise<string> {
  const executable = dependencies.resolve(browser);
  if (await isExecutable(executable.executablePath)) {
    return executable.executablePath;
  }

  const existingInstall = activeInstalls.get(executable.directory);
  if (existingInstall) return existingInstall;

  const version = executable.browserVersion
    ? ` ${executable.browserVersion}`
    : "";
  logger.info(
    `${executable.title}${version} is not installed; downloading it now...`,
  );

  const install = installBrowser(browser, executable, dependencies).finally(
    () => activeInstalls.delete(executable.directory),
  );
  activeInstalls.set(executable.directory, install);
  const executablePath = await install;
  logger.info(`${executable.title}${version} installed.`);
  return executablePath;
}
