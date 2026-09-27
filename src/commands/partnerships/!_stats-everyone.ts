import { StatsInterval, statsMenuSource, StatsTarget } from "#core_functional";
import { BotCache, checkPermission, CoreLog, DgPermissions, noAccess } from "#corelib";
import eds from "@eds-fw/framework";
import { MessageFlags } from "discord.js";

export default {
  async run(ctx) {
    if (!checkPermission(ctx.member, DgPermissions.viewDepartmentStats)) {
      return noAccess(ctx);
    }

    const lazyDefer = ctx
      .deferReply({ flags: [MessageFlags.Ephemeral] })
      .catch(CoreLog.unexpectedError);
    const msg = await statsMenuSource(
      ctx,
      StatsInterval.TODAY,
      StatsTarget.DEPARTMENT,
    );
    await lazyDefer;
    const replyMsg = await ctx.followUp(msg).catch(CoreLog.unexpectedError);
    if (replyMsg) BotCache.set(`stats_target $$ ${replyMsg.id}`, StatsTarget.DEPARTMENT);
  },

  info: {
    name: "стата-делегации",
    type: "slash",
    desc: "Статистика деятельности делегации",
  },
} satisfies eds.CommandFile<"slash">;
