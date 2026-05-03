import { BotCache, resources, CoreLog, DB_DelegationStats, PaginationSource } from "#corelib";
import eds from "@eds-fw/framework";
import { User, EmbedData, InteractionUpdateOptions, ButtonInteraction, ComponentType } from "discord.js";
import { StatsTarget } from "./stats_menu.js";
import { getStaffAscData } from "../models/staff_cache.js";


export function setupStatisticsLeaderboard() {
  eds.createButton({ custom_id: "delegation-stats.mode.leaderboard" }, leaderboardOpenButton);
}

async function leaderboardOpenButton(ctx: eds.InteractionContext<ButtonInteraction>) {
  const statsTarget = BotCache.get(`stats_target $$ ${ctx.message.id}`) as StatsTarget;
  let statsUser: User | undefined;
  if (statsTarget == StatsTarget.DELEGATE)
    statsUser = BotCache.get(`stats_user $$ ${ctx.message.id}`);
  else if (!statsTarget) return;

  const baseEmbed = {
    title: `Топ лидеров по партнёрству за всё время`,
    color: resources.colors.delegation,
    footer: eds.getRandomFooterEmbed().data_djs,
  } satisfies EmbedData;

  const reply = await ctx.reply({
    embeds: [{
      ...baseEmbed,
      thumbnail: {
        url: "https://i.sstatic.net/kOnzy.gif"
      },
      description: "# Пожалуйста, подождите..."
        + "\nЕсли команда долго не прописывалась, это займёт **30 и более секунд.**"
    }],
    files: [],
    withResponse: true,
    flags: ["Ephemeral"],
  }).catch(CoreLog.unexpectedError);
  const panelMessage = reply?.resource?.message;
  if (!panelMessage) return;

  const leaderboardData = await getLeaderboardData(ctx);
  const leaderboardLines = leaderboardData.map((x, i) =>
    `\`${i+1}.\` ${x.userDisplay} — **${x.amount}**`);
  const pages = eds.splitIntoPortions(leaderboardLines, 20)
    .map(arr => arr.join("\n"));
  
  const msgBuilder: PaginationSource.MsgBuilderFn<string> = (ps, buttons) => ({
    embeds: [{
      ...baseEmbed,
      description: ps.contentTransformer(ps),
    }],
    components: buttons
  });
  const pagination = new PaginationSource(ctx.user.id, pages);
  PaginationSource.cache.set(panelMessage.id, pagination);
  pagination.pageDisplayer = msgBuilder;

  const msg: InteractionUpdateOptions = {
    ...pagination.buildMessage(),
    files: [],
  };
  await ctx.editReply(msg).catch(CoreLog.unexpectedError);
}

type LeaderboardEntry = {
  id: string;
  userDisplay?: string;
  amount: number;
};

async function getLeaderboardData(ctx: eds.AnyContext): Promise<LeaderboardEntry[]> {
  const leaderboard: LeaderboardEntry[] = [];
  const dbData = DB_DelegationStats.getAllData();
  for (const entry of dbData) {
    const id = entry._id;
    const user = await getStaffAscData(ctx, entry._id);
    const userDisplay = (user?.displayName ?? user?.username)
      ?.replaceAll("_", "\\_") ?? "`[" + entry._id + "]`";
    const amount = entry.total_partnerships;
    leaderboard.push({ id, userDisplay, amount });
  }
  leaderboard.sort((a, b) => b.amount - a.amount);
  return leaderboard;
}
