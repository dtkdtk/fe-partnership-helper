import {
  AsceticInvite,
  deletePartnership,
  getServerData,
  incrementDelegateStats,
  initServerData_byInvite,
  markAsLatest,
  updateServerData_byInvite,
} from "#core_functional";
import {
  ConfigEnv,
  DB_Misc,
  MessageInvites,
  MiscDbData,
  MSK,
  rateLimitSafe,
  resources,
} from "#corelib";
import eds from "@eds-fw/framework";
import {
  Client,
  Collection,
  FetchMessagesOptions,
  GuildTextBasedChannel,
  Message,
} from "discord.js";
import { DelegateAlerts } from "./alerts.js";
import { ConditionErrno, validateConditions } from "./check_conditions.js";
import { runGeneralScan } from "./general_scan.js";
import { Log } from "./log.js";

const ReactionsQueue = new eds.ActionQueue(3_000);
const CheckedGuilds = new Set<string>();

export async function performPartnershipsScan(client: Client) {
  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  if (!guild) return;

  for (const channelId of ConfigEnv.PARTNERSHIP_CHANNELS_ID) {
    const channel = await eds.sfChannel(guild?.channels, channelId);
    if (!channel?.isSendable()) continue;
    await new PartnershipChannelScanner(client, channel).start();
    CheckedGuilds.clear();
  }
  runGeneralScan(client);
}

class PartnershipChannelScanner {
  miscDbData!: MiscDbData;
  lastScannedMessageId: string | undefined;
  lastScanTimestamp: number = 0;
  notificationWatermark = MSK().date(-3);
  fetchOptions: FetchMessagesOptions = { limit: 100, cache: false };
  currentMsgTimestamp: number | undefined;

  /** `{message => guildID}` */
  currentDayTexts = new Collection<Message<true>, string>();
  currentDayDate: Date | undefined;

  get readonlyMode() {
    return !this.lastScannedMessageId && !this.lastScanTimestamp;
  }
  get needAlert() {
    return (
      !this.readonlyMode &&
      MSK(this.currentMsgTimestamp).isAfter(this.notificationWatermark)
    );
  }

  constructor(
    public client: Client,
    public channel: GuildTextBasedChannel,
  ) {}

  async start() {
    this.miscDbData = await DB_Misc.findOneAsync({ _id: "1" });
    this.lastScannedMessageId =
      this.miscDbData.last_scanned_message[this.channel.id];
    if (this.lastScannedMessageId) {
      const message = await eds.sfMessage(
        this.channel.messages,
        this.lastScannedMessageId,
      );
      this.lastScanTimestamp = message?.createdTimestamp ?? 0;
    }

    if (!this.lastScannedMessageId && !this.lastScanTimestamp)
      Log.Scan.silentMode();
    Log.Scan.start();
    let toContinue = true;
    while (toContinue) {
      toContinue = await this.performScan();
      await eds.wait(3_000);
      if (toContinue) Log.Scan.newCycle();
    }
    Log.Scan.end();

    if (this.lastScannedMessageId)
      markAsLatest(this.channel.id, this.lastScannedMessageId);

    await this.postCleanup();
  }

  private async performScan(): Promise<boolean> {
    if (!this.readonlyMode) this.fetchOptions.after = this.lastScannedMessageId;
    const messages = await rateLimitSafe(
      this.channel.messages.fetch(this.fetchOptions)).catch(() => {});
    if (!messages?.size) return false;
console.log(messages.map((m, i) => [i, m.content]).join("\n"))
    messages.sort((A, B) => B.createdTimestamp - A.createdTimestamp); //Начинаем с новых

    //Коллекция начинается с самых новых сообщений
    for (const msg of messages.values()) {
      if (await this.scanMessage(msg)) return false;
    }
    return !this.readonlyMode; //to continue?
  }

  /** @returns {true} если сканирование завершено */
  private async scanMessage(msg: Message<true>): Promise<true | undefined> {
    this.currentMsgTimestamp = msg.createdTimestamp;
    const invite = await validateConditions(msg, { checkCooldown: false });
    if (invite === ConditionErrno.just_return) {
      await deletePartnership(msg);
      return;
    }
    if (msg.id == this.lastScannedMessageId) {
      await this.checkAllDayTexts();
      return true;
    }
    else if (typeof invite === "number") {
      await deletePartnership(msg);
      if (this.needAlert) DelegateAlerts.deletePartnership(msg, invite, true);
      Log.Scan.messageWrong(msg.id, msg.author.id, invite, this.needAlert);
      return;
    }
    else if (invite.guild) {
      await this.checkInvite(invite, msg);
    }
  }

  private async checkInvite(invite: AsceticInvite, msg: Message<true>) {
    if (CheckedGuilds.has(invite.guild.id) && ConfigEnv.DELETE_OLD_TEXTS) {
      await deletePartnership(msg);
      Log.Scan.messageDuplicate(msg.id, msg.author.id);
      return;
    }
    MessageInvites.set(msg.id, invite.guild.id);
    CheckedGuilds.add(invite.guild.id);
    const serverData =
      (await getServerData(invite.guild.id)) ??
      (await initServerData_byInvite(invite));

    updateServerData_byInvite(
      serverData!,
      invite,
      msg.author.id,
      msg.createdTimestamp,
    );

    this.currentDayDate ??= msg.createdAt;
    if (
      msg.createdAt.getDate() != this.currentDayDate.getDate() ||
      msg.createdAt.getMonth() != this.currentDayDate.getMonth()
    ) {
      this.currentDayDate = msg.createdAt;
      this.currentDayTexts.reverse();
      await this.checkAllDayTexts();
      this.currentDayTexts.clear();
    }
    this.currentDayTexts.set(msg, invite.guild.id);
  }

  private async checkAllDayTexts() {
    const cooldownChecked = new Set<string>();
    //Теперь мы можем проверить, нет ли нарушений дневного КД.
    //Коллекция начинается со старых сообщений (начало дня)
    for (const [msg, guildId] of this.currentDayTexts.entries()) {
console.log(msg.content)
      if (ConfigEnv.REQUIREMENT_ONCE_PER_DAY && cooldownChecked.has(guildId)) {
        await deletePartnership(msg);
        if (this.needAlert)
          DelegateAlerts.deletePartnership(msg, ConditionErrno.cooldown, true);
        Log.Scan.messageWrong(
          msg.id,
          msg.author.id,
          ConditionErrno.cooldown,
          this.needAlert,
        );
      }
      else {
        cooldownChecked.add(guildId);
        Log.Scan.messageOk(msg.id, msg.author.id, this.readonlyMode);
        if (msg.createdTimestamp > this.lastScanTimestamp) {
          this.lastScannedMessageId = msg.id;
          this.lastScanTimestamp = msg.createdTimestamp;
        }
        if (!this.readonlyMode) {
          incrementDelegateStats(msg.author.id, msg.createdTimestamp);
          deferReaction(msg);
        }
      }
    }
  }

  private async postCleanup() {
    const messages = await rateLimitSafe(
      this.channel.messages.fetch({ limit: 100, cache: false })).catch(() => {});
    if (!messages) return;
    for (const msg of messages.values()) {
      if (msg.author.bot) await deletePartnership(msg);
    }
  }
}

function deferReaction(message: Message) {
  ReactionsQueue.push(async () => {
    await message.react(resources.button_icons.yes).catch(() => {});
  });
}
