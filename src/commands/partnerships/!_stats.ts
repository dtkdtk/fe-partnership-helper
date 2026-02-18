import { StatsInterval, statsMenuSource, StatsTarget } from "#core_functional";
import { BotCache, checkPermission, CoreLog, DgPermissions, noAccess } from "#corelib";
import eds from "@eds-fw/framework";
import { MessageFlags } from "discord.js";

export default {
  async run(ctx) {
    const user = ctx.options.getUser("user") ?? ctx.user;

    if (
      user.id != ctx.user.id &&
      !checkPermission(ctx.member, DgPermissions.viewForeignStats)
    ) {
      return noAccess(ctx);
    }

    const lazyDefer = ctx
      .deferReply({ flags: [MessageFlags.Ephemeral] })
      .catch(CoreLog.unexpectedError);

    const msg = await statsMenuSource(
      ctx,
      StatsInterval.TODAY,
      StatsTarget.DELEGATE,
      user,
    );

    await lazyDefer;
    const replyMsg = await ctx.editReply(msg).catch(CoreLog.unexpectedError);
    if (replyMsg) {
      BotCache.set(`stats_target $$ ${replyMsg.id}`, StatsTarget.DELEGATE);
      BotCache.set(`stats_user $$ ${replyMsg.id}`, user);
    }
  },

  info: {
    name: "био-делегата",
    type: "slash",
    desc: "Просмотр статистики делегата",
  },
} satisfies eds.CommandFile<"slash">;
