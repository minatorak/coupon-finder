import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { VERSION } from "../src/version";
import { createLauncherScript } from "../src/utils/release-package";

const TARGETS = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "linux-x64": "bun-linux-x64",
} as const;
type ReleaseTarget = keyof typeof TARGETS;

function usage(): never {
  console.error("Usage: bun run build:release -- --target <darwin-arm64|darwin-x64|linux-x64> [--output-dir <dir>]");
  process.exit(2);
}

function nativeTarget(): ReleaseTarget | undefined {
  if (process.platform === "darwin" && process.arch === "arm64") return "darwin-arm64";
  if (process.platform === "darwin" && process.arch === "x64") return "darwin-x64";
  if (process.platform === "linux" && process.arch === "x64") return "linux-x64";
}

function parseArgs(): { target: ReleaseTarget; outputDir: string } {
  let target: string | undefined;
  let outputDir = "dist/release";
  for (let index = 2; index < Bun.argv.length; index++) {
    const argument = Bun.argv[index];
    if (argument === "--target") target = Bun.argv[++index];
    else if (argument === "--output-dir") outputDir = Bun.argv[++index] ?? usage();
    else usage();
  }
  target ??= nativeTarget();
  if (!target || !(target in TARGETS)) usage();
  return { target: target as ReleaseTarget, outputDir };
}

function run(command: string[], cwd: string): void {
  const result = Bun.spawnSync(command, { cwd, stdout: "inherit", stderr: "inherit" });
  if (!result.success) process.exit(result.exitCode || 1);
}

const { target, outputDir } = parseArgs();
const projectRoot = resolve(import.meta.dir, "..");
const packageVersion = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8")).version;
if (packageVersion !== VERSION) throw new Error(`Version mismatch: package.json=${packageVersion}, src/version.ts=${VERSION}`);

const absoluteOutputDir = resolve(projectRoot, outputDir);
const stagingRoot = resolve(absoluteOutputDir, `.stage-${target}`);
const packageRoot = resolve(stagingRoot, "coupon-finder");
const runtime = resolve(packageRoot, "bin/coupon-finder-runtime");
const archive = resolve(absoluteOutputDir, `coupon-finder-${target}.tar.gz`);
rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(resolve(packageRoot, "bin"), { recursive: true });
mkdirSync(resolve(packageRoot, "lib/node_modules"), { recursive: true });

const buildCommand = [
  process.execPath, "build", "--compile", `--target=${TARGETS[target]}`,
  "--external=electron", "--external=playwright", "--external=playwright/*",
  "--external=playwright-core", "--external=playwright-core/*", "--external=chromium-bidi/*",
  `--outfile=${runtime}`, resolve(projectRoot, "src/cli.ts"),
];
if (nativeTarget() === target) buildCommand.splice(5, 0, `--compile-executable-path=${process.execPath}`);
console.log(`Building release archive for ${target}`);
run(buildCommand, projectRoot);
chmodSync(runtime, 0o755);

for (const dependency of ["playwright", "playwright-core"]) {
  const source = resolve(projectRoot, "node_modules", dependency);
  if (!existsSync(resolve(source, "package.json"))) throw new Error(`Locked dependency is missing: ${dependency}`);
  cpSync(source, resolve(packageRoot, "lib/node_modules", dependency), {
    recursive: true,
    dereference: true,
    verbatimSymlinks: false,
  });
}

writeFileSync(resolve(packageRoot, "bin/coupon-finder"), createLauncherScript(), { mode: 0o755 });
writeFileSync(resolve(packageRoot, "RELEASE"), `format=1\nversion=${VERSION}\ntarget=${target}\n`);

const required = [
  runtime,
  resolve(packageRoot, "bin/coupon-finder"),
  resolve(packageRoot, "RELEASE"),
  resolve(packageRoot, "lib/node_modules/playwright/package.json"),
  resolve(packageRoot, "lib/node_modules/playwright-core/package.json"),
  resolve(packageRoot, "lib/node_modules/playwright-core/browsers.json"),
  resolve(packageRoot, "lib/node_modules/playwright-core/lib/coreBundle.js"),
];
for (const path of required) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Release package is missing ${path}`);
}

rmSync(archive, { force: true });
run(["tar", "-czf", archive, "coupon-finder"], stagingRoot);
rmSync(stagingRoot, { recursive: true, force: true });
console.log(`Built ${basename(archive)}`);
