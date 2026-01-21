import { DB_ServersBlacklist } from "../../../databases.js";
import { ServerBlacklistData } from "../types.js";


export async function addToBlacklist(
  serverId: string, reason: string, adminId: string
) {
  await DB_ServersBlacklist.insertAsync({
    _id: serverId,
    timestamp: Date.now(),
    reason,
    admin_id: adminId
  });
}

export function getBlacklistData(serverId: string): Promise<ServerBlacklistData | null> {
  return DB_ServersBlacklist.findOneAsync({ _id: serverId });
}

export async function removeFromBlacklist(serverId: string, adminId: string) {
  await DB_ServersBlacklist.removeAsync({ _id: serverId }, {});
}
