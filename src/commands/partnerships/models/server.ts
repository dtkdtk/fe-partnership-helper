import { Invite } from "discord.js";
import { updateDatedVal } from "../../../corelib.js";
import { DB_ServersData } from "../../../databases.js";
import { ServerData } from "../types.js";


export async function initServerData(
  guildId: string,
  guildName: string,
  memberCount: number,
): Promise<ServerData | null> {
  const data: ServerData = {
    _id: guildId,
    timestamp: Date.now(),
    message_id: null,
    last_name: guildName,
    last_members_count: memberCount,
    delegates: {},
    partners: {},
  };
  const success = Boolean(await DB_ServersData.insertAsync(data).catch(() => false));
  return success ? data : null;
}

export function initServerData_byInvite(invite: Invite): Promise<ServerData | null> {
  if (!invite.guild) return Promise.resolve(null);
  return initServerData(invite.guild.id, invite.guild.name, invite.memberCount ?? 0);
} 

export function getServerData(guildId: string): Promise<ServerData | null> {
  return DB_ServersData.findOneAsync({ _id: guildId });
}

export async function updateServerData(
  oldData: ServerData,
  guildName: string,
  memberCount: number,
  delegateId?: string,
  timestamp?: number
): Promise<ServerData> {
  const data: ServerData = {
    ...oldData,
    last_name: guildName,
    last_members_count: memberCount,
  };
  if (timestamp !== undefined) data.timestamp = timestamp;
  if (delegateId) updateDatedVal(data.delegates, delegateId);
  await DB_ServersData.updateAsync({ _id: data._id }, data);
  return data;
}

export function updateServerData_byInvite(
  oldData: ServerData, invite: Invite, delegateId?: string, timestamp?: number
) {
  if (!invite.guild) return Promise.resolve(null);
  return updateServerData(oldData, invite.guild.name,
    invite.memberCount ?? 0, delegateId, timestamp
  );
}
