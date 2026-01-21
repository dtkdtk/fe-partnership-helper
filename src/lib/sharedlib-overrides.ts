import { parseEmoji, PartialEmoji } from "discord.js";
import moment from "moment";

export function MSK(ms?: number): moment.Moment {
  return moment(ms).utcOffset(MSK.utcOffset);
}
export namespace MSK {
  export let utcOffset: number = 3;
}

export function emoji(E: string): PartialEmoji {
  return parseEmoji(E) ?? parseEmoji(":black_small_square:")!;
}
