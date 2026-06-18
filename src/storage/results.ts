import { writeFile, readFile, mkdir } from "fs/promises";
import { RESULTS_DIR } from "../utils/paths";
import { Course } from "../types";
import { logger } from "../utils/logger";

export async function saveResults(
  courses: Course[],
  suffix: string
): Promise<string> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "");
  const filename = `${timestamp}_${suffix}.json`;
  const filepath = `${RESULTS_DIR}/${filename}`;

  await writeFile(filepath, JSON.stringify(courses, null, 2));
  logger.info(`Saved ${courses.length} courses to ${filename}`);

  return filepath;
}

export async function loadResults(filename: string): Promise<Course[]> {
  const filepath = `${RESULTS_DIR}/${filename}`;

  try {
    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    logger.error(`Failed to load results: ${error}`);
    return [];
  }
}

export async function getLatestResults(suffix: string): Promise<Course[]> {
  // For now, return empty - Phase 5 will implement proper file listing
  return [];
}
