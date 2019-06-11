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
  statusMsgsList: Message[];

  constructor(msg: TelegramBot.Message, statusMsg: TelegramBot.Message, readonly isTar: boolean) {
    var username: string;
    if (msg.from.username) {
      username = '@' + msg.from.username;
    } else {
      username = msg.from.first_name;
    }
    var statusList = [{
      message_id: statusMsg.message_id,
      chat: {
        id: statusMsg.chat.id,
        all_members_are_administrators: statusMsg.chat.all_members_are_administrators
      },
      from: { id: statusMsg.from.id }
    }];

    this.isDownloading = true;
    this.tgFromId = msg.from.id;
    this.tgUsername = username;
    this.tgChatId = msg.chat.id;
    this.tgMessageId = msg.message_id;
    this.tgStatusMessageId = statusMsg.message_id;
    this.statusMsgsList = statusList;
  }
}

// TODO: WTF was I thinking when I decided to copy msgs into this? Get rid of it :/
export interface Message {
  message_id: number,
  chat: {
    id: number,
    all_members_are_administrators: boolean
  },
  from: {
    id: number
  }
}
