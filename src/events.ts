import { onPartnershipDelete, performPartnershipsScan } from "#core_functional";
import { _ErrorActionFn, _initErrorAction, BotCache, ConfigEnv, CoreLog, MSK } from "#corelib";
import eds from "@eds-fw/framework";
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
        ).catch(() => CoreLog.missingPermission("SEND_MESSAGES", { channelId: channel.id }));
        break;
      case "unexpected":
        channel.send(
          `⚠ Бот схватил ошибку! Такого быть не должно. Продублирую её и в консоль. \`\`\`js\n${E.message}\n\nStack:\n${E.stack}\`\`\`\n\n❗❗❗ **Пожалуйста, сообщите разработчику оригинального бота об этой неисправности. Discord: \`@dtkdtk0\`**`
        ).catch(() => CoreLog.missingPermission("SEND_MESSAGES", { channelId: channel.id }));
        break;
      case "critical":
        channel.send(
          `⚠ Бот КРАШНУЛСЯ из-за ошибки! Такого быть не должно. Продублирую ошибку в консоль. \`\`\`js\n${E.message}\n\nStack:\n${E.stack}\`\`\`\n\n❗❗❗ **Пожалуйста, сообщите разработчику оригинального бота об этой неисправности. Discord: \`@dtkdtk0\`**`
        ).catch(() => CoreLog.missingPermission("SEND_MESSAGES", { channelId: channel.id }));
        break;
    }
  }

  bot.client.rest.on("rateLimited", async (E) => {
    if (E.global)
      CoreLog.rateLimitGlobal(E);
    else
      CoreLog.rateLimitLocal(E);
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
    CoreLog.ready();
    console.log("Делай со мной всё, что хочешь - я готов ко всему.");
    createSlashCommands(eds.runtimeStorage);
    if (BotCache.get("bot_firstStart") === true) {
      CoreLog.firstStart();
    }
    const guild = await eds.sfGuild(bot.client.guilds, ConfigEnv.GUILD_ID);
    const sysChannel = await eds.sfChannel(
      guild?.channels,
      ConfigEnv.BOT_SYSTEM_CHANNEL_ID
    );
    if (sysChannel?.isTextBased())
      sysChannel.send(`Добрый вечер, я диспетчер!`).catch(console.error);
    performPartnershipsScan(bot.client);
  });
}

import * as _errs from "@eds-fw/framework/dist/errors.js";
_errs.Loader.templateLoadCommandSkipped = () => {};
