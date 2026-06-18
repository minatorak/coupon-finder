import { homedir } from "os";
import { join } from "path";

const HOME = homedir();
export const COUPON_FINDER_DIR = join(HOME, ".coupon-finder");
export const CONFIG_FILE = join(COUPON_FINDER_DIR, "config.json");
export const RESULTS_DIR = join(COUPON_FINDER_DIR, "results");
export const LOG_FILE = join(RESULTS_DIR, "coupon-finder.log");
