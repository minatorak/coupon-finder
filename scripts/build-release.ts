import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * playwright-core resolves its own package.json and browsers.json with
 * computed requires of absolute build-time paths, which ENOENT on any machine
 * without that exact node_modules. Rewrite them to bundlable literals so the
 * compiled binary is self-contained; restore the originals after the build.
 */
function patchPlaywrightCore(): () => void {
  const rules: { pattern: RegExp; replacement: string }[] = [
    {
      pattern: /require\((?:import_\w+\.default|path)\.join\(packageRoot, "package\.json"\)\)/g,
      replacement: 'require("../package.json")',
    },
    {
      pattern: /require\((?:import_\w+\.default|path)\.join\(packageRoot, "browsers\.json"\)\)/g,
      replacement: 'require("../browsers.json")',
    },
  ];
  const files = [
    "node_modules/playwright-core/lib/package.js",
    "node_modules/playwright-core/lib/coreBundle.js",
  ];
  const backups: { file: string; original: string }[] = [];
  for (const relative of files) {
    const file = resolve(projectRoot, relative);
    const original = readFileSync(file, "utf8");
    let patched = original;
    for (const rule of rules) {
      patched = patched.replace(rule.pattern, rule.replacement);
    }
    if (patched !== original) {
      writeFileSync(file, patched);
      backups.push({ file, original });
    }
  }
  return () => {
    for (const backup of backups) {
      writeFileSync(backup.file, backup.original);
    }
  };
}

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
  // Bundle node_modules into the executable: released binaries run on machines
  // without a node_modules directory beside them, and bun otherwise
  // externalizes playwright and resolves it against the build-time path.
  "--packages=bundle",
  `--outfile=${outputPath}`,
  resolve(projectRoot, "src/cli.ts"),
];

// Native CI runners already have the matching Bun runtime. Reusing it keeps
// the build deterministic and avoids a network download during compilation.
if (nativeTarget === target) {
  command.splice(5, 0, `--compile-executable-path=${process.execPath}`);
}

console.log(`Building ${target} -> ${outputPath}`);
const restorePlaywrightCore = patchPlaywrightCore();
let result: Bun.SpawnSyncResponse;
try {
  result = Bun.spawnSync(command, {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
} finally {
  restorePlaywrightCore();
}

if (!result.success) {
  process.exit(result.exitCode || 1);
}

chmodSync(outputPath, 0o755);
console.log(`Built coupon-finder-${target}`);
