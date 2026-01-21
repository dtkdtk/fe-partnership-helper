import { getDate, MSK, sortDates } from "../corelib.js";

/** `Record<date:string, T>` */
export type DateRecord<T> = Record<string, T>;

export function updateDatedVal<T>(list: DateRecord<T>, current: T) {
  const now = getDate(MSK());
  for (const [date, id] of Object.entries(list ?? {}))
    if (id == current) delete list[date];
  list[now] = current;
}

export function lastDatedVal<T>(list: DateRecord<T>): T | undefined {
  const last = sortDates(Object.keys(list)).at(-1);
  return last ? list[last] : undefined;
}
