import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";

const homes: string[] = [];
const script = resolve(import.meta.dir, "../uninstall.sh");

function home(): string {
  const value = mkdtempSync(join(tmpdir(), "coupon-finder-uninstall-"));
  homes.push(value);
  return value;
}

async function run(testHome: string, args: string[] = []) {
  const child = Bun.spawn(["bash", script, ...args], {
    env: { ...process.env, HOME: testHome },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

afterEach(() => {
  for (const directory of homes.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("clean uninstall", () => {
  test("requires --yes without a TTY", async () => {
    const result = await run(home());
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--yes");
  });

  test("removes managed state but preserves custom results and user shell content", async () => {
    const testHome = home();
    const bin = join(testHome, ".local/bin");
    const root = join(testHome, ".local/share/coupon-finder");
    const data = join(testHome, ".coupon-finder");
    const external = join(testHome, "my-results");
    mkdirSync(bin, { recursive: true });
    mkdirSync(join(root, "browsers"), { recursive: true });
    mkdirSync(data, { recursive: true });
    mkdirSync(external);
    writeFileSync(join(bin, "coupon-finder"), "legacy");
    writeFileSync(join(bin, ".coupon-finder.backup-1.bak"), "backup");
    writeFileSync(join(data, "config.toml"), `resultsDir = ${JSON.stringify(external)}\n`);
    writeFileSync(join(testHome, ".zshrc"), "before\n# >>> coupon-finder PATH >>>\nmanaged\n# <<< coupon-finder PATH <<<\nafter\n");

    const result = await run(testHome, ["--yes"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain(external);
    expect(existsSync(external)).toBe(true);
    expect(existsSync(root)).toBe(false);
    expect(existsSync(data)).toBe(false);
    expect(existsSync(join(bin, "coupon-finder"))).toBe(false);
    expect(existsSync(join(bin, ".coupon-finder.backup-1.bak"))).toBe(false);
    expect(readFileSync(join(testHome, ".zshrc"), "utf8")).toBe("before\nafter\n");

    const repeated = await run(testHome, ["--yes"]);
    expect(repeated.exitCode).toBe(0);
  });

  test("rejects unknown options", async () => {
    const result = await run(home(), ["--force"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown option");
  });
});
