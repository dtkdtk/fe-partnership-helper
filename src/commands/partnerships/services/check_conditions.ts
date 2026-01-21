import { Client, Invite, Message } from "discord.js";
import { botConfig } from "../../../bot_config.js";
import { ConfigEnv, getDate, MSK } from "../../../corelib.js";
import { getBlacklistData } from "../models/blacklist.js";
import { getServerData } from "../models/server.js";


export enum ConditionErrno {
  just_return,
  no_invite,
  many_invites,
  unfetched_invite,
  cooldown,
  blacklist,
  this_server,
}
export const ConditionErrNames: Record<ConditionErrno, string> = {
  [ConditionErrno.just_return]: "*just*",
  [ConditionErrno.no_invite]: `**Ссылка-приглашение не обнаружена.**\nНапоминание: приглашение может быть только прямым, т.е. под доменом \`discord.gg\` или \`discord.com/invite\`. Сторонние сервисы не считаются за приглашение`,
  [ConditionErrno.many_invites]: `**В тексте несколько приглашений на разные сервера.** Какое из них настоящее? Как определить: с каким именно сервером мы заключаем партнёрство?!`,
  [ConditionErrno.unfetched_invite]: `**Приглашение не распознано.** Увы и ах, не удаётся "вытянуть" данные из ссылки.`,
  [ConditionErrno.cooldown]: `**Кулдаун.** Каждый сервер можно публиковать только \`1 раз\` в день. Данный сервер уже публиковался сегодня`,
  [ConditionErrno.blacklist]: `**О НЕЕЕТ! Данный сервер в Чёрном списке (ЧС).**`,
  [ConditionErrno.this_server]: `**Не балуйтесь!** Вы публикуете текст этого же сервера.`,
};

export async function validateConditions(
  message: Message,
  justGetInvite?: boolean,
  checkCooldown: boolean = true
): Promise<ConditionErrno | Invite> {
  if (message.channelId != ConfigEnv.PARTNERSHIPS_CHANNEL_ID) return 0;
  if (message.author.bot) return 0;
  if (message.system) return 0;
  if (message.content.startsWith(botConfig.prefix!)) return 0;
  const inviteMatches = message.content.match(
    /(https:\/\/|)(discord.gg|discord.com\/invite)\/[a-zA-Z0-9-_]+/g
  );
  if (!inviteMatches?.length) return ConditionErrno.no_invite;

  const fetchedInvite = await fetchInvite(inviteMatches, message.client);
  if (typeof fetchedInvite == "number") return fetchedInvite;
  if (!fetchedInvite.guild) return ConditionErrno.unfetched_invite;
  if (fetchedInvite.guild.id == message.guildId) return ConditionErrno.this_server;
  if (justGetInvite) return fetchedInvite;

  const date = getDate(MSK(message.createdTimestamp));
  const serverData = await getServerData(fetchedInvite.guild.id);
  const blacklistData = await getBlacklistData(fetchedInvite.guild.id);
  if (blacklistData) return ConditionErrno.blacklist;
  if (checkCooldown && getDate(MSK(serverData?.timestamp ?? 1)) == date)
    return ConditionErrno.cooldown;

  return fetchedInvite;
}

export async function fetchInvite(
  invites: string[],
  client: Client
): Promise<ConditionErrno | Invite> {
  let fetchedInvite: (Invite | null)[] = [];
  for (const invite of invites)
    fetchedInvite.push(await client.fetchInvite(invite).catch(() => null));
  fetchedInvite = fetchedInvite.filter((it) => it != null);
  if (fetchedInvite.length == 0) return ConditionErrno.unfetched_invite;
  if (
    fetchedInvite.filter(
      (x, i) => x?.guild?.id != fetchedInvite.at(i - 1)?.guild?.id
    ).length > 0
  )
    return ConditionErrno.many_invites;
  const invite_fetched = fetchedInvite[0]!;
  return invite_fetched;
}
