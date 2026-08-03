import { describe, expect, test } from "bun:test";
import { FindOptions } from "./find";
import { run } from "./run";

describe("run", () => {
  test("runs find, list, and claim in order", async () => {
    const calls: string[] = [];
    const options: FindOptions = { pages: 2, parallel: 3 };

    await run(options, {
      find: async (receivedOptions) => {
        expect(receivedOptions).toEqual(options);
        calls.push("find");
      },
      list: async () => {
        calls.push("list");
        return true;
      },
      claim: async () => {
        calls.push("claim");
      },
    });

    expect(calls).toEqual(["find", "list", "claim"]);
  });

  test("does not claim when list has no newly checked results", async () => {
    const calls: string[] = [];

    await run({}, {
      find: async () => {
        calls.push("find");
      },
      list: async () => {
        calls.push("list");
        return false;
      },
      claim: async () => {
        calls.push("claim");
      },
    });

    expect(calls).toEqual(["find", "list"]);
  });
});
