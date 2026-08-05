import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";

const directories: string[] = [];
const productionInstaller = resolve(import.meta.dir, "../install.sh");
const platform = process.platform === "darwin" ? `darwin-${process.arch}` : `linux-${process.arch}`;
let assets = "";
let publicKey = "";
let installer = "";

function command(args: string[], cwd?: string) {
  const result = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" });
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
}

beforeAll(() => {
  assets = mkdtempSync(join(tmpdir(), "coupon-finder-assets-"));
  directories.push(assets);
  const packageRoot = join(assets, "stage/coupon-finder");
  mkdirSync(join(packageRoot, "bin"), { recursive: true });
  mkdirSync(join(packageRoot, "lib/node_modules/playwright"), { recursive: true });
  mkdirSync(join(packageRoot, "lib/node_modules/playwright-core/lib"), { recursive: true });
  writeFileSync(join(packageRoot, "RELEASE"), `format=1\nversion=0.2.1\ntarget=${platform}\n`);
  const runtime = join(packageRoot, "bin/coupon-finder-runtime");
  writeFileSync(runtime, '#!/usr/bin/env bash\n[[ "${1:-}" == --release-smoke ]] && exit 0\n[[ "${1:-}" == --version ]] && echo "coupon-finder v0.2.1"\n');
  chmodSync(runtime, 0o755);
  writeFileSync(join(packageRoot, "bin/coupon-finder"), '#!/usr/bin/env bash\nset -e\nroot="$HOME/.local/share/coupon-finder"\nexport COUPON_FINDER_INSTALL_ROOT="$root" NODE_PATH="$root/current/lib/node_modules" PLAYWRIGHT_BROWSERS_PATH="$root/browsers"\nexec "$root/current/bin/coupon-finder-runtime" "$@"\n');
  chmodSync(join(packageRoot, "bin/coupon-finder"), 0o755);
  writeFileSync(join(packageRoot, "lib/node_modules/playwright/package.json"), "{}");
  writeFileSync(join(packageRoot, "lib/node_modules/playwright-core/package.json"), "{}");
  writeFileSync(join(packageRoot, "lib/node_modules/playwright-core/browsers.json"), "{}");
  writeFileSync(join(packageRoot, "lib/node_modules/playwright-core/lib/coreBundle.js"), "");
  const archiveName = `coupon-finder-${platform}.tar.gz`;
  command(["tar", "-czf", join(assets, archiveName), "coupon-finder"], join(assets, "stage"));
  const bytes = Bun.file(join(assets, archiveName)).arrayBuffer();
  return bytes.then((buffer) => {
    const hash = createHash("sha256").update(new Uint8Array(buffer)).digest("hex");
    writeFileSync(join(assets, "checksums.txt"), `${hash}  ${archiveName}\n`);
    const privateKey = join(assets, "private.pem");
    publicKey = join(assets, "public.pem");
    command(["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", privateKey]);
    command(["openssl", "pkey", "-in", privateKey, "-pubout", "-out", publicKey]);
    command(["openssl", "dgst", "-sha256", "-sign", privateKey, "-out", join(assets, "checksums.txt.sig"), join(assets, "checksums.txt")]);
    installer = join(assets, "install.sh");
    const keyText = readFileSync(publicKey, "utf8").trim();
    const source = readFileSync(productionInstaller, "utf8").replace(
      /(cat >"\$\{PUBLIC_KEY\}" <<'PUBLIC_KEY_EOF'\n)[\s\S]*?(\nPUBLIC_KEY_EOF)/,
      `$1${keyText}$2`,
    );
    writeFileSync(installer, source);
  });
});

afterEach(() => {
  for (const directory of directories.splice(1)) rmSync(directory, { recursive: true, force: true });
});

afterAll(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function run(home: string, options: { expectedVersion?: string; assetDirectory?: string } = {}) {
  const child = Bun.spawn(["bash", installer], {
    env: {
      ...process.env,
      HOME: home,
      SHELL: "/bin/zsh",
      COUPON_FINDER_DOWNLOAD_BASE_URL: `file://${options.assetDirectory ?? assets}`,
      COUPON_FINDER_EXPECTED_VERSION: options.expectedVersion ?? "0.2.1",
    },
    stdin: "ignore", stdout: "pipe", stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { exitCode, stdout, stderr };
}

describe("archive installer", () => {
  test("installs immutable layout and refuses to overwrite it", async () => {
    const home = mkdtempSync(join(tmpdir(), "coupon-finder-install-home-"));
    directories.push(home);
    const first = await run(home);
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain("Installation complete");
    const root = join(home, ".local/share/coupon-finder");
    expect(readlinkSync(join(root, "current"))).toMatch(/^releases\/0\.2\.1-/);
    expect(existsSync(join(home, ".local/bin/coupon-finder"))).toBe(true);
    const second = await run(home);
    expect(second.exitCode).toBe(1);
    expect(second.stderr).toContain("coupon-finder update");
    expect(second.stderr).toContain("uninstall.sh");
  });

  test("wrong release metadata leaves no partial install root", async () => {
    const home = mkdtempSync(join(tmpdir(), "coupon-finder-install-home-"));
    directories.push(home);
    const result = await run(home, { expectedVersion: "9.9.9" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Release version mismatch");
    expect(existsSync(join(home, ".local/share/coupon-finder"))).toBe(false);
  });

  test("bad signature does not create install state", async () => {
    const home = mkdtempSync(join(tmpdir(), "coupon-finder-install-home-"));
    const badAssets = mkdtempSync(join(tmpdir(), "coupon-finder-bad-assets-"));
    directories.push(home, badAssets);
    for (const name of [`coupon-finder-${platform}.tar.gz`, "checksums.txt", "checksums.txt.sig"]) {
      writeFileSync(join(badAssets, name), new Uint8Array(await Bun.file(join(assets, name)).arrayBuffer()));
    }
    writeFileSync(join(badAssets, "checksums.txt.sig"), "invalid");
    const result = await run(home, { assetDirectory: badAssets });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("signature is invalid");
    expect(existsSync(join(home, ".local/share/coupon-finder"))).toBe(false);
  });
});
