import {
  build14datesChart,
  build365datesSmoothChart,
  getDelegateStats,
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
import { build7datesChart } from "./chart7.js";

export enum StatsInterval {
  TODAY = 1,
  ONE_WEEK = 7,
  TWO_WEEKS = 14,
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
  [StatsInterval.YEAR]: "год",
};

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
        customId: "delegation-stats.mode." + StatsInterval.YEAR,
        label: "За год",
        emoji: emoji(resources.button_icons.calendar),
      },
    ],
  },
] as [ActionRowData<ButtonComponentData>];



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



async function getDelegateStatsData(
  userId: string,
  interval: StatsInterval,
): Promise<{
  numbers: number[];
  totalPartnerships: number;
  todayPartnerships: number;
  dates: string[];
}> {
  const values = await getDelegateStats(userId);
  const dates = getXdates(interval).toReversed();
  if (values) {
    const numbers = dates
      .map((D) => values.activity[D] ?? 0)
      .map((num) => (num < 0 ? 0 : num));
    return {
      numbers,
      totalPartnerships: values.total_partnerships,
      todayPartnerships: values.activity[getDate(MSK())] ?? 0,
      dates,
    };
  }
  return {
    numbers: Array(interval).fill(0),
    totalPartnerships: 0,
    todayPartnerships: 0,
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
  let chartDates: string[] = [];

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
      const member = await eds.sfMember(ctx, delegateId);
      if (member) {
        const displayName = member.displayName || member.user.username;
        tableData += `- ${displayName} - **${total}**\n`;
      }
    }

    chartDates = Array.from(dailyTotals.keys()).sort(_sortDates);
    const chartValues = chartDates.map((date) => dailyTotals.get(date) ?? 0);
    switch (interval) {
      case StatsInterval.ONE_WEEK:
        chart = build7datesChart(chartValues, chartDates);
        break;
      case StatsInterval.TWO_WEEKS:
        chart = build14datesChart(chartValues, chartDates);
        break;
      case StatsInterval.YEAR:
        chart = build365datesSmoothChart(chartValues, chartDates);
        break;
    }
  }


  else if (target === StatsTarget.DELEGATE && targetUser) {
    /* Статистика за сегодня есть только у всего отдела */
    const stats = await getDelegateStatsData(targetUser.id, interval);
    chartDates = stats.dates;
    switch (interval) {
        case StatsInterval.ONE_WEEK:
          chart = build7datesChart(stats.numbers, stats.dates);
          break;
        case StatsInterval.TWO_WEEKS:
          chart = build14datesChart(stats.numbers, stats.dates);
          break;
        case StatsInterval.YEAR:
          chart = build365datesSmoothChart(stats.numbers, stats.dates);
          break;
      }
    intervalPartnerships = stats.todayPartnerships;
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

  let currentButtonIndex = [StatsInterval.TODAY, StatsInterval.ONE_WEEK,
    StatsInterval.TWO_WEEKS, StatsInterval.YEAR].indexOf(interval);

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
