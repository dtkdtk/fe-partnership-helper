import { eds } from "@eds-fw/framework";
import { checkPermission, ConfigEnv, DgPermissions, noAccess } from "../corelib.js";
import { BotCache } from "../databases.js";


export default {
  async run(ctx) {
    if (!checkPermission(ctx.member, DgPermissions.admin))
      return noAccess(ctx);
    const memUsageShot = process.memoryUsage();
    const memUsageMB = Math.round(memUsageShot.rss / 1024**2);
    const ccSizeKB = Math.round(
      (BotCache.stats.ksize + BotCache.stats.vsize) / 1024
    );
    const startedAt = BotCache.get("bot_startedAt") as number | null;
    const uptimeStr = typeof startedAt === "number"
      ? `<t:${Math.floor(startedAt / 1000)}:R>` : "???";
    ctx
      .reply(
`ОЗУ: \`${memUsageMB}\` МБ.
Кэш бота (\`BotCache\`): ${BotCache.stats.keys}, примерно на ${ccSizeKB} КБ.
Кэши менеджеров DiscordJS:
> \`client.guilds\`: ${ctx.client.guilds.cache.size}
> \`client.users\`: ${ctx.client.users.cache.size}
> \`guild.members\`: ${ctx.guild?.members.cache.size}
> \`guild.roles\`: ${ctx.guild?.roles.cache.size}
> \`guild.channels\`: ${ctx.guild?.channels.cache.size}
> \`channel.messages\`: ${ctx.channel.messages.cache.size}
Аптайм (время запуска): ${uptimeStr}
Версия бота: \`${ConfigEnv.BotVersion}\`
Режим отладки? \`${ConfigEnv.ENABLE_DEBUG}\`
`
      )
      .catch(console.error);
  },

  info: {
    name: "sysinfo",
    hidden: true,
    type: "text",
  },
} satisfies eds.CommandFile<"text">;
