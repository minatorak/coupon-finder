import { resolve } from "path";

const projectRoot = resolve(import.meta.dir, "..");
const packageJson = (await Bun.file(resolve(projectRoot, "package.json")).json()) as {
  version?: unknown;
};
const sourceVersion = await Bun.file(resolve(projectRoot, "src/version.ts")).text();
const sourceMatch = sourceVersion.match(/VERSION\s*=\s*["']([^"']+)["']/);
const expectedTag = process.env.EXPECTED_TAG ?? Bun.argv[2];

const packageVersion = packageJson.version;
if (typeof packageVersion !== "string") {
  throw new Error("package.json is missing a string version");
}

if (!sourceMatch) {
  throw new Error("src/version.ts is missing a VERSION constant");
}

const versions = new Map([
  ["package.json", packageVersion],
  ["src/version.ts", sourceMatch[1]],
]);

if (new Set(versions.values()).size !== 1) {
  throw new Error(
    `Version mismatch: ${[...versions.entries()]
      .map(([file, version]) => `${file}=${version}`)
      .join(", ")}`
  );
}

if (expectedTag !== undefined) {
  if (!/^v\d+\.\d+\.\d+$/.test(expectedTag)) {
    throw new Error(`Invalid release tag: ${expectedTag}. Expected vX.Y.Z`);
  }

  if (expectedTag.slice(1) !== packageVersion) {
    throw new Error(
      `Release tag ${expectedTag} does not match application version ${packageVersion}`
    );
  }
}

console.log(`Version OK: ${packageVersion}${expectedTag ? ` (${expectedTag})` : ""}`);
