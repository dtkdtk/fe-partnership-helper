import { deparseTime } from "@eds-fw/timeparser";
import moment from "moment";
const MSK_TIMEZONE = 180;
export function getTime(date) {
    return date.format("mm:HH");
}
export function getDate(date) {
    return date.format("DD-MM-YYYY");
}
export function getXdates(X) {
    const date = MSK();
    const output = [];
    output.push(getDate(date));
    for (let i = 0; i < X - 1; i++) {
        date.date(date.date() - 1);
        output.push(getDate(date));
    }
    return output;
}
export function get14dates() {
    return getXdates(14);
}
export function sortDates(dates) {
    return dates
        .map((_) => _.split("-").toReversed().join("-"))
        .toSorted((a, b) => a.localeCompare(b))
        .map((_) => _.split("-").toReversed().join("-"));
}
/** Возвращает `true` если всё нормально */
export function checkCooldown1day(map, subj) {
    const previous = getDate(MSK(map.get(subj) ?? 0));
    const current = getDate(MSK());
    return previous != current;
}
export function ruDeparseTime(ms) {
    return deparseTime(ms, " ")
        .replace("ms", "мс")
        .replace("mon", "мес")
        .replace("s", "сек")
        .replace("m", "мин")
        .replace("h", "ч")
        .replace("d", "дн")
        .replace("w", "нед")
        .replace("y", "лет(XD)"); //лет... XD
}
export function MSK(input) {
    return moment(input).utcOffset(MSK_TIMEZONE);
}
