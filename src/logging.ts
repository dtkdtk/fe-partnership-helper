import fs from 'fs';
import path from 'path';
import pino from "pino";
import { ConfigEnv } from "corelib";
const LOGS_DIR = "./logs";
const LOGS_LIFE_DURATION = ConfigEnv.LOGS_LIFE_DURATION


export const logger = pino({
  level: ConfigEnv.LOG_LEVEL,
  formatters: {
    bindings(_) { return {} },
  },
  base: {
    pid: false,
    hostname: false,
  },
  transport: {
    targets: [{
      target: "pino-rotate",
      options: {
        file: "./logs/%YYYY-MM-DD%.log",
        limit: "14d",
        json: true,
      },
    }]
  },
});

export namespace CoreLog {
  export function startup() {
    logger.info("Startup");
  }
  export function ready() {
    logger.info("Ready to work");
  }
  export function firstStart() {
    logger.info("This is a first bot's startup. Hello, World!");
  }
  export function rateLimitLocal(limitOptions: object) {
    logger.trace(limitOptions, "Bot is locally rate-limited");
  }
  export function rateLimitGlobal(limitOptions: object) {
    logger.error(limitOptions, "Bot is GLOBALLY rate-limited");
  }
  export function missingPermission(
    action: "SEND_MESSAGES" | "MANAGE_MESSAGES",
    context: { channelId?: string }
  ) {
    logger.error(context, `Cannot ${action} (no permission); please grant the permission`);
  }
  export function unexpectedError(error: object) {
    logger.error(error, "An unexpected error occurred");
  }
}

function cleanOldLogs() {
  let files;
  try { files = fs.readdirSync(LOGS_DIR) }
  catch (E) { return }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOGS_LIFE_DURATION);
  
  files.forEach(file => {
    const match = file.match(/^(\d{4})-(\d{2})-(\d{2})\.log$/);
    if (!match) return;

    const fileDate = new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3])
    );

    if (fileDate < cutoff) {
      fs.rm(path.join(LOGS_DIR, file), (err) => {
        logger.error({ errorObject: err, file }, "Cannot remove old .log file!");
      });
      logger.trace({ file }, "Remove old .log file");
    }
  });
}

setInterval(() => cleanOldLogs(), 24 * 60 * 60 * 1000); //каждый день
