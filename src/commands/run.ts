import { FindOptions, find } from "./find";
import { list } from "./list";
import { claim } from "./claim";
import { logger } from "../utils/logger";

interface RunDependencies {
  find: (options: FindOptions) => Promise<void>;
  list: () => Promise<boolean>;
  claim: () => Promise<void>;
}

const defaultDependencies: RunDependencies = { find, list, claim };

export async function run(
  options: FindOptions = {},
  dependencies: RunDependencies = defaultDependencies,
): Promise<void> {
  logger.info("Starting workflow: find → list → claim");
  await dependencies.find(options);

  const hasCheckedResults = await dependencies.list();
  if (!hasCheckedResults) {
    logger.info("Workflow stopped: no newly checked courses to claim.");
    return;
  }

  await dependencies.claim();
  logger.info("Workflow complete.");
}
