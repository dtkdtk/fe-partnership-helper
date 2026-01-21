import moment, { type Moment } from "moment";
export type Cooldown = Map<string, number>;
export declare function getTime(date: Moment): string;
export declare function getDate(date: Moment): string;
export declare function getXdates(X: number): string[];
export declare function get14dates(): string[];
export declare function sortDates(dates: string[]): string[];
/** Возвращает `true` если всё нормально */
export declare function checkCooldown1day(map: Cooldown, subj: string): boolean;
export declare function ruDeparseTime(ms: number): string;
export declare function MSK(input?: moment.MomentInput): Moment;
