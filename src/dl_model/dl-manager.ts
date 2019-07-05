import TelegramBot = require('node-telegram-bot-api');
import dlDetails = require('./detail');

export class DlManager {
  private static instance: DlManager;

  private allDls: any = {};
  private activeDls: any = {};

  /**
   * Stores all general status messages. General status messages show the status
   * of all downloads. Each chat can have at most 1 general status message.
   * Key: Chat ID: number
   * Value: Status message: TelegramBot.Message
   */
  private statusAll: any = {};
  private statusLock: any = {};

  private constructor() {
  }

  static getInstance(): DlManager {
    if (!DlManager.instance) {
      DlManager.instance = new DlManager();
    }
    return DlManager.instance;
  }

  addDownload(gid: string, dlDir: string, msg: TelegramBot.Message, isTar: boolean) {
    var detail = new dlDetails.DlVars(gid, msg, isTar, dlDir);
    this.allDls[gid] = detail;
  }

  getDownloadByGid(gid: string): dlDetails.DlVars {
    return this.allDls[gid];
  }

  /**
   * Mark a download as active, once Aria2 starts downloading it.
   * @param dlDetails The details for the download
   */
  moveDownloadToActive(dlDetails: dlDetails.DlVars) {
    dlDetails.isDownloading = true;
    dlDetails.isUploading = false;
    this.activeDls[dlDetails.gid] = dlDetails;
  }

  /**
   * Update the GID of a download. This is needed if a download causes Aria2c to start
   * another download, for example, in the case of BitTorrents. This function also
   * marks the download as inactive, because we only find out about the new GID when
   * Aria2c calls onDownloadComplete, at which point, the metadata download has been
   * completed, but the files download hasn't yet started.
   * @param oldGid The GID of the original download (the download metadata)
   * @param newGid The GID of the new download (the files specified in the metadata)
   */
  changeDownloadGid(oldGid: string, newGid: string) {
    var dlDetails = this.getDownloadByGid(oldGid);
    this.deleteDownload(oldGid);
    dlDetails.gid = newGid;
    dlDetails.isDownloading = false;
    this.allDls[newGid] = dlDetails;
  }

  /**
   * Gets a download by the download command message, or the original reply
   * to the download command message.
   * @param msg The download command message
   */
  getDownloadByMsgId(msg: TelegramBot.Message): dlDetails.DlVars {
    for (var dl of Object.keys(this.allDls)) {
      var download: dlDetails.DlVars = this.allDls[dl];
      if (download.tgChatId === msg.chat.id &&
        (download.tgMessageId === msg.message_id)) {
        return download;
      }
    }
    return null;
  }

  deleteDownload(gid: string) {
    delete this.allDls[gid];
    delete this.activeDls[gid];
  }

  /**
   * Call the callback function for each download.
   * @param callback 
   */
  forEachDownload(callback: (dlDetails: dlDetails.DlVars) => void) {
    for (var key of Object.keys(this.allDls)) {
      var details = this.allDls[key];
      callback(details);
    }
  }

  deleteStatus(chatId: number) {
    delete this.statusAll[chatId];
  }

  /**
   * Returns the general status message for a target chat.
   * @param chatId The chat ID of the target chat
   * @returns {TelegramBot.Message} The status message for the target group
   */
  getStatus(chatId: number): TelegramBot.Message {
    return this.statusAll[chatId];
  }

  addStatus(msg: TelegramBot.Message) {
    this.statusAll[msg.chat.id] = msg;
  }

  /**
   * Call the callback function for each general status message.
   * @param callback 
   */
  forEachStatus(callback: (message: TelegramBot.Message) => void) {
    for (var key of Object.keys(this.statusAll)) {
      var message: TelegramBot.Message = this.statusAll[key];
      callback(message);
    }
  }

  /**
   * Prevents race conditions when multiple status messages are sent in a short time.
   * Makes sure that a status message has been properly sent before allowing the next one.
   * @param msg The Telegram message that caused this status update
   * @param toCall The function to call to perform the status update
   */
  setStatusLock(msg: TelegramBot.Message, toCall: (msg: TelegramBot.Message, keep: boolean) => Promise<any>) {
    if (!this.statusLock[msg.chat.id]) {
      this.statusLock[msg.chat.id] = Promise.resolve();
    }

    this.statusLock[msg.chat.id] = this.statusLock[msg.chat.id].then(() => {
      return toCall(msg, true);
    });
  }
}