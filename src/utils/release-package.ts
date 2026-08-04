import { readFileSync } from "fs";

export const RELEASE_FORMAT = "1";

export interface ReleaseMetadata {
  format: string;
  version: string;
  target: string;
}

export function createLauncherScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
INSTALL_ROOT="\${HOME}/.local/share/coupon-finder"
export COUPON_FINDER_INSTALL_ROOT="\${INSTALL_ROOT}"
export NODE_PATH="\${INSTALL_ROOT}/current/lib/node_modules"
export PLAYWRIGHT_BROWSERS_PATH="\${INSTALL_ROOT}/browsers"
exec "\${INSTALL_ROOT}/current/bin/coupon-finder-runtime" "$@"
`;
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const TARGET = /^(?:darwin-arm64|darwin-x64|linux-x64)$/;

export function parseReleaseMetadata(content: string): ReleaseMetadata {
  const values = new Map<string, string>();
  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine) continue;
    const match = rawLine.match(/^([a-z]+)=([^\s=]+)$/);
    if (!match || values.has(match[1])) {
      throw new Error("Malformed RELEASE metadata.");
    }
    values.set(match[1], match[2]);
  }

  if (values.size !== 3) throw new Error("Malformed RELEASE metadata.");
  const format = values.get("format");
  const version = values.get("version");
  const target = values.get("target");
  if (!format || !version || !target) throw new Error("Malformed RELEASE metadata.");
  if (format !== RELEASE_FORMAT) throw new Error(`Unsupported release format: ${format}`);
  if (!SEMVER.test(version)) throw new Error(`Invalid release version: ${version}`);
  if (!TARGET.test(target)) throw new Error(`Unsupported release target: ${target}`);
  return { format, version, target };
}

export function readReleaseMetadata(path: string): ReleaseMetadata {
  return parseReleaseMetadata(readFileSync(path, "utf8"));
}

export function validateReleaseMetadata(
  metadata: ReleaseMetadata,
  expectedVersion: string,
  expectedTarget: string,
): void {
  if (metadata.version !== expectedVersion) {
    throw new Error(`Release version mismatch: expected ${expectedVersion}, got ${metadata.version}`);
  }
  if (metadata.target !== expectedTarget) {
    throw new Error(`Release target mismatch: expected ${expectedTarget}, got ${metadata.target}`);
  }
}

export function validateTarEntryPath(entry: string): void {
  const normalized = entry.replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\\")) {
    throw new Error(`Unsafe archive entry: ${entry}`);
  }
  const parts = normalized.split("/");
  if (parts[0] !== "coupon-finder" || parts.some((part) => part === ".." || part === "." || !part)) {
    throw new Error(`Unsafe archive entry: ${entry}`);
  }
}

export function validateTarEntries(entries: string[]): void {
  if (entries.length === 0) throw new Error("Release archive is empty.");
  for (const entry of entries) validateTarEntryPath(entry);
}
