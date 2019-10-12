import TelegramBot = require('node-telegram-bot-api');
export class DlVars {
  isUploading: boolean;
  uploadedBytes: number;
  uploadedBytesLast: number;
  lastUploadCheckTimestamp: number;
  isDownloadAllowed: number;
  isDownloading: boolean;
  gid: string;
  readonly tgFromId: number;
  readonly tgUsername: string;
  readonly tgRepliedUsername: string;
  readonly tgChatId: number;
  readonly tgMessageId: number;
  readonly startTime: number;
  /**
   * A subdirectory of 'constants.ARIA_DOWNLOAD_LOCATION.length', where this download
   * will be downloaded. This directory should always have a 36 character name.
   */
  readonly downloadDir: string;

  constructor(gid: string, msg: TelegramBot.Message, readonly isTar: boolean, downloadDir: string) {
    this.tgUsername = getUsername(msg);
    if (msg.reply_to_message) {
      this.tgRepliedUsername = getUsername(msg.reply_to_message);
    }

    this.gid = gid;
    this.downloadDir = downloadDir;
    this.tgFromId = msg.from.id;
    this.tgChatId = msg.chat.id;
    this.tgMessageId = msg.message_id;
    this.startTime = new Date().getTime();
    this.uploadedBytes = 0;
    this.uploadedBytesLast = 0;
  }
}

function getUsername(msg: TelegramBot.Message): string {
  if (msg.from.username) {
    return `@${msg.from.username}`;
  } else {
    return `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
  }
}
