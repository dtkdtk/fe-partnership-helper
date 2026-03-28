import { logger, MSK } from "#corelib";
import moment from "moment";
import { ConditionErrno } from "./check_conditions.js";
import { ResultState } from "./general_scan.js";


export namespace Log {
  export namespace Listen {
    export function messageWrong(messageId: string, delegateId: string, errno: number) {
      logger.info({ messageId, delegateId, errno }, "Listen: wrong partnership, must delete");
    }
    export function messageOld(deletedMessageId: string, actualMessageId: string) {
      logger.info({ deletedMessageId, actualMessageId },
        "Listen: wrong partnership, delete");
    }
    export function messageOk(messageId: string, delegateId: string) {
      logger.info({ messageId, delegateId }, "Listen: successful partnership, respect");
    }
    export function externalDelete(messageId: string, delegateId: string) {
      logger.info({ messageId, delegateId }, "Listen: partnership deleted by author / admin");
    }
  }

  export namespace DMAlert {
    export function deletePartnership(
      messageId: string, delegateId: string, success: boolean
    ) {
      logger.info({ messageId, delegateId, success },
        "DMAlert: wrong partnership not deleted, alert about auto delete");
    }
    export function deletePartnershipFallback(
      messageId: string, delegateId: string, success: boolean
    ) {
      logger.info({ messageId, delegateId, success },
        "DMAlert: failed to alert (DM closed), send to staff channel");
    }
    export function partner(
      partnerId: string, guildIds: string[], success: boolean
    ) {
      logger.info({ partnerId, guildIds, success }, "DMAlert: new partner");
    }
  }

  export namespace Partners {
    export function newPartner(partnerId: string, partnerGuildId: string, staffId: string) {
      logger.info({ partnerId, partnerGuildId, staffId }, "Partners: new partner");
    }
    export function deleteOld(
      oldPartnerId: string, newPartnerId: string, partnerGuildId: string, staffId: string
    ) {
      logger.info({ oldPartnerId, newPartnerId, partnerGuildId, staffId },
        "Partners: delete old partner (replace with new)");
    }
    export function leave(partnerId: string, lastDelegateId: string | null) {
      logger.info({ partnerId, lastDelegateId }, "Partners: partner left, return them!");
    }
  }

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
    export function silentMode() {
      logger.info("Scan: silent mode (no data about last scanned message)");
    }
    export function messageOk(
      messageId: string, delegateId: string, silent: boolean
    ) {
      logger.info(
        { messageId, delegateId, silent },
        "Scan: successful partnership, " + (silent ? "NO respect (silent)" : "respect")
      );
    }
    export function messageWrong(
      messageId: string, delegateId: string, errno: ConditionErrno, alert: boolean
    ) {
      logger.info({ messageId, delegateId, errno, alert }, "Scan: wrong partnership, delete");
    }
    export function messageDuplicate(messageId: string, delegateId: string) {
      logger.info({ messageId, delegateId }, "Scan: duplicate partnership, delete");
    }
  }

  export namespace GeneralScan {
    export function begin() {
      logger.info("GeneralScan: beginning / continuing");
    }
    export function skipCuzCompleted() {
      logger.info("GeneralScan: skip (because completed)");
    }
    export function stopOnRatelimit(waitDelay: number | null) {
      logger.warn({ waitDelay }, "GeneralScan: got rate limited");
    }
    export function stopOnComplete() {
      logger.warn("GeneralScan: SUCCESSFULLY COMPLETED !!!");
    }

    export function messageOk(
      messageId: string,
      delegateId: string,
      inviteCode: string,
      isCached: boolean | null,
    ) {
      logger.trace({ messageId, delegateId, inviteCode, isCached }, "GeneralScan: successful partnership, respect");
    }
    export function messageDelete(
      messageId: string,
      delegateId: string,
      errno: ConditionErrno,
      inviteCode: string | null = null,
      isCached: boolean | null = null,
    ) {
      logger.trace({ messageId, delegateId, errno, inviteCode, isCached }, "GeneralScan: delete partnership");
    }
    export function ignoreUnfetched(
      messageId: string,
      delegateId: string,
      inviteCode: string,
      isCached: boolean | null,
    ) {
      logger.trace({ messageId, delegateId, inviteCode, isCached }, "GeneralScan: ignore partnership with unfetched invite");
    }
    export function applyChanges(state: ResultState) {
      const { lastMessage } = state;
      const statsChanges = Object.fromEntries(Array.from(state.changesMap?.entries() ?? []));
      logger.trace({ lastMessage, statsChanges }, "GeneralScan: update state, apply changes");
    }
    export function mandatoryPause(adminId: string | null) {
      logger.warn({ adminId }, "GeneralScan: mandatory pause");
    }
    export function mandatoryResume(adminId: string | null) {
      logger.warn({ adminId }, "GeneralScan: mandatory resume");
    }
  }

  export namespace EditServer {
    export function addBlacklist(guildId: string, adminId: string, reason: string) {
      logger.warn({ guildId, adminId, reason }, "EditServer: add server to blacklist");
    }
    export function removeBlacklist(guildId: string, adminId: string) {
      logger.warn({ guildId, adminId }, "EditServer: remove server from blacklist");
    }
  }
}
