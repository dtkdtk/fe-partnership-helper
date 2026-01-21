import eds from "@eds-fw/framework";
import { onPartnershipDelete } from "./commands/partnerships/services/handle_delete.js";
import { _ErrorActionFn, _initErrorAction, ConfigEnv, MSK } from "./corelib.js";
import { createSlashCommands } from "./slashCommands.js";


export default function initEventListeners(bot: eds.KnownRuntimeProperties) {
  const handleError: _ErrorActionFn = async (E, kind) => {
    console.error((kind == "critical" ? "(КРИТИЧЕСКИ) " : "") + "Ошибка:", E);
    await eds.wait(1_000);
    const guild = await eds.sfGuild(bot.client.guilds, ConfigEnv.GUILD_ID);
    if (!guild) return;
    const channel = (await eds.sfChannel(
      guild.channels,
      ConfigEnv.BOT_SYSTEM_CHANNEL_ID
    ));
    if (!channel?.isTextBased()) return;
    switch (kind) {
      case "moderate":
        channel.send(
          `⚠ Ошибка: \`${E.message}\``
        ).catch(console.error);
        break;
      case "unexpected":
        channel.send(
          `⚠ Бот схватил ошибку! Такого быть не должно. Продублирую её и в консоль. \`\`\`js\n${E.message}\n\nStack:\n${E.stack}\`\`\`\n\n❗❗❗ **Пожалуйста, сообщите разработчику оригинального бота об этой неисправности. Discord: \`@dtkdtk0\`**`
        ).catch(console.error);
        break;
      case "critical":
        channel.send(
          `⚠ Бот КРАШНУЛСЯ из-за ошибки! Такого быть не должно. Продублирую ошибку в консоль. \`\`\`js\n${E.message}\n\nStack:\n${E.stack}\`\`\`\n\n❗❗❗ **Пожалуйста, сообщите разработчику оригинального бота об этой неисправности. Discord: \`@dtkdtk0\`**`
        ).catch(console.error);
        break;
    }
  }

  bot.client.rest.on("rateLimited", async (E) => {
    if (E.global) 
      console.error(
        "(КРИТИЧЕСКИ) БОТ ДОСТИГ РЕЙТ-ЛИМИТА DISCORD И БЫЛ ПРИОСТАНОВЛЕН ДО %s\nЗапрос: %s",
        MSK().add(E.retryAfter, "ms").format("DD MMMM, HH:mm"),
        E.method
      );
    else if (ConfigEnv.ENABLE_DEBUG)
      console.error(
        "(Ничего страшного) Не удалось выполнить запрос к Discord. Попробую ещё раз.\nЗапрос: %s %s",
        E.method,
        E.url
      );
  });

  bot.client.on("error", async (E) => handleError(E, "unexpected"));

  _initErrorAction(handleError);

  bot.client.on("messageDelete", async (message) => {
    if (!message.inGuild() || message.guildId != ConfigEnv.GUILD_ID) return;
    onPartnershipDelete(message);
  });

  bot.client.once("clientReady", async () => {
    createSlashCommands(eds.runtimeStorage);
    console.log("Делай со мной всё, что хочешь - я готов ко всему.");
    const guild = await eds.sfGuild(bot.client.guilds, ConfigEnv.GUILD_ID);
    const sysChannel = await eds.sfChannel(
      guild?.channels,
      ConfigEnv.BOT_SYSTEM_CHANNEL_ID
    );
    if (sysChannel?.isTextBased())
      sysChannel.send(`Добрый вечер, я диспетчер!`).catch(console.error);
    scanPartnershipChannel(bot.client);
  });
}

import * as _errs from "@eds-fw/framework/dist/errors.js";
import { scanPartnershipChannel } from "./commands/partnerships/services/scan.js";
_errs.Loader.templateLoadCommandSkipped = () => {};
