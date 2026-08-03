import { chmodSync, mkdirSync } from "fs";
import { resolve } from "path";

const TARGETS = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "linux-x64": "bun-linux-x64",
} as const;

type ReleaseTarget = keyof typeof TARGETS;

function usage(): never {
  console.error(
    "Usage: bun run build:release -- --target <darwin-arm64|darwin-x64|linux-x64> [--output-dir <dir>]"
  );
  process.exit(2);
}

function parseArgs(): { target: ReleaseTarget; outputDir: string } {
  let target: string | undefined;
  let outputDir = "dist/release";

  for (let index = 2; index < Bun.argv.length; index++) {
    const argument = Bun.argv[index];
    if (argument === "--target") {
      target = Bun.argv[++index];
    } else if (argument === "--output-dir") {
      outputDir = Bun.argv[++index] ?? usage();
    } else if (argument === "--help" || argument === "-h") {
      usage();
    } else {
      usage();
    }
  }

  const defaultTarget = target ?? getNativeTarget();
  if (!defaultTarget || !(defaultTarget in TARGETS)) {
    usage();
  }

  return { target: defaultTarget as ReleaseTarget, outputDir };
}

function getNativeTarget(): ReleaseTarget | undefined {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  if (platform === "linux" && arch === "x64") return "linux-x64";
  return undefined;
}

const { target, outputDir } = parseArgs();
const projectRoot = resolve(import.meta.dir, "..");
const outputPath = resolve(projectRoot, outputDir, `coupon-finder-${target}`);
const nativeTarget = getNativeTarget();

mkdirSync(resolve(projectRoot, outputDir), { recursive: true });

const command = [
  process.execPath,
  "build",
  "--compile",
  `--target=${TARGETS[target]}`,
  "--external=electron",
  `--outfile=${outputPath}`,
  resolve(projectRoot, "src/cli.ts"),
];

// Native CI runners already have the matching Bun runtime. Reusing it keeps
// the build deterministic and avoids a network download during compilation.
if (nativeTarget === target) {
  command.splice(5, 0, `--compile-executable-path=${process.execPath}`);
}

console.log(`Building ${target} -> ${outputPath}`);
const result = Bun.spawnSync(command, {
  cwd: projectRoot,
  stdout: "inherit",
  stderr: "inherit",
});

if (!result.success) {
  process.exit(result.exitCode || 1);
}

chmodSync(outputPath, 0o755);
console.log(`Built coupon-finder-${target}`);
