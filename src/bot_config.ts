import { eds } from "@eds-fw/framework";
import { Options } from "discord.js";
import { ConfigEnv, resources } from "./corelib.js";
import { noAccess } from "./lib/checkAccess.js";

const botConfig: eds.ConfigExemplar = {
  token: ConfigEnv.BOT_SECRET_TOKEN,
  intents: [
    "Guilds",
    "GuildMembers",
    "GuildEmojisAndStickers",
    "GuildInvites",
    "GuildMessages",
    "GuildMessageReactions",
    "GuildMessageTyping",
    "MessageContent",
  ],
  clientOptions: {
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      ReactionManager: 0,
      GuildMemberManager: 500,
      UserManager: 500,
      GuildEmojiManager: 0,
      GuildStickerManager: 0,
      PresenceManager: 0,
      DMMessageManager: 0,
    }),
  },
  commandsPath: "./dist/commands/",
  onlyLoadFilesStartingWith: ["!_"],
  colors: resources.colors,
  footerText: [resources.default_footer.text],
  footerIcon: [resources.default_footer.image],
  slashOnly: false,
  guildOnly: true,
  prefix: ConfigEnv.TextPrefix,
  builtinCommandsSettings: {
    helpCommandCategory: "Основные",
    helpListTitleText: "Список команд:",
    helpPageTitleText: "Помощь по команде:",
    helpCommandDescription: "Список всех команд бота",
    helpCommandName: "команды",
    helpCommandArgumentDescription: "Название команды",
    helpEphemeral: true,
    helpListThumbnail: resources.images.info,
    helpPageThumbnail: resources.images.info,
    helpListAdditionalText: `\`fe-partnership-helper :: Менеджер партнёрств с открытым кодом\`\nМой прародитель: \`@dtkdtk0\`\nМоя версия: \`v${ConfigEnv.BotVersion}\`\n\n[Код бота (github)](https://github.com/dtkdtk/fe-partnership-helper)`,
  },
  noAccess,
  includeBuiltinCommands: { help: true }
};

export { botConfig };

