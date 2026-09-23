import { extractFromInviteOrId, extractInviteCodes, getDelegateStats, initDelegateStats, pauseGeneralScan, resumeGeneralScan, runGeneralScan } from "#core_functional";
import {
  BotCache,
  checkPermission,
  ConfigEnv,
  CoreLog,
  DB_DelegationStats, DB_Misc,
  DB_ServersData,
  DgPermissions,
  logger,
  noAccess
} from "#corelib";
import { ActionQueue, eds } from "@eds-fw/framework";
import { FetchMessagesOptions, Message } from "discord.js";

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

    export function partnershipsDateAdd(
      userId: string,
      date: string,
      amount: number,
    ) {
      logger.info(
        {
          userId,
          date,
          amount,
        },
        "CmdSystem: partnerships date-add executed",
      );
    }

    export function textResetKd(inviteOrId: string) {
      logger.info(
        { inviteOrId },
        "CmdSystem: text reset-kd executed",
      );
    }

    export function bypassCondDelegate(delegateId: string, state: "on" | "off") {
      logger.info(
        { delegateId, state },
        "CmdSystem: bypass-cond delegate executed",
      );
    }

    export function bypassCondText(inviteOrId: string, state: "on" | "off") {
      logger.info(
        { inviteOrId, state },
        "CmdSystem: bypass-cond text executed",
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

    export function channelCleanup(deletedN: number) {
      logger.info({ deletedN }, "CmdSystem: partnerships channel cleanup");
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

    case "date-add": {
      const userId = ctx.args[2];
      const dateStr = ctx.args[3];
      const amount = parseInt(ctx.args[4]);

      // Валидация формата ДД-ММ-ГГГГ
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!userId || !dateStr || !dateRegex.test(dateStr) || isNaN(amount)) {
        Log.System.error("partnerships date-add", "Invalid arguments");
        await ctx
          .reply("Неправильное использование. См. `system help` (формат даты: ДД-ММ-ГГГГ)")
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

      dgStats.activity[dateStr] ??= 0;
      dgStats.activity[dateStr] += amount;

      await DB_DelegationStats.updateAsync({ _id: dgStats._id }, dgStats)
        .catch(CoreLog.unexpectedError);

      Log.System.partnershipsDateAdd(userId, dateStr, amount);

      await ctx
        .reply(`✅ Готово: Добавлено **${amount}** партнёрств для делегата \`${userId}\` за дату \`${dateStr}\`.`)
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

async function scmText(ctx: eds.TextContext) {
  Log.System.subcommand("text", ctx.author.id, ctx.args);
  const action = ctx.args[1]?.toLowerCase();

  switch (action) {
    case "reset-kd": {
      const inviteOrId = ctx.args[2];
      if (!inviteOrId) {
        Log.System.error("text reset-kd", "Invalid arguments");
        await ctx
          .reply("Неправильное использование. См. `system help`")
          .catch(CoreLog.unexpectedError);
        return;
      }

      const extracted = await extractFromInviteOrId(ctx.client, inviteOrId);
      if (extracted == null) {
        Log.System.error("text reset-kd", "Guild not found");
        await ctx
          .reply("Сервер по ID / приглашению `" + inviteOrId + "` не найден.")
          .catch(CoreLog.unexpectedError);
        return;
      }

      if (!extracted.data) {
        Log.System.error("text reset-kd", "No partnership data");
        await ctx
          .reply("Партнёрство с данным сервером ещё не заключалось.")
          .catch(CoreLog.unexpectedError);
        return;
      }

      extracted.data.timestamp = 0;
      await DB_ServersData.updateAsync({ _id: extracted.id }, extracted.data)
        .catch(CoreLog.unexpectedError);

      Log.System.textResetKd(inviteOrId);

      await ctx
        .reply(`✅ Готово: Сброшен дневной кулдаун для \`${inviteOrId}\`.`)
        .catch(CoreLog.unexpectedError);
      break;
    }

    default:
      Log.System.error("text", "Invalid usage");
      await ctx
        .reply("Неправильное использование. См. `system help`")
        .catch(CoreLog.unexpectedError);
  }
}

/*
async function scmBypassCond(ctx: eds.TextContext) {
  Log.System.subcommand("bypass-cond", ctx.author.id, ctx.args);
  const targetType = ctx.args[1]?.toLowerCase();
  const action = ctx.args[2]?.toLowerCase();

  if (targetType === "delegate") {
    const userId = ctx.args[3];
    if (!userId || (action !== "on" && action !== "off")) {
      Log.System.error("bypass-cond delegate", "Invalid arguments");
      await ctx
        .reply("Неправильное использование. См. `system help`")
        .catch(CoreLog.unexpectedError);
      return;
    }

    const miscData = await DB_Misc.findOneAsync({ _id: "1" })
      .catch(CoreLog.unexpectedError);
    if (!miscData) {
      Log.System.error("bypass-cond delegate", "Database error");
      await ctx
        .reply("Ошибка: Аномальная ошибка базы данных, ничего не могу поделать.")
        .catch(CoreLog.unexpectedError);
      return;
    }

    miscData.bypass_delegates ??= [];
    const st = new Set(miscData.bypass_delegates);
    if (action === "on")
      st.add(userId);
    else
      st.delete(userId);
    miscData.bypass_delegates = Array.from(st);
    await DB_Misc.updateAsync({ _id: "1" }, miscData).catch(CoreLog.unexpectedError);

    Log.System.bypassCondDelegate(userId, action as "on" | "off");

    const stateText = action === "on" ? "включен" : "отключен";
    await ctx
      .reply(`✅ Готово: Обход проверки условий для делегата \`${userId}\` ${stateText}.`)
      .catch(CoreLog.unexpectedError);

  } else if (targetType === "text") {
    const inviteOrId = ctx.args[3];
    if (!inviteOrId || (action !== "on" && action !== "off")) {
      Log.System.error("bypass-cond text", "Invalid arguments");
      await ctx
        .reply("Неправильное использование. См. `system help`")
        .catch(CoreLog.unexpectedError);
      return;
    }

    const extracted = await extractFromInviteOrId(ctx.client, inviteOrId);
    if (extracted === null) {
      Log.System.error("bypass-cond text", "Guild not found");
      await ctx
        .reply("Сервер по ID / приглашению `" + inviteOrId + "` не найден.")
        .catch(CoreLog.unexpectedError);
      return;
    }

    const miscData = await DB_Misc.findOneAsync({ _id: "1" })
      .catch(CoreLog.unexpectedError);
    if (!miscData) {
      Log.System.error("bypass-cond delegate", "Database error");
      await ctx
        .reply("Ошибка: Аномальная ошибка базы данных, ничего не могу поделать.")
        .catch(CoreLog.unexpectedError);
      return;
    }

    miscData.bypass_servers ??= [];
    const st = new Set(miscData.bypass_servers);
    if (action === "on")
      st.add(extracted.id);
    else
      st.delete(extracted.id);
    miscData.bypass_servers = Array.from(st);
    await DB_Misc.updateAsync({ _id: "1" }, miscData).catch(CoreLog.unexpectedError);

    Log.System.bypassCondText(inviteOrId, action as "on" | "off");

    const stateText = action === "on" ? "включен" : "отключен";
    await ctx
      .reply(`✅ Готово: Обход проверки условий для текста/сервера \`${inviteOrId}\` ${stateText}.`)
      .catch(CoreLog.unexpectedError);

  } else {
    Log.System.error("bypass-cond", "Invalid usage");
    await ctx
      .reply("Неправильное использование. См. `system help`")
      .catch(CoreLog.unexpectedError);
  }
}


              "`system bypass-cond delegate on <делегат>` - включить обход проверки условий партнёрства для указанного делегата\n" +
              "`system bypass-cond delegate off <делегат>` - отключить обход проверки условий партнёрства для указанного делегата\n" +
              "`system bypass-cond text on <приглашение/ID>` - включить обход проверки условий партнёрства для указанного текста партнёрства (сервера)\n" +
              "`system bypass-cond text off <приглашение/ID>` - отключить обход проверки условий партнёрства для указанного текста партнёрства (сервера)"
*/

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

      case "text":
        await scmText(ctx);
        break;

      /*
      case "bypass-cond":
        await scmBypassCond(ctx);
        break;
      */

      case "channel-cleanup": {
        Log.System.subcommand("channel-cleanup", ctx.author.id, ctx.args);
        const count = Number(ctx.args[1] ?? NaN);
        if (isNaN(count) || count <= 0) {
          Log.System.error("channel-cleanup", "Invalid arguments");
          await ctx
            .reply("Неправильное использование. См. `system help`")
            .catch(CoreLog.unexpectedError);
          return;
        }

        let deleteCandidatesN = 0;
        let deletedN = 0;
        const deletionsQueue = new ActionQueue(3_000);
        for (const channelId of ConfigEnv.PARTNERSHIP_CHANNELS_ID) {
          const queue: Message[] = [];
          const channel = await eds.sfChannel(ctx, channelId);
          if (!channel?.isTextBased()) continue;
          
          let remainingN = count;
          let fetches = Math.ceil(count / 100);
          let fetchOptions: FetchMessagesOptions = { limit: 100 };
          while (fetches--) {
            const chunk = await channel.messages.fetch(fetchOptions).catch(() => {});
            if (!chunk?.size) break;
            for (const V of chunk.values()) {
              queue.push(V);
              remainingN--;
              if (remainingN == 0) break;
            }
            await eds.wait(3_000);
          }

          for (const msg of queue) {
            const invites = extractInviteCodes(msg.content);
            if (msg.author.bot || invites.length == 0) {
              deleteCandidatesN++;
              deletionsQueue.push(async () => {
                deletedN += await msg.delete()
                  .catch(() => 0).then(() => 1);
              });
            }
          }
        }

        deletionsQueue.push(async () => {
          if (!ctx.channel.isSendable()) return;
          await ctx.channel.send(
            `✅ Очистка канала партнёрств **завершена**.\nУдалено ${deletedN} / ${deleteCandidatesN} мусорных сообщений.`
          ).catch(CoreLog.unexpectedError);
        });

        Log.System.channelCleanup(deletedN);
        await ctx.reply(
          `🕐 Очистка канала партнёрств от мусора / оффтопа **начата**.\nЭто займёт некоторое время.\nДолжно удалиться ${deleteCandidatesN} сообщений.`
        ).catch(CoreLog.unexpectedError);

        break;
      }

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
              "`system partnerships add <делегат> <кол-во>` - добавить партнёрства за всё время\n" +
              "`system partnerships add-nototal <делегат> <кол-во>` - добавить (/вычесть) партнёрства за всё время + занос в no_total (чтобы не было конфликтов с глубокой проверкой)\n" +
              "`system partnerships date-add <делегат> <ДД-ММ-ГГГГ> <кол-во>` - добавить (/вычесть) партнёрства за конкретный день конкретного месяца конкретного года\n" +
              "`system text reset-kd <приглашение/ID>` - сбросить дневной кулдаун для сервера (по ссылке-приглашению / коду приглашения / ID сервера)\n" +
              "`system channel-cleanup <кол-во>` - выполнить очистку канала(-ов) партнёрств от оффтопа (сообщения от ботов, тексты без ссылок); рекомендуется указывать кол-во меньше 1000"
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
