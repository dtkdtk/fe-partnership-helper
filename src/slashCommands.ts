import type { eds } from "@eds-fw/framework";
import {
  ApplicationCommandType,
  ApplicationCommandOptionType,
} from "discord.js";

export function createSlashCommands(runtimeStorage: typeof eds.runtimeStorage) {
  const manager = runtimeStorage.get<eds.SlashCommandsManager>(
    "slashCommandsManager"
  );
  manager.create({
    name: "био-делегата",
    description: "Биография делегата Империи",
    nsfw: false,
    type: ApplicationCommandType.ChatInput,
    defaultMemberPermissions: null,
    dmPermission: false,
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        nameLocalizations: {
          ru: "участник",
        },
        description: "Пользователь",
        required: false,
      },
    ],
  });
  manager.create({
    name: "стата-делегации",
    description: "Статистика деятельности Делегации",
    nsfw: false,
    type: ApplicationCommandType.ChatInput,
    defaultMemberPermissions: null,
    dmPermission: false,
  });
  manager.create({
    name: "редактировать-партнёрство",
    description:
      "Редактировать данные о сервера партнёра (например, изменить текущего партнёра)",
    nsfw: false,
    type: ApplicationCommandType.ChatInput,
    defaultMemberPermissions: null,
    dmPermission: false,
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "target",
        nameLocalizations: {
          ru: "цель",
        },
        required: true,
        description: "ID/Приглашение",
      },
    ],
  });
  manager.save();
}
