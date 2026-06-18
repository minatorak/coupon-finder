export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

let currentLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function log(level: LogLevel, message: string, ...args: any[]) {
  if (level < currentLevel) return;

  const prefix =
    {
      [LogLevel.DEBUG]: "🔧",
      [LogLevel.INFO]: "ℹ️ ",
      [LogLevel.WARN]: "⚠️ ",
      [LogLevel.ERROR]: "❌",
    }[level] || "";

  console.log(prefix, message, ...args);
}

export const logger = {
  debug: (msg: string, ...args: any[]) => log(LogLevel.DEBUG, msg, ...args),
  info: (msg: string, ...args: any[]) => log(LogLevel.INFO, msg, ...args),
  warn: (msg: string, ...args: any[]) => log(LogLevel.WARN, msg, ...args),
  error: (msg: string, ...args: any[]) => log(LogLevel.ERROR, msg, ...args),
};
