import "dotenv/config";
import "./databases.js";

import eds from "@eds-fw/framework";
import { registerFont } from "canvas";
import { botConfig } from "./bot_config.js";
import { resources } from "./corelib.js";
import initEventListeners from "./events.js";

registerFont("./assets/Abibas.ttf", {
  family: "abibas",
});

botConfig.colors!.default = resources.colors.gray;
botConfig.colors!.info = resources.colors.default;
botConfig.colors!.error = resources.colors.error;

const bot = eds.createBot(botConfig);
initEventListeners(bot);
eds.startBot();
