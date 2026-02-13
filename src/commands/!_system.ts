import { eds } from "@eds-fw/framework";
import {
  checkPermission,
  ConfigEnv,
  CoreLog,
  DgPermissions,
  logger,
  noAccess
} from "../corelib.js";
import { BotCache, DB_DelegationStats, DB_Misc } from "../databases.js";
import {
  getDelegateStats,
  initDelegateStats,
} from "./partnerships/models/delegate_stats.js";
import {
  pauseGeneralScan,
  resumeGeneralScan,
  runGeneralScan,
} from "./partnerships/services/general_scan.js";

namespace Log {
  export namespace System {
    export function subcommand(sub: string, userId: string, args: string[]) {
      logger.info(
        { subcommand: sub, userId, args },
        "CmdSystem: subcommand executed",
      );
    }

    export function error(sub: string, error: string) {
      logger.error({ subcommand: sub, error }, "CmdSystem: error occurred");
    }

    export function partnershipsAdd(
      userId: string,
      amount: number,
      total: number,
      noTotal: boolean,
    ) {
      logger.info(
        {
          userId,
          amount,
          newTotal: total,
          noTotal,
        },
        "CmdSystem: partnerships added",
      );
    }

    export function partnershipsAddNoTotal(
      userId: string,
      amount: number,
      total: number,
    ) {
      logger.info(
        {
          userId,
          amount,
          newTotal: total,
        },
        "CmdSystem: partnerships added to no-total delegate",
      );
    }

    export function generalScanStop() {
      logger.info("CmdSystem: General Scan stopped by admin");
    }

    export function generalScanStart() {
      logger.info("CmdSystem: General Scan started by admin");
    }

    export function statsView(userId: string) {
      logger.info({ userId }, "CmdSystem: stats viewed");
    }
  }
}

async function scmGeneralScan(ctx: eds.TextContext) {
  Log.System.subcommand("genscan", ctx.author.id, ctx.args);
  const action = ctx.args[1]?.toLowerCase();
  switch (action) {
    case "stop":
      pauseGeneralScan();
      Log.System.generalScanStop();
      await ctx.reply("Процесс General Scan остановлен").catch(CoreLog.unexpectedError);
      break;

    case "start":
      resumeGeneralScan();
      runGeneralScan(ctx.client).catch(CoreLog.unexpectedError);
      Log.System.generalScanStart();
      await ctx.reply("Процесс General Scan запущен").catch(CoreLog.unexpectedError);
      break;

    default:
      Log.System.error("genscan", "Invalid usage");
      await ctx
        .reply("Неправильное использование. См. `system help`")
        .catch(CoreLog.unexpectedError);
  }
}

async function scmPartnerships(ctx: eds.TextContext) {
  Log.System.subcommand("partnerships", ctx.author.id, ctx.args);
  const action = ctx.args[1]?.toLowerCase();
  switch (action) {
    case "add-nototal": {
      const userId = ctx.args[2];
      const amount = parseInt(ctx.args[3]);
      if (!userId || isNaN(amount)) {
        Log.System.error("partnerships add-nototal", "Invalid arguments");
        await ctx
          .reply("Неправильное использование. См. `system help`")
          .catch(CoreLog.unexpectedError);
        return;
      }
      const dgStats =
        (await getDelegateStats(userId)) ?? (await initDelegateStats(userId));
      if (!dgStats) {
        Log.System.error(
          "partnerships add-nototal",
          "Failed to register stats",
        );
        await ctx
          .reply("Ошибка при регистрации статистики")
          .catch(CoreLog.unexpectedError);
        return;
      }
      dgStats.total_partnerships += amount;
      await DB_DelegationStats.updateAsync({ _id: userId }, dgStats);

      const miscDbData = await DB_Misc.findOneAsync({ _id: "1" });
      miscDbData.no_total_delegates.push(userId);
      await DB_Misc.updateAsync({ _id: "1" }, miscDbData);

      Log.System.partnershipsAddNoTotal(
        userId,
        amount,
        dgStats.total_partnerships,
      );

      await ctx
        .reply(
          `✅ Добавлено **${amount}** партнёрств в общую статистику делегата.` +
            `\nДелегат также внесён в список \`no_total_delegates\` (не собирать старые данные о кол-ве партнёрств).`,
        )
        .catch(CoreLog.unexpectedError);
      break;
    }

    case "add": {
      const userId = ctx.args[2];
      const amount = parseInt(ctx.args[3]);
      if (!userId || isNaN(amount)) {
        Log.System.error("partnerships add", "Invalid arguments");
        await ctx
          .reply("Неправильное использование. См. `system help`")
          .catch(CoreLog.unexpectedError);
        return;
      }
      const dgStats =
        (await getDelegateStats(userId)) ?? (await initDelegateStats(userId));
      if (!dgStats) {
        Log.System.error("partnerships add", "Failed to register stats");
        await ctx
          .reply("Ошибка при регистрации статистики")
          .catch(CoreLog.unexpectedError);
        return;
      }
      dgStats.total_partnerships += amount;
      await DB_DelegationStats.updateAsync({ _id: userId }, dgStats);

      Log.System.partnershipsAdd(
        userId,
        amount,
        dgStats.total_partnerships,
        false,
      );

      await ctx
        .reply(
          `✅ Добавлено **${amount}** партнёрств в общую статистику пользователя.`,
        )
        .catch(CoreLog.unexpectedError);
      break;
    }

    default:
      Log.System.error("partnerships", "Invalid usage");
      await ctx
        .reply("Неправильное использование. См. `system help`")
        .catch(CoreLog.unexpectedError);
  }
}

export default {
  async run(ctx) {
    if (!checkPermission(ctx.member, DgPermissions.admin)) {
      Log.System.error("permission", "Access denied");
      return noAccess(ctx);
    }

    const subcommand = ctx.args[0]?.toLowerCase();

    switch (subcommand) {
      case "genscan":
        await scmGeneralScan(ctx);
        break;

      case "partnerships":
        await scmPartnerships(ctx);
        break;

      case "stats": {
        Log.System.subcommand("stats", ctx.author.id, ctx.args);
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

        Log.System.statsView(ctx.author.id);

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
          .catch(CoreLog.unexpectedError);
        break;
      }

      default:
        Log.System.subcommand("help", ctx.author.id, ctx.args);
        await ctx
          .reply(
            "**Системное:**\n" +
              "`system stats` - статистика и потребление ресурсов\n" +
              "`system genscan stop` - остановить процесс\n" +
              "`system genscan start` - запустить процесс\n" +
              "`system partnerships add <делегат> <число>` - добавить партнёрства\n" +
              "`system partnerships add-nototal <делегат> <число>` - добавить партнёрства + занос в no_total",
          )
          .catch(CoreLog.unexpectedError);
    }
  },

  info: {
    name: "system",
    hidden: true,
    type: "text",
  },
} satisfies eds.CommandFile<"text">;
