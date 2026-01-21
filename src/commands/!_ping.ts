import { eds } from "@eds-fw/framework";
import { MSK } from "../corelib.js";


export default {
  async run(ctx) {
    ctx
      .reply(
        `В-ж-ж-жух!\n> Пинг бота в одну сторону: \`${Math.abs(
          ctx.createdTimestamp - +MSK()
        )}мс\`\n> Пинг вебсокета: \`${Math.abs(ctx.client.ws.ping)}мс\``
      )
      .catch(console.error);
  },

  info: {
    name: "ping",
    hidden: true,
    type: "text",
  },
} satisfies eds.CommandFile<"text">;
