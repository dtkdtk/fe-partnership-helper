import "dotenv/config";
import "./databases.js";

import eds from "@eds-fw/framework";
import { registerFont } from "canvas";
import { botConfig } from "./bot_config.js";
import { CoreLog, resources } from "./corelib.js";
import initEventListeners from "./events.js";

process.on("unhandledRejection", (err) =>
  CoreLog.unexpectedError({ err, type: "unhandled rejection" }),
);
process.on("uncaughtException", (err) =>
  CoreLog.unexpectedError({ err, type: "uncaught exception" }),
);

CoreLog.startup();
registerFont("./assets/Abibas.ttf", {
  family: "abibas",
});

botConfig.colors!.default = resources.colors.gray;
botConfig.colors!.info = resources.colors.default;
botConfig.colors!.error = resources.colors.error;

const bot = eds.createBot(botConfig);
initEventListeners(bot);
eds.startBot();
