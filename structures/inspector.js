const djs = await import("discord.js");

export class FEInspector {
  ConfigEnv;
  client;
  constructor(ConfigEnv) {
    this.ConfigEnv = ConfigEnv;
    this.client = new djs.Client({
      intents: ["Guilds"],
      makeCache: djs.Options.cacheWithLimits(),
      //без аргументов = без кэша. Если ручками поставить везде нолики - получится 25МБ кэша XD
    });
  }
  async start() {
    this.client.login(this.ConfigEnv.BOT_SECRET_TOKEN);
    this.client.on("ready", () => {
      if (this.ConfigEnv.ENABLE_DEBUG) this.client.user.setStatus("idle");
    });
  }
  /**
   * @param {Error} error
   */
  async report(error) {
    const channelId = this.ConfigEnv.BOT_SYSTEM_CHANNEL_ID,
      guildId = this.ConfigEnv.GUILD_ID;
    const guild = await this.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    if (!channel)
      throw new Error(
        "Канал с ID из параметра 'BOT_SYSTEM_CHANNEL_ID' не найден."
      );
    console.error(error);
    channel.send({
      content: `КРИТИЧЕСКАЯ ОШИБКА ‼`,
      embeds: [
        {
          title: "Бот упал!",
          description: `**Основной бот крашнулся из-за какой-то ошибки. Тем не менее, он будет перезапущен. (макс.число падений: 6)**\n**Пожалуйста, сообщите об этом разработчику! Discord: \`@dtkdtk0\`**\n\`Текст ошибки:\` \`\`\`js\n(${error.name}) ${error.message}\`\`\`\n\`Стек вызовов:\` \`\`\`js\n${error.stack}\`\`\``,
          color: 0xff0000,
          footer: {
            text: "『FE』Инспектор • Репорт о падении основного бота",
          },
        },
      ],
    });
  }
}
