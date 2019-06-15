import TelegramBot = require('node-telegram-bot-api');
export class DlVars {
  isUploading: boolean;
  downloadGid: string;
  messagesSinceStart: number;
  isDownloadAllowed: number;
  isDownloading: boolean;
  readonly tgFromId: number;
  readonly tgUsername: string;
  readonly tgChatId: number;
  readonly tgMessageId: number;
  readonly tgStatusMessageId: number;
  statusMsgsList: TelegramBot.Message[];

  constructor(msg: TelegramBot.Message, statusMsg: TelegramBot.Message, readonly isTar: boolean) {
    var username: string;
    if (msg.from.username) {
      username = '@' + msg.from.username;
    } else {
      username = msg.from.first_name;
    }

    this.isDownloading = true;
    this.tgFromId = msg.from.id;
    this.tgUsername = username;
    this.tgChatId = msg.chat.id;
    this.tgMessageId = msg.message_id;
    this.tgStatusMessageId = statusMsg.message_id;
    this.statusMsgsList = [statusMsg];
  }
}
