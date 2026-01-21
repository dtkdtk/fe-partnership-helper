import eds from "@eds-fw/framework";
import { randomUUID } from "crypto";
import {
  ActionRowData,
  APIEmbed,
  AttachmentBuilder,
  BaseMessageOptions,
  ButtonComponentData,
  ButtonStyle,
  ComponentType,
  MessageFlags
} from "discord.js";
import {
  checkPermission,
  DB_DelegationStats,
  DgPermissions,
  emoji,
  get14dates,
  getDate,
  MSK,
  noAccess,
  resources,
} from "../../corelib.js";
import { createChart } from "./chart.js";

const components = [
  {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode.today",
        label: "За сегодня",
        emoji: emoji(resources.button_icons.calendar),
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode.two_weeks",
        label: "За 2 недели",
        emoji: emoji(resources.button_icons.calendar),
      },
      /*{
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode.month",
        label: "За месяц",
        emoji: emoji(resources.button_icons.calendar),
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode.half_year",
        label: "За полугодие",
        emoji: emoji(resources.button_icons.calendar),
      },*/
    ],
  },
] as [ActionRowData<ButtonComponentData>];

enum ActivityTypes {
  TODAY = 1,
  TWO_WEEKS,
  /*MONTH,
  HALF_YEAR,*/
}

export default {
  async run(ctx) {
    const lazyDefer = ctx.deferReply({ flags: [MessageFlags.Ephemeral] });
    
    if (!checkPermission(ctx.member, DgPermissions.viewDepartmentStats)) {
      return noAccess(ctx);
    }

    const msg = await createMessage(ctx, ActivityTypes.TODAY);
    await lazyDefer;
    ctx.followUp(msg).catch(console.error);
  },

  info: {
    name: "стата-делегации",
    type: "slash",
    desc: "Статистика деятельности делегации",
  },
} satisfies eds.CommandFile<"slash">;

async function getTodayStats(): Promise<Map<string, number>> {
  const stats = new Map<string, number>();
  const today = getDate(MSK());
  
  const allStats = DB_DelegationStats.getAllData();
  
  for (const stat of allStats) {
    const todayCount = stat.activity?.[today] ?? 0;
    if (todayCount > 0) {
      stats.set(stat._id, todayCount);
    }
  }
  
  return stats;
}

async function getTwoWeeksStats(): Promise<{
  delegateStats: Map<string, number[]>;
  dailyTotals: Map<string, number>;
}> {
  const delegateStats = new Map<string, number[]>();
  const dailyTotals = new Map<string, number>();
  const dates = get14dates();
  
  const allStats = DB_DelegationStats.getAllData();
  
  for (const date of dates) {
    dailyTotals.set(date, 0);
  }
  
  for (const stat of allStats) {
    const counts: number[] = [];
    
    for (const date of dates) {
      const count = stat.activity?.[date] ?? 0;
      counts.push(count);
      
      dailyTotals.set(date, dailyTotals.get(date)! + count);
    }
    
    delegateStats.set(stat._id, counts);
  }
  
  return { delegateStats, dailyTotals };
}

async function getStatsDisplay(
  ctx: eds.SlashContext | eds.InteractionContext,
  type: ActivityTypes
): Promise<{
  tableData: string;
  image?: { url: string };
  files?: BaseMessageOptions["files"];
  components: BaseMessageOptions["components"];
}> {
  const localComponents = structuredClone(components);
  let tableData = "";
  let files: BaseMessageOptions["files"];
  let image: APIEmbed["image"];
  let totalPartnerships = 0;

  if (type === ActivityTypes.TODAY) {
    const todayStats = await getTodayStats();
    const sortedStats = Array.from(todayStats.entries()).sort(([, a], [, b]) => b - a);
    
    for (let i = 0; i < sortedStats.length; i++) {
      const [delegateId, count] = sortedStats[i];
      const member = await ctx.guild?.members.fetch(delegateId).catch(() => null);
      
      if (member) {
        const displayName = member.displayName || member.user.username;
        tableData += `${i + 1}. ${displayName} - **${count}**\n`;
        totalPartnerships += count;
      }
    }
    
    if (!tableData) {
      tableData = "**За сегодня не заключено ни одного партнёрства.**";
    }
    
    localComponents[0].components[0].disabled = true;
    localComponents[0].components[0].style = ButtonStyle.Success;
    
  } else if (type === ActivityTypes.TWO_WEEKS) {
    const { delegateStats, dailyTotals } = await getTwoWeeksStats();
    const delegateTotals = new Map<string, number>();
    
    for (const [delegateId, counts] of delegateStats) {
      const total = counts.reduce((sum, current) => sum + current, 0);
      delegateTotals.set(delegateId, total);
      totalPartnerships += total;
    }
    
    const sortedDelegates = Array.from(delegateTotals.entries())
      .sort(([, a], [, b]) => b - a)
      .filter(([, total]) => total > 0);
    
    for (const [delegateId, total] of sortedDelegates) {
      const member = await ctx.guild?.members.fetch(delegateId).catch(() => null);
      if (member) {
        const displayName = member.displayName || member.user.username;
        tableData += `- ${displayName} - **${total}**\n`;
      }
    }
    
    if (!tableData) {
      tableData = "**За последние 2 недели не заключено ни одного партнёрства.**";
    }
    
    tableData += `\n**Всего:** \`${totalPartnerships}\``;
    
    const chartData = Array.from(dailyTotals.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([, count]) => (count < 0 ? 0 : count));
    
    const chartDates = Array.from(dailyTotals.keys()).sort();
    const chart = createChart(chartData, chartDates);
    
    const attKey = "delegation-stats-chart-" + randomUUID() + ".png";
    const attachment = new AttachmentBuilder(chart.toBuffer("image/png")).setName(attKey);
    
    files = [attachment];
    image = { url: "attachment://" + attKey };
    
    localComponents[0].components[1].disabled = true;
    localComponents[0].components[1].style = ButtonStyle.Success;
  }

  return {
    tableData,
    image,
    files,
    components: localComponents,
  };
}

async function createMessage(
  ctx: eds.SlashContext | eds.InteractionContext,
  type: ActivityTypes,
): Promise<BaseMessageOptions> {
  const { tableData, image, files, components } = await getStatsDisplay(ctx, type);
  
  const msg = {
    embeds: [
      {
        description: tableData,
        color: resources.colors.delegation,
        footer: eds.getRandomFooterEmbed().data_djs,
        title:
          type === ActivityTypes.TODAY
            ? "Статистика партнёрств за сегодня"
            : "Статистика партнёрств за 2 недели",
        thumbnail: {
          url: resources.images.statistics,
        },
        image,
      },
    ],
    files: files || [],
    components,
    flags: [MessageFlags.Ephemeral],
  };
  return msg;
}

eds.createButton({ custom_id: "delegation-stats.mode.today" },
  async (ctx) => {
    if (!checkPermission(ctx.member, DgPermissions.viewDepartmentStats)) {
      return noAccess(ctx);
    }
    
    const lazyDefer = ctx.deferUpdate();
    const msg = await createMessage(ctx, ActivityTypes.TODAY);
    if ("flags" in msg) delete msg.flags;
    await lazyDefer;
    ctx.editReply(msg).catch(console.error);
  }
);

eds.createButton({ custom_id: "delegation-stats.mode.two_weeks" },
  async (ctx) => {
    if (!checkPermission(ctx.member, DgPermissions.viewDepartmentStats)) {
      return noAccess(ctx);
    }
    
    const lazyDefer = ctx.deferUpdate();
    const msg = await createMessage(ctx, ActivityTypes.TWO_WEEKS);
    if ("flags" in msg) delete msg.flags;
    await lazyDefer;
    ctx.editReply(msg).catch(console.error);
  }
);