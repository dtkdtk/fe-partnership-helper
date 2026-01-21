import { getDate, MSK } from "../../../corelib.js";
import { DB_DelegationStats } from "../../../databases.js";
import { DelegateStats } from "../types.js";


export async function initDelegateStats(userId: string) {
  await DB_DelegationStats.insertAsync({
    _id: userId,
    activity: {},
    total_partnerships: 0
  });
}

export function getDelegateStats(userId: string): Promise<DelegateStats | null> {
  return DB_DelegationStats.findOneAsync({ _id: userId });
}

async function _updateDelegateStats(
  userId: string, partnershipTimestamp: number, addN: number
): Promise<DelegateStats | null> {
  const date = getDate(MSK(partnershipTimestamp));
  const stats = await DB_DelegationStats.findOneAsync({ _id: userId });
  if (stats === null) return null;
  stats.activity[date] ??= 0;
  stats.activity[date] += addN;
  stats.total_partnerships += addN;
  await DB_DelegationStats.updateAsync({ _id: userId }, stats);

  return stats;
}

export async function incrementDelegateStats(userId: string, partnershipTimestamp: number) {
  return _updateDelegateStats(userId, partnershipTimestamp, 1);
}
export async function decrementDelegateStats(userId: string, partnershipTimestamp: number) {
  return _updateDelegateStats(userId, partnershipTimestamp, -1);
}
