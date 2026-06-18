import { logger } from "./logger";

export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  timeoutMs = 5000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeoutMs)
        ),
      ]);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxAttempts) {
        logger.debug(`Attempt ${i}/${maxAttempts} failed, retrying...`);
      }
    }
  }

  throw lastError || new Error("Max attempts reached");
}
