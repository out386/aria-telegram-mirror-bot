import constants = require('../.constants');
import http = require('http');
import ariaTools = require('../download_tools/aria-tools');
import TelegramBot = require('node-telegram-bot-api');
import details = require('../dl_model/detail');
import dlm = require('../dl_model/dl-manager');
var dlManager = dlm.DlManager.getInstance();

export async function deleteMsg(bot: TelegramBot, msg: TelegramBot.Message, delay?: number): Promise<any> {
  if (delay) await sleep(delay);

  bot.deleteMessage(msg.chat.id, msg.message_id.toString())
    .catch(err => {
      console.log(`Failed to delete message. Does the bot have message delete permissions for this chat? ${err.message}`);
    });
}

export function editMessage(bot: TelegramBot, msg: TelegramBot.Message, text: string, suppressError?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (msg && msg.chat && msg.chat.id && msg.message_id) {
      bot.editMessageText(text, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'HTML'
      })
        .then(resolve)
        .catch(err => {
          if (err.message !== suppressError) {
            console.log(`editMessage error: ${err.message}`);
          }
          reject(err);
        });
    } else {
      resolve();
    }
  });
}

export function sendMessage(bot: TelegramBot, msg: TelegramBot.Message, text: string, delay?: number,
  callback?: (res: TelegramBot.Message) => void, quickDeleteOriginal?: boolean): void {
  if (!delay) delay = 10000;
  bot.sendMessage(msg.chat.id, text, {
    reply_to_message_id: msg.message_id,
    parse_mode: 'HTML'
  })
    .then((res) => {
      if (callback) callback(res);
      if (delay > -1) {
        deleteMsg(bot, res, delay);
        if (quickDeleteOriginal) {
          deleteMsg(bot, msg);
        } else {
          deleteMsg(bot, msg, delay);
        }
      }
    })
    .catch((err) => {
      console.error(`sendMessage error: ${err.message}`);
    });
}

export function sendUnauthorizedMessage(bot: TelegramBot, msg: TelegramBot.Message): void {
  sendMessage(bot, msg, `You aren't authorized to use this bot here.`);
}

export function sendMessageReplyOriginal(bot: TelegramBot, dlDetails: details.DlVars, message: string): Promise<TelegramBot.Message> {
  return bot.sendMessage(dlDetails.tgChatId, message, {
    reply_to_message_id: dlDetails.tgMessageId,
    parse_mode: 'HTML'
  });
}

export function sleep(ms: number): Promise<any> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isAuthorized(msg: TelegramBot.Message, skipDlOwner?: boolean): number {
  for (var i = 0; i < constants.SUDO_USERS.length; i++) {
    if (constants.SUDO_USERS[i] === msg.from.id) return 0;
  }
  if (!skipDlOwner && msg.reply_to_message) {
    var dlDetails = dlManager.getDownloadByMsgId(msg.reply_to_message);
    if (dlDetails && msg.from.id === dlDetails.tgFromId) return 1;
  }
  if (constants.AUTHORIZED_CHATS.indexOf(msg.chat.id) > -1 &&
    msg.chat.all_members_are_administrators) return 2;
  if (constants.AUTHORIZED_CHATS.indexOf(msg.chat.id) > -1) return 3;
  return -1;
}

export function isAdmin(bot: TelegramBot, msg: TelegramBot.Message, callback: (err: string, isAdmin: boolean) => void): void {
  bot.getChatAdministrators(msg.chat.id)
    .then(members => {
      for (var i = 0; i < members.length; i++) {
        if (members[i].user.id === msg.from.id) {
          callback(null, true);
          return;
        }
      }
      callback(null, false);
    })
    .catch(() => {
      callback(null, false);
    });
}

/**
 * Notifies an external webserver once a download is complete.
 * @param {boolean} successful True is the download completed successfully
 * @param {string} gid The GID of the downloaded file
 * @param {number} originGroup The Telegram chat ID of the group where the download started
 * @param {string} driveURL The URL of the uploaded file
 */
export function notifyExternal(dlDetails: details.DlVars, successful: boolean, gid: string, originGroup: number, driveURL?: string): void {
  if (!constants.DOWNLOAD_NOTIFY_TARGET || !constants.DOWNLOAD_NOTIFY_TARGET.enabled) return;
  ariaTools.getStatus(dlDetails, (err, message, filename, filesize) => {
    var name;
    var size;
    if (!err) {
      if (filename !== 'Metadata') name = filename;
      if (filesize !== '0B') size = filesize;
    }

    // TODO: Check which vars are undefined and make those null
    const data = JSON.stringify({
      successful: successful,
      file: {
        name: name,
        driveURL: driveURL,
        size: size
      },
      originGroup: originGroup
    });

    const options = {
      host: constants.DOWNLOAD_NOTIFY_TARGET.host,
      port: constants.DOWNLOAD_NOTIFY_TARGET.port,
      path: constants.DOWNLOAD_NOTIFY_TARGET.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    var req = http.request(options);
    req.on('error', (e) => {
      console.error(`notifyExternal failed: ${e.message}`);
    });
    req.write(data);
    req.end();
  });
}
