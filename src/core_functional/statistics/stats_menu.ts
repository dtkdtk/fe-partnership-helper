import {
  build14datesChart,
  build365datesSmoothChart,
  getDelegateStats,
} from "#core_functional";
import {
  DB_DelegationStats,
  emoji,
  get14dates,
  getXdates,
  getDate,
  MSK,
  resources,
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

export enum StatsInterval {
  TODAY = 1,
  TWO_WEEKS = 14,
  YEAR = 365,
}

export enum StatsTarget {
  DEPARTMENT = "department",
  DELEGATE = "delegate",
}

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

async function getDepartmentTodayStats(): Promise<Map<string, number>> {
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
  interval: StatsInterval = StatsInterval.TWO_WEEKS,
): Promise<{
  numbers: number[];
  totalPartnerships: number;
  todayPartnerships: number;
  dates: string[];
}> {
  const data = await getDelegateStats(userId);
  const dates =
    interval === StatsInterval.YEAR
      ? getXdates(365).toReversed()
      : get14dates().toReversed();

  if (data) {
    const numbers = dates
      .map((D) => data.activity[D] ?? 0)
      .map((num) => (num < 0 ? 0 : num));

    return {
      numbers,
      totalPartnerships: data.total_partnerships,
      todayPartnerships: data.activity[getDate(MSK())] ?? 0,
      dates,
    };
  }

  return {
    numbers: Array(interval === StatsInterval.YEAR ? 365 : 14).fill(0),
    totalPartnerships: 0,
    todayPartnerships: 0,
    dates,
  };
}

export async function statsMenuSource(
  ctx: eds.SlashContext | eds.InteractionContext,
  type: StatsInterval,
  viewType: StatsTarget = StatsTarget.DEPARTMENT,
  targetUser?: User,
): Promise<BaseMessageOptions> {
  const localComponents = structuredClone(components);
  let tableData = "";
  let files: BaseMessageOptions["files"] = [];
  let image: APIEmbed["image"];
  let totalPartnerships = 0;
  let chart: Canvas | null = null;
  let chartDates: string[] = [];

  if (viewType === StatsTarget.DEPARTMENT) {
    if (type === StatsInterval.TODAY) {
      const todayStats = await getDepartmentTodayStats();
      const sortedStats = Array.from(todayStats.entries()).sort(
        ([, a], [, b]) => b - a,
      );

      for (let i = 0; i < sortedStats.length; i++) {
        const [delegateId, count] = sortedStats[i];
        const member = await eds.sfMember(ctx, delegateId);

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
    }
    
    else if (type === StatsInterval.TWO_WEEKS) {
      const { delegateStats, datedCounts: dailyTotals } =
        await getDepartmentIntervalStats(14);
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
        const member = await eds.sfMember(ctx, delegateId);
        if (member) {
          const displayName = member.displayName || member.user.username;
          tableData += `- ${displayName} - **${total}**\n`;
        }
      }

      if (!tableData) {
        tableData =
          "**За последние 2 недели не заключено ни одного партнёрства.**";
      }

      tableData += `\n**Всего:** \`${totalPartnerships}\``;

      chartDates = Array.from(dailyTotals.keys()).sort();
      const chartData = chartDates.map((date) => dailyTotals.get(date) ?? 0);
      chart = build14datesChart(chartData, chartDates);

      localComponents[0].components[1].disabled = true;
      localComponents[0].components[1].style = ButtonStyle.Success;
    }
    
    else if (type === StatsInterval.YEAR) {
      const { delegateStats, datedCounts } =
        await getDepartmentIntervalStats(365);
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
        const member = await eds.sfMember(ctx, delegateId);
        if (member) {
          const displayName = member.displayName || member.user.username;
          tableData += `- ${displayName} - **${total}**\n`;
        }
      }

      if (!tableData) {
        tableData = "**За последний год не заключено ни одного партнёрства.**";
      }

      tableData += `\n**Всего:** \`${totalPartnerships}\``;

      chartDates = Array.from(datedCounts.keys()).sort((a, b) => {
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
      });
      const chartData = chartDates.map((date) => datedCounts.get(date) ?? 0);
      chart = build365datesSmoothChart(chartData, chartDates);

      localComponents[0].components[2].disabled = true;
      localComponents[0].components[2].style = ButtonStyle.Success;
    }
  } else if (viewType === StatsTarget.DELEGATE && targetUser) {
    const stats = await getDelegateStatsData(targetUser.id, type);
    chartDates = stats.dates;

    if (type === StatsInterval.YEAR) {
      chart = build365datesSmoothChart(stats.numbers, chartDates);
    } else {
      chart = build14datesChart(stats.numbers, chartDates);
    }

    totalPartnerships = stats.totalPartnerships;

    tableData =
      `\n\n**Заключено партнёрств:**\nЗа всё время: \`${stats.totalPartnerships}\`\n` +
      `За сегодня: \`${stats.todayPartnerships}\`\n\n**Активность ${type === StatsInterval.YEAR ? "за год" : "за 2 недели"}:**`;

    if (type === StatsInterval.TODAY) {
      localComponents[0].components[0].disabled = true;
      localComponents[0].components[0].style = ButtonStyle.Success;
    } else if (type === StatsInterval.TWO_WEEKS) {
      localComponents[0].components[1].disabled = true;
      localComponents[0].components[1].style = ButtonStyle.Success;
    } else {
      localComponents[0].components[2].disabled = true;
      localComponents[0].components[2].style = ButtonStyle.Success;
    }
  }

  if (chart) {
    const attKey = `stats-chart-${randomUUID()}.png`;
    const attachment = new AttachmentBuilder(
      chart.toBuffer("image/png"),
    ).setName(attKey);
    files = [attachment];
    image = { url: "attachment://" + attKey };
  }

  const embed: APIEmbed = {
    description: tableData,
    color: resources.colors.delegation,
    footer: eds.getRandomFooterEmbed().data_djs,
    image,
  };

  if (viewType === StatsTarget.DEPARTMENT) {
    embed.title =
      type === StatsInterval.TODAY
        ? "Статистика партнёрств за сегодня"
        : type === StatsInterval.TWO_WEEKS
          ? "Статистика партнёрств за 2 недели"
          : "Статистика партнёрств за год";
    embed.thumbnail = { url: resources.images.statistics };
  } else if (viewType === StatsTarget.DELEGATE && targetUser) {
    embed.title = `${targetUser.displayName} [${targetUser.id}]`;
    embed.author = {
      name: "Информация о делегате",
      icon_url: resources.images.list,
    };
    embed.thumbnail = { url: eds.getAvatar(targetUser) };
  }

  const msg: InteractionReplyOptions = {
    embeds: [embed],
    files: files || [],
    components: localComponents,
    flags: [MessageFlags.Ephemeral],
  };

  return msg;
}

export async function getDelegateStatsOnly(
  userId: string,
  targetUser: User,
  interval: StatsInterval = StatsInterval.TWO_WEEKS,
): Promise<InteractionReplyOptions> {
  const stats = await getDelegateStatsData(userId, interval);
  const chart =
    interval === StatsInterval.YEAR
      ? build365datesSmoothChart(stats.numbers, stats.dates)
      : build14datesChart(stats.numbers, stats.dates);
  const attKey = `delegate-stats-chart-${randomUUID()}.png`;

  const attachment = new AttachmentBuilder(chart.toBuffer("image/png")).setName(
    attKey,
  );

  const text =
    `\n\n**Заключено партнёрств:**\nЗа всё время: \`${stats.totalPartnerships}\`\n` +
    `За сегодня: \`${stats.todayPartnerships}\`\n\n**Активность ${interval === StatsInterval.YEAR ? "за год" : "за 2 недели"}:**`;

  return {
    embeds: [
      {
        author: {
          name: "Информация о делегате",
          icon_url: resources.images.list,
        },
        color: resources.colors.delegation,
        description: text,
        footer: eds.getRandomFooterEmbed().data_djs,
        title: `${targetUser.displayName} [${targetUser.id}]`,
        thumbnail: { url: eds.getAvatar(targetUser) },
        image: { url: "attachment://" + attKey },
      },
    ],
    files: [attachment],
  };
}
