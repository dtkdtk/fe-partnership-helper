import {
  getDelegateStats,
  getStaffAscData,
} from "#core_functional";
import {
  DB_DelegationStats,
  emoji,
  getDate,
  getXdates,
  MSK,
  resources
} from "#corelib";
import eds from "@eds-fw/framework";
import type { Canvas } from "canvas";
import { randomUUID } from "crypto";
import {
  ActionRowData,
  APIEmbed,
  AttachmentBuilder,
  BaseMessageOptions,
  ButtonComponentData,
  ButtonStyle,
  ComponentType,
  InteractionReplyOptions,
  MessageFlags,
  User,
} from "discord.js";
import { build14datesChart } from "./chart14.js";
import { build30datesChart } from "./chart30.js";
import { build365datesSmoothChart } from "./chart365_smooth.js";
import { build7datesChart } from "./chart7.js";

export enum StatsInterval {
  TODAY = 1,
  ONE_WEEK = 7,
  TWO_WEEKS = 14,
  MONTH = 30,
  YEAR = 365,
}

export enum StatsTarget {
  DEPARTMENT = "department",
  DELEGATE = "delegate",
}

const StatsIntervalNames_Dative: Record<StatsInterval, string> = {
  [StatsInterval.TODAY]: "сегодня",
  [StatsInterval.ONE_WEEK]: "неделю",
  [StatsInterval.TWO_WEEKS]: "две недели",
  [StatsInterval.MONTH]: "месяц",
  [StatsInterval.YEAR]: "год",
};

const StatsIntervalIndexes = [
  StatsInterval.TODAY,
  StatsInterval.ONE_WEEK,
  StatsInterval.TWO_WEEKS,
  StatsInterval.MONTH,
  StatsInterval.YEAR
];

const components = [
  {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode." + StatsInterval.TODAY,
        label: "За сегодня",
        emoji: emoji(resources.button_icons.calendar),
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode." + StatsInterval.ONE_WEEK,
        label: "За неделю",
        emoji: emoji(resources.button_icons.calendar),
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode." + StatsInterval.TWO_WEEKS,
        label: "За 2 недели",
        emoji: emoji(resources.button_icons.calendar),
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode." + StatsInterval.MONTH,
        label: "За месяц",
        emoji: emoji(resources.button_icons.calendar),
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        customId: "delegation-stats.mode." + StatsInterval.YEAR,
        label: "За год",
        emoji: emoji(resources.button_icons.calendar),
      },
    ],
  },
  {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        customId: "delegation-stats.mode.leaderboard",
        label: "Топ за всё время",
        emoji: emoji(resources.button_icons.trophy)
      }
    ]
  }
] as [ActionRowData<ButtonComponentData>, ActionRowData<ButtonComponentData>];



async function getDepartmentIntervalStats(intervalDays: number): Promise<{
  delegateStats: Map<string, number[]>;
  datedCounts: Map<string, number>;
}> {
  const delegateStats = new Map<string, number[]>();
  const dailyTotals = new Map<string, number>();
  const dates = getXdates(intervalDays);
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
  return { delegateStats, datedCounts: dailyTotals };
}



function getIntervalChart(interval: StatsInterval, values: number[], dates: string[]) {
  switch (interval) {
    case StatsInterval.TODAY:
      return null;
    case StatsInterval.ONE_WEEK:
      return build7datesChart(values, dates);
    case StatsInterval.TWO_WEEKS:
      return build14datesChart(values, dates);
    case StatsInterval.MONTH:
      return build30datesChart(values, dates);
    case StatsInterval.YEAR:
      return build365datesSmoothChart(values, dates);
  }
}



async function getDelegateStatsData(
  userId: string,
  interval: StatsInterval,
): Promise<{
  numbers: number[];
  totalPartnerships: number;
  intervalPartnerships: number;
  dates: string[];
}> {
  const values = await getDelegateStats(userId);
  const dates = getXdates(interval).toReversed();
  if (values) {
    const numbers = dates
      .map((D) => values.activity[D] ?? 0)
      .map((num) => (num < 0 ? 0 : num));
    const intervalPartnerships = numbers.reduce((acc, X) => acc + X, 0)
    return {
      totalPartnerships: values.total_partnerships,
      numbers, intervalPartnerships, dates,
    };
  }
  return {
    numbers: Array(interval).fill(0),
    totalPartnerships: 0,
    intervalPartnerships: 0,
    dates,
  };
}



export async function statsMenuSource(
  ctx: eds.SlashContext | eds.InteractionContext,
  interval: StatsInterval,
  target: StatsTarget,
  targetUser?: User,
): Promise<BaseMessageOptions> {
  let tableData = "";
  let files: BaseMessageOptions["files"] = [];
  let image: APIEmbed["image"];
  let intervalPartnerships = 0;
  let totalPartnerships: null | number = null;
  let chart: Canvas | null = null;

  if (target === StatsTarget.DEPARTMENT) {
    const { delegateStats, datedCounts: dailyTotals } =
      await getDepartmentIntervalStats(interval);
    const delegateTotals = new Map<string, number>();

    for (const [delegateId, counts] of delegateStats) {
      const total = counts.reduce((sum, current) => sum + current, 0);
      delegateTotals.set(delegateId, total);
      intervalPartnerships += total;
    }

    const sortedDelegates = Array.from(delegateTotals.entries())
      .sort(([, a], [, b]) => b - a)
      .filter(([, total]) => total > 0);

    for (const [delegateId, total] of sortedDelegates) {
      const member = await getStaffAscData(ctx, delegateId);
      const displayName = member ?
        (member.displayName || member.username) : "`[" + delegateId + "]`";
      tableData += `- ${displayName} - **${total}**\n`;
    }

    const chartDates = Array.from(dailyTotals.keys()).sort(_sortDates);
    const chartValues = chartDates.map((date) => dailyTotals.get(date) ?? 0);
    chart = getIntervalChart(interval, chartValues, chartDates);
  }


  else if (target === StatsTarget.DELEGATE && targetUser) {
    /* Статистика за сегодня есть только у всего отдела */
    const stats = await getDelegateStatsData(targetUser.id, interval);
    chart = getIntervalChart(interval, stats.numbers, stats.dates);
    intervalPartnerships = stats.intervalPartnerships;
    totalPartnerships = stats.totalPartnerships;
  }

  tableData += `\n**За ${StatsIntervalNames_Dative[interval]}:** \`${intervalPartnerships}\``;
  if (totalPartnerships != null)
    tableData += `\n**Всего:** \`${totalPartnerships}\``;
  if (interval != StatsInterval.TODAY)

  if (chart) {
    const attKey = `stats-chart-${randomUUID()}.png`;
    const attachment = new AttachmentBuilder(
      chart.toBuffer("image/png"),
    ).setName(attKey);
    files = [attachment];
    image = { url: "attachment://" + attKey };
  }

  const localComponents = structuredClone(components);
  const embed: APIEmbed = {
    description: tableData,
    color: resources.colors.delegation,
    footer: eds.getRandomFooterEmbed().data_djs,
    image,
  };
  const msg: InteractionReplyOptions = {
    embeds: [embed],
    components: localComponents,
    flags: [MessageFlags.Ephemeral],
  };

  let currentButtonIndex = StatsIntervalIndexes.indexOf(interval);

  localComponents[0].components[currentButtonIndex].disabled = true;
  localComponents[0].components[currentButtonIndex].style = ButtonStyle.Success;

  if (target === StatsTarget.DELEGATE && targetUser) {
    embed.title = `${targetUser.displayName} [${targetUser.id}]`;
    embed.author = {
      name: "Информация о делегате",
      icon_url: resources.images.list,
    };
    embed.thumbnail = { url: eds.getAvatar(targetUser) };
  }
  else if (target === StatsTarget.DEPARTMENT) {
    embed.author = {
      name: "Статистика отдела",
      icon_url: resources.images.list,
    };
  }
  msg.files = files;

  return msg;
}



function _sortDates(a: string, b: string): number {
  const aParts = a.split("-");
  const bParts = b.split("-");

  const aYear = parseInt(aParts[2], 10);
  const bYear = parseInt(bParts[2], 10);
  if (aYear !== bYear) return aYear - bYear;

  const aMonth = parseInt(aParts[1], 10);
  const bMonth = parseInt(bParts[1], 10);
  if (aMonth !== bMonth) return aMonth - bMonth;

  const aDay = parseInt(aParts[0], 10);
  const bDay = parseInt(bParts[0], 10);
  return aDay - bDay;
}
