import { DateRecord, DB_DelegationStats, DB_Misc, getDate, MSK, type OmitId } from "corelib";
import { DelegateStats } from "@/types.js";


const defaultDelegateStats = (userId: string) => ({
  _id: userId,
  activity: {},
  total_partnerships: 0
});

export async function initDelegateStats(userId: string, overrides?: Partial<DelegateStats>) {
  const data: DelegateStats = {
    _id: userId,
    activity: {},
    total_partnerships: 0,
    ...overrides,
  };
  const success = Boolean(await DB_DelegationStats.insertAsync(data).catch(() => false));
    return success ? data : null;
}

export function getDelegateStats(userId: string): Promise<DelegateStats | null> {
  return DB_DelegationStats.findOneAsync({ _id: userId });
}

export async function _updateDelegateStats(
  userId: string, partnershipTimestamp: number, addN: number
): Promise<DelegateStats | null> {
  const date = getDate(MSK(partnershipTimestamp));
  const stats = await DB_DelegationStats.findOneAsync({ _id: userId });
  if (stats === null) return null;
  stats.activity[date] = (stats.activity[date] ?? 0) + addN;
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

/**
 * Специально для сканов канала партнёрств.
 * Единственная функция, которая обрабатывает `MiscDbData.no_total_delegates`.
 */
export async function bulkUpdateDgStats(
  userId: string, datedDiff: DateRecord<number>
): Promise<DelegateStats> {
  const miscDbData = await DB_Misc.findOneAsync({ _id: "1" });
  const noTotalDelegates = miscDbData.no_total_delegates;
  let applyFn: (stats: OmitId<DelegateStats>) => Promise<unknown>;
  let stats = await DB_DelegationStats.findOneAsync({ _id: userId });
  if (stats === null)
    applyFn = (stats) => DB_DelegationStats.insertAsync({ _id: userId, ...stats });
  else
    applyFn = (stats) => DB_DelegationStats.updateAsync({ _id: userId }, stats);
  stats ??= defaultDelegateStats(userId);

  for (const [date, count] of Object.entries(datedDiff)) {
    stats.activity[date] = (stats.activity[date] ?? 0) + count;
    if (!noTotalDelegates.includes(userId)) stats.total_partnerships += count;
  }
  await applyFn(stats);
  return stats;
}
