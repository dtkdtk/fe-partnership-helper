import { StatsInterval, statsMenuSource, StatsTarget } from "#core_functional";
import { BotCache, CoreLog } from "#corelib";
import eds from "@eds-fw/framework";
import { User } from "discord.js";

function create_IntervalMode_button(mode: StatsInterval) {
  eds.createButton({ custom_id: "delegation-stats.mode." + mode }, async (ctx) => {
    const statsTarget = BotCache.get(`stats_target $$ ${ctx.message.id}`) as StatsTarget;
    let statsUser: User | undefined;
    if (statsTarget == StatsTarget.DELEGATE) statsUser = BotCache.get(`stats_user $$ ${ctx.message.id}`);
    else if (!statsTarget) return;

    const lazyDefer = ctx.deferUpdate().catch(CoreLog.unexpectedError);
    const msg = await statsMenuSource(
      ctx,
      mode,
      statsTarget,
      statsUser,
    );
    if ("flags" in msg) delete msg.flags;
    await lazyDefer;
    await ctx.editReply(msg).catch(CoreLog.unexpectedError);
  });
}

create_IntervalMode_button(StatsInterval.TODAY);
create_IntervalMode_button(StatsInterval.ONE_WEEK);
create_IntervalMode_button(StatsInterval.TWO_WEEKS);
create_IntervalMode_button(StatsInterval.YEAR);

export const pragmaSkip = true;
