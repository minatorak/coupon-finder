import { resolve } from "path";

const projectRoot = resolve(import.meta.dir, "..");
const keyFile = (await Bun.file(resolve(projectRoot, "keys/release-public.pem")).text()).trim();
const sourceFile = await Bun.file(resolve(projectRoot, "src/utils/release-key.ts")).text();
const installerFile = await Bun.file(resolve(projectRoot, "install.sh")).text();
const sourceKey = sourceFile.match(/`([\s\S]*?)`/)?.[1]?.trim();
const installerKey = installerFile.match(
  /cat >"\$\{PUBLIC_KEY\}" <<'PUBLIC_KEY_EOF'\n([\s\S]*?)\nPUBLIC_KEY_EOF/,
)?.[1]?.trim();

if (!sourceKey || !installerKey) {
  throw new Error("Could not extract the embedded release key");
}

if (sourceKey !== keyFile || installerKey !== keyFile) {
  throw new Error("Release public key is out of sync between source, installer, and keys/");
}

console.log("Release public key OK");
