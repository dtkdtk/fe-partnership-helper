import { eds } from "@eds-fw/framework";
import {
  checkPermission,
  ConfigEnv,
  DgPermissions,
  noAccess,
} from "../corelib.js";
import { BotCache, DB_DelegationStats, DB_Misc } from "../databases.js";
import {
  getDelegateStats,
  initDelegateStats
} from "./partnerships/models/delegate_stats.js";
import {
  pauseGeneralScan,
  resumeGeneralScan,
  runGeneralScan,
} from "./partnerships/services/general_scan.js";

async function scmGeneralScan(ctx: eds.TextContext) {
  const action = ctx.args[1]?.toLowerCase();
  switch (action) {
    case "stop":
      pauseGeneralScan();
      await ctx.reply("Процесс General Scan остановлен").catch(console.error);
      break;

    case "start":
      resumeGeneralScan();
      runGeneralScan(ctx.client).catch(console.error);
      await ctx.reply("Процесс General Scan запущен").catch(console.error);
      break;
    default:
      await ctx
        .reply("Неправильное использование. См. `system help`")
        .catch(console.error);
  }
}

async function scmPartnerships(ctx: eds.TextContext) {
  const action = ctx.args[1]?.toLowerCase();
  switch (action) {
    case "add-nototal": {
      const userId = ctx.args[2];
      const amount = parseInt(ctx.args[3]);
      if (!userId || isNaN(amount)) {
        await ctx
          .reply("Неправильное использование. См. `system help`")
          .catch(console.error);
        return;
      }
      const dgStats =
        (await getDelegateStats(userId)) ?? (await initDelegateStats(userId));
      if (!dgStats) {
        await ctx
          .reply("Ошибка при регистрации статистики")
          .catch(console.error);
        return;
      }
      dgStats.total_partnerships += amount;
      await DB_DelegationStats.updateAsync({ _id: userId }, dgStats);

      const miscDbData = await DB_Misc.findOneAsync({ _id: "1" });
      miscDbData.no_total_delegates.push(userId);
      await DB_Misc.updateAsync({ _id: "1" }, miscDbData);

      await ctx
        .reply(
          `✅ Добавлено **${amount}** партнёрств в общую статистику делегата.` +
            `\nДелегат также внесён в список \`no_total_delegates\` (не собирать старые данные о кол-ве партнёрств).`,
        )
        .catch(console.error);
      break;
    }

    case "add": {
      const userId = ctx.args[2];
      const amount = parseInt(ctx.args[3]);
      if (!userId || isNaN(amount)) {
        await ctx
          .reply("Неправильное использование. См. `system help`")
          .catch(console.error);
        return;
      }
      const dgStats =
        (await getDelegateStats(userId)) ?? (await initDelegateStats(userId));
      if (!dgStats) {
        await ctx
          .reply("Ошибка при регистрации статистики")
          .catch(console.error);
        return;
      }
      dgStats.total_partnerships += amount;
      await DB_DelegationStats.updateAsync({ _id: userId }, dgStats);

      await ctx
        .reply(
          `✅ Добавлено **${amount}** партнёрств в общую статистику пользователя.`,
        )
        .catch(console.error);
      break;
    }

    default:
      await ctx
        .reply("Неправильное использование. См. `system help`")
        .catch(console.error);
  }
}

export default {
  async run(ctx) {
    if (!checkPermission(ctx.member, DgPermissions.admin)) return noAccess(ctx);

    const subcommand = ctx.args[0]?.toLowerCase();

    switch (subcommand) {
      case "genscan":
        return await scmGeneralScan(ctx);

      case "partnerships":
        return await scmPartnerships(ctx);

      case "stats": {
        const memUsageShot = process.memoryUsage();
        const memUsageMB = Math.round(memUsageShot.rss / 1024 ** 2);
        const ccSizeKB = Math.round(
          (BotCache.stats.ksize + BotCache.stats.vsize) / 1024,
        );
        const startedAt = BotCache.get("bot_startedAt") as number | null;
        const uptimeStr =
          typeof startedAt === "number"
            ? `<t:${Math.floor(startedAt / 1000)}:R>`
            : "???";
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
`,
          )
          .catch(console.error);
        break;
      }

      default:
        await ctx
          .reply(
            "**Системное:**\n" +
              "`system stats` - статистика и потребление ресурсов\n" +
              "`system genscan stop` - остановить процесс\n" +
              "`system genscan start` - запустить процесс\n" +
              "`system partnerships add <делегат> <число>` - добавить партнёрства\n" +
              "`system partnerships add-nototal <делегат> <число>` - добавить партнёрства + занос в no_total",
          )
          .catch(console.error);
    }
  },

  info: {
    name: "system",
    hidden: true,
    type: "text",
  },
} satisfies eds.CommandFile<"text">;
