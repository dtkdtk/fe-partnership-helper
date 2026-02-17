import { CoreLog, MSK } from "#corelib";
import { eds } from "@eds-fw/framework";


export default {
  async run(ctx) {
    ctx
      .reply(
        `В-ж-ж-жух!\n> Пинг бота в одну сторону: \`${Math.abs(
          ctx.createdTimestamp - +MSK()
        )}мс\`\n> Пинг вебсокета: \`${Math.abs(ctx.client.ws.ping)}мс\``
      )
      .catch(CoreLog.unexpectedError);
  },

  info: {
    name: "ping",
    hidden: true,
    type: "text",
  },
} satisfies eds.CommandFile<"text">;
