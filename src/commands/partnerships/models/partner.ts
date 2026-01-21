import { lastDatedVal, updateDatedVal } from "../../../corelib.js";
import { DB_PartnersData, DB_ServersData } from "../../../databases.js";
import { PartnerData } from "../types.js";


export async function initPartnerData(userId: string, username: string) {
  const data: PartnerData = {
    _id: userId,
    username,
    delegates: {},
    server_ids: {}
  };
  const success = Boolean(await DB_PartnersData.insertAsync(data).catch(() => false));
  return success ? data : null;
}

export function getPartnerData(userId: string): Promise<PartnerData | null> {
  return DB_PartnersData.findOneAsync({ _id: userId });
}

export async function updatePartnerData(
  oldData: PartnerData, username: string, delegateId: string, serverId: string
): Promise<PartnerData> {
  const data: PartnerData = {
    ...oldData,
    username,
  };
  updateDatedVal(data.delegates, delegateId);
  updateDatedVal(data.server_ids, serverId);
  await DB_PartnersData.updateAsync({ _id: data._id }, data);
  return data;
}

export async function isActualPartner(userId: string): Promise<boolean> {
  const data = await getPartnerData(userId);
  if (data === null) return false;
  const servers = await DB_ServersData.findAsync({ _id: { $in: data.server_ids } });
  if (!servers || !servers.length) return false;
  return servers.some(D => lastDatedVal(D.partners) == userId);
}
