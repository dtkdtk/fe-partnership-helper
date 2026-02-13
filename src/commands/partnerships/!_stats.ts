import eds from "@eds-fw/framework";
import type { Canvas } from "canvas";
import { randomUUID } from "crypto";
import { AttachmentBuilder, InteractionReplyOptions, MessageFlags } from "discord.js";
import { checkPermission, CoreLog, DgPermissions, get14dates, getDate, MSK, noAccess, resources } from "../../corelib.js";
import { createChart } from "./chart.js";
import { getDelegateStats } from "./models/delegate_stats.js";


export default {
  async run(ctx) {
    const user = ctx.options.getUser("user") ?? ctx.user;

    if (user.id != ctx.user.id
      && !checkPermission(ctx.member, DgPermissions.viewForeignStats)
    ) {
      return noAccess(ctx);
    }

    const lazyDefer = ctx.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(CoreLog.unexpectedError);
    const attKey = "delegate-stats-chart-" + randomUUID() + ".png";
    const {text, chart} = await getStatsDisplay(user?.id ?? ctx.user.id);

    const attachment = new AttachmentBuilder(
      chart.toBuffer("image/png")
    ).setName(attKey);

    const msg: InteractionReplyOptions = {
      embeds: [
        {
          author: {
            name: "Информация о делегате",
            icon_url: resources.images.list,
          },
          color: resources.colors.delegation,
          description: text,
          footer: eds.getRandomFooterEmbed().data_djs,
          title: `${user.displayName} [${user.id}]`,
          thumbnail: user?.avatarURL()
            ? { url: user?.avatarURL() ?? ctx.user.avatarURL()! } : undefined,
          image: {
            url: "attachment://" + attKey,
          },
        },
      ],
      files: [attachment],
    };

    await lazyDefer;
    ctx.followUp(msg).catch(CoreLog.unexpectedError);
  },

  info: {
    name: "био-делегата",
    type: "slash",
    desc: "Просмотр статистики делегата",
  },
} satisfies eds.CommandFile<"slash">;


async function getStatsDisplay(userId: string): Promise<{ text: string, chart: Canvas }> {
  let numbers, totalPartnerships, todayPartnerships;
  const data = await getDelegateStats(userId);
  const dates = get14dates().toReversed();
  if (data) {
    numbers = dates
      .map((D) => data.activity[D] ?? 0)
      .map((num) => (num < 0 ? 0 : num));
    totalPartnerships = data.total_partnerships;
    todayPartnerships = data.activity[getDate(MSK())];
  }
  else {
    numbers = Array(14).fill(0);
    totalPartnerships = 0;
    todayPartnerships = 0;
  }

  const chart = createChart(numbers, dates);
  const text = `\n\n**Заключено партнёрств:**\nЗа всё время: \`${totalPartnerships}\`\n`
    + `За сегодня: \`${todayPartnerships}\`\n\n**Активность за 2 недели:**`;

  return { text, chart };
}
