import TelegramBot = require('node-telegram-bot-api');
export class DlVars {
  isUploading: boolean;
  isDownloadAllowed: number;
  isDownloading: boolean;
  readonly tgFromId: number;
  readonly tgUsername: string;
  readonly tgChatId: number;
  readonly tgMessageId: number;
  /**
   * A subdirectory of 'constants.ARIA_DOWNLOAD_LOCATION.length', where this download
   * will be downloaded. This directory should always have a 36 character name.
   */
  readonly downloadDir: string;

  constructor(public gid: string, msg: TelegramBot.Message, readonly isTar: boolean, downloadDir: string) {
    var username: string;
    if (msg.from.username) {
      username = '@' + msg.from.username;
    } else {
      username = msg.from.first_name;
    }

    this.downloadDir = downloadDir;
    this.tgFromId = msg.from.id;
    this.tgUsername = username;
    this.tgChatId = msg.chat.id;
    this.tgMessageId = msg.message_id;
  }
}
