import { BrowserPlugin, ScraperPlugin, SourceType } from "../types";
import { logger } from "../utils/logger";

// Browser plugins
import { FirefoxPlugin } from "./browsers/firefox";
import { ChromePlugin } from "./browsers/chrome";
import { BravePlugin } from "./browsers/brave";

// Scraper plugins
import { RealdiscountScraper } from "./scrapers/realdiscount";
import { CouponscorpionScraper } from "./scrapers/couponscorpion";
import { UdemyxpertScraper } from "./scrapers/udemyxpert";
import { DiscudemyScraper } from "./scrapers/discudemy";

const browsers: Record<string, BrowserPlugin> = {
  firefox: new FirefoxPlugin(),
  chrome: new ChromePlugin(),
  brave: new BravePlugin(),
};

const scrapers: Record<SourceType, ScraperPlugin> = {
  realdiscount: new RealdiscountScraper(),
  couponscorpion: new CouponscorpionScraper(),
  udemyxpert: new UdemyxpertScraper(),
  discudemy: new DiscudemyScraper(),
};

export function getBrowserPlugin(name: string): BrowserPlugin {
  const plugin = browsers[name.toLowerCase()];
  if (!plugin) {
    throw new Error(`Browser plugin not found: ${name}`);
  }
  return plugin;
}

export function getScraperPlugin(name: SourceType): ScraperPlugin {
  const plugin = scrapers[name];
  if (!plugin) {
    throw new Error(`Scraper plugin not found: ${name}`);
  }
  return plugin;
}

export function getScraperPlugins(names: SourceType[]): ScraperPlugin[] {
  return names.map(getScraperPlugin);
}

export function listBrowsers(): string[] {
  return Object.keys(browsers);
}

export function listScrapers(): SourceType[] {
  return Object.keys(scrapers) as SourceType[];
}
