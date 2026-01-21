import eds from "@eds-fw/framework";
import type { Canvas } from "canvas";
import { randomUUID } from "crypto";
import { AttachmentBuilder, InteractionReplyOptions, MessageFlags } from "discord.js";
import { checkPermission, DB_DelegationStats, DgPermissions, get14dates, getDate, MSK, noAccess, resources } from "../../corelib.js";
import { createChart } from "./chart.js";


export default {
  async run(ctx) {
    const lazyDefer = ctx.deferReply({ flags: MessageFlags.Ephemeral });
    const user = ctx.options.getUser("user") ?? ctx.user;

    if (user.id != ctx.user.id
      && !checkPermission(ctx.member, DgPermissions.viewForeignStats)
    ) {
      return noAccess(ctx);
    }

    const attKey = "delegate-stats-chart-" + randomUUID() + ".png";
    const {text, chart} = await getStatsDisplay(user?.id ?? ctx.user.id);

    const attachment = new AttachmentBuilder(
      chart.toBuffer("image/png")
    ).setName(attKey);

    const msg: InteractionReplyOptions = {
      flags: [MessageFlags.Ephemeral],
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
    ctx.followUp(msg).catch(console.error);
  },

  info: {
    name: "био-делегата",
    type: "slash",
    desc: "Просмотр статистики делегата",
  },
} satisfies eds.CommandFile<"slash">;


async function getStatsDisplay(user: string): Promise<{ text: string, chart: Canvas }> {
  const data = (await DB_DelegationStats.findOneAsync({ _id: user })) ?? {};
  const dates = get14dates().toReversed();
  const numbers = dates
    .map((date) => data?.activity[date] ?? 0)
    .map((num) => (num < 0 ? 0 : num));
  const chart = createChart(numbers, dates);

  const totalPartnerships = data.total_partnerships ?? 0;
  const todayPartnerships = data.activity?.[getDate(MSK())] ?? 0;
  const text = `\n\n**Заключено партнёрств:**\nЗа всё время: \`${totalPartnerships}\`\n`
    + `За сегодня: \`${todayPartnerships}\`\n\n**Активность за 2 недели:**`;

  return { text, chart };
}
