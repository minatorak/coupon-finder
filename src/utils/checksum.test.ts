import { describe, expect, test } from "bun:test";
import { parseChecksum } from "./checksum";

const firstHash = "a".repeat(64);
const secondHash = "b".repeat(64);

describe("parseChecksum", () => {
  test("parses a single checksum entry", () => {
    expect(parseChecksum(`${firstHash}  coupon-finder`)).toEqual({
      hash: firstHash,
      filename: "coupon-finder",
    });
  });

  test("selects the requested file from a release manifest", () => {
    const manifest = `${firstHash}  first\n${secondHash}  second\n`;
    expect(parseChecksum(manifest, "second")).toEqual({
      hash: secondHash,
      filename: "second",
    });
  });

  test("rejects a missing file entry", () => {
    expect(() => parseChecksum(`${firstHash}  first`, "second")).toThrow(
      "no entry for second",
    );
  });
});
