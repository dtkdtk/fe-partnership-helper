import moment from "moment";
import { logger, MSK } from "../../../corelib.js";
import { ConditionErrno } from "./check_conditions.js";
import { ResultState } from "./general_scan.js";

export namespace Log {
  export namespace Scan {
    let ScanStart: moment.Moment;

    export function start() {
      ScanStart = MSK();
      logger.info("Scan: START");
    }
    export function end() {
      const now = MSK();
      const diff = moment.duration(now.diff(ScanStart));
      const displayDiff = (diff.hours() ? diff.hours() + " hr " : "")
        + (diff.minutes() ? diff.minutes() + " min " : "") + diff.seconds() + " sec.";
      logger.info("Scan: END. Took %s", displayDiff);
    }
    export function skipScan() {
      logger.info("Scan: SKIP (no data about last scanned message)");
    }
    export function messageOk(messageId: string, delegateId: string) {
      logger.info({ messageId, delegateId }, "Scan: successful partnership, respect");
    }
    export function messageWrong(messageId: string, delegateId: string, errno: ConditionErrno, alert: boolean) {
      logger.info({ messageId, delegateId, errno, alert }, "Scan: wrong partnership, delete");
    }
    export function messageDuplicate(messageId: string, delegateId: string) {
      logger.info({ messageId, delegateId }, "Scan: duplicate partnership, delete");
    }
  }

  export namespace GeneralScan {
    export function stopOnRatelimit(waitDelay: number | null) {
      logger.warn({ waitDelay }, "GeneralScan: got rate limited");
    }
    export function stopOnComplete() {
      logger.warn("GeneralScan: SUCCESSFULLY COMPLETED !!!");
    }
    export function messageOk(messageId: string, delegateId: string) {
      logger.trace({ messageId, delegateId }, "GeneralScan: successful partnership, respect");
    }
    export function messageDelete(messageId: string, delegateId: string, errno: ConditionErrno) {
      logger.trace({ messageId, delegateId, errno }, "GeneralScan: delete partnership");
    }
    export function applyChanges(state: ResultState) {
      const { lastMessage } = state;
      const statsChanges = Object.fromEntries(Array.from(state.stats.entries()));
      logger.trace({ lastMessage, statsChanges }, "GeneralScan: update state, apply changes");
    }
  }
}
