import TelegramBot = require('node-telegram-bot-api');
export class DlVars {
  isUploading: boolean;
  isDownloadAllowed: number;
  isDownloading: boolean;
  readonly tgFromId: number;
  readonly tgUsername: string;
  readonly tgChatId: number;
  readonly tgMessageId: number;
  readonly tgStatusMessageId: number;
  readonly origStatusMsg :TelegramBot.Message;

  constructor(public gid: string, msg: TelegramBot.Message, statusMsg: TelegramBot.Message, readonly isTar: boolean) {
    var username: string;
    if (msg.from.username) {
      username = '@' + msg.from.username;
    } else {
      username = msg.from.first_name;
    }

    this.tgFromId = msg.from.id;
    this.tgUsername = username;
    this.tgChatId = msg.chat.id;
    this.tgMessageId = msg.message_id;
    this.tgStatusMessageId = statusMsg.message_id;
    this.origStatusMsg = statusMsg;
  }
}
