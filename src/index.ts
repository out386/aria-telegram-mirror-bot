import TelegramBot = require('node-telegram-bot-api');
import downloadUtils = require('./download_tools/utils');
import ariaTools = require('./download_tools/aria-tools.js');
import constants = require('./.constants.js');
import msgTools = require('./msg-tools.js');
import dlm = require('./dl_model/dl-manager');
import driveList = require('./drive/drive-list.js');
import driveUtils = require('./drive/drive-utils.js');
import details = require('./dl_model/detail');
const bot = new TelegramBot(constants.TOKEN, { polling: true });
var websocketOpened = false;
var statusInterval: NodeJS.Timeout;
var dlManager = dlm.DlManager.getInstance();

initAria2();

bot.on("polling_error", msg => console.log(msg.message));

bot.onText(/^\/start/, (msg) => {
  if (msgTools.isAuthorized(msg) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    sendMessage(msg, 'You should know the commands already. Happy mirroring.');
  }
});

bot.onText(/^\/mirrortar (.+)/i, (msg, match) => {
  if (msgTools.isAuthorized(msg) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    mirror(msg, match, true);
  }
});

bot.onText(/^\/mirror (.+)/i, (msg, match) => {
  if (msgTools.isAuthorized(msg) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    mirror(msg, match);
  }
});

/**
 * Start a new download operation. Make sure that this is triggered by an
 * authorized user, because this function itself does not check for that.
 * @param {Object} msg The Message that triggered the download
 * @param {Array} match Message matches
 * @param {boolean} isTar Decides if this download should be archived before upload
 */
function mirror(msg: TelegramBot.Message, match: RegExpExecArray, isTar?: boolean) {
  if (websocketOpened) {
    if (downloadUtils.isDownloadAllowed(match[1])) {
      prepDownload(msg, match[1], isTar);
    } else {
      sendMessage(msg, `Download failed. Blacklisted URL.`);
    }
  } else {
    sendMessage(msg, `Websocket isn't open. Can't download`);
  }
}

bot.onText(/^\/mirrorStatus/i, (msg) => {
  if (msgTools.isAuthorized(msg) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    sendStatusMessage(msg);
  }
});

function getSingleStatus(dlDetails: details.DlVars, msg?: TelegramBot.Message): Promise<string> {
  return new Promise((resolve, reject) => {
    var authorizedCode;
    if (msg) {
      authorizedCode = msgTools.isAuthorized(msg);
    } else {
      authorizedCode = 1;
    }

    if (authorizedCode > -1) {
      ariaTools.getStatus(dlDetails.gid, (err, message, filename) => {
        if (err) {
          reject(`Error: ${dlDetails.gid} - ${err}`);
        } else {
          if (dlDetails.isUploading) {
            resolve(`<i>${filename}</i> - Uploading`);
          } else {
            handleDisallowedFilename(dlDetails, filename);
            resolve(message);
          }
        }
      });
    } else {
      reject(`You aren't authorized to use this bot here.`);
    }
  });
}

bot.onText(/^\/list (.+)/i, (msg, match) => {
  if (msgTools.isAuthorized(msg) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    driveList.listFiles(match[1], (err, res) => {
      if (err) {
        sendMessage(msg, 'Failed to fetch the list of files');
      } else {
        sendMessage(msg, res, 60000);
      }
    });
  }
});

bot.onText(/^\/getFolder/i, (msg) => {
  if (msgTools.isAuthorized(msg) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    sendMessage(msg,
      '<a href = \'' + driveUtils.getFileLink(constants.GDRIVE_PARENT_DIR_ID, true) + '\'>Drive mirror folder</a>',
      60000);
  }
});

bot.onText(/^\/cancelMirror/i, (msg) => {
  var authorizedCode = msgTools.isAuthorized(msg);
  if (msg.reply_to_message) {
    var dlDetails = dlManager.getDownloadByMsgId(msg.reply_to_message);
    if (dlDetails) {
      if (authorizedCode > -1 && authorizedCode < 3) {
        cancelMirror(dlDetails, msg);
      } else if (authorizedCode === 3) {
        msgTools.isAdmin(bot, msg, (e, res) => {
          if (res) {
            cancelMirror(dlDetails, msg);
          } else {
            sendMessage(msg, 'You do not have permission to do that.');
          }
        });
      } else {
        sendMessage(msg, 'You cannot use this bot here.');
      }
    } else {
      sendMessage(msg, `Reply to the command message, or the bot's download confirmation message` +
        ` for the download that you want to cancel. Also make sure that the download even active.`);
    }
  } else {
    sendMessage(msg, `Reply to the command message, or the bot's download confirmation message` +
      ` for the download that you want to cancel.`);
  }
});

function cancelMirror(dlDetails: details.DlVars, cancelMsg?: TelegramBot.Message) {
  if (dlDetails.isUploading) {
    if (cancelMsg) {
      sendMessage(cancelMsg, 'Upload in progress. Cannot cancel.');
    }
  } else {
    ariaTools.stopDownload(dlDetails.gid, () => {
      // Not sending a message here, because a cancel will fire
      // the onDownloadStop notification, which will notify the
      // person who started the download

      if (cancelMsg && dlDetails.tgChatId !== cancelMsg.chat.id) {
        // Notify if this is not the chat the download started in
        sendMessage(cancelMsg, 'The download was canceled.');
      }
    });
  }
}

/**
 * Cancels the download if its filename contains a string from
 * constants.ARIA_FILTERED_FILENAMES. Call this on every status message update,
 * because the file name might not become visible for the first few status
 * updates, for example, in case of BitTorrents.
 *
 * @param {String} filename The name of the downloaded file/top level directory
 * @returns {boolean} False if file name is disallowed, true otherwise,
 *                    or if undetermined
 */
function handleDisallowedFilename(dlDetails: details.DlVars, filename: string): boolean {
  if (dlDetails) {
    if (dlDetails.isDownloadAllowed === 0) return false;
    if (dlDetails.isDownloadAllowed === 1) return true;
    if (!filename) return true;

    var isAllowed = downloadUtils.isFilenameAllowed(filename);
    if (isAllowed === 0) {
      dlDetails.isDownloadAllowed = 0;
      if (dlDetails.isDownloading && !dlDetails.isUploading) {
        cancelMirror(dlDetails);
      }
      return false;
    } else if (isAllowed === 1) {
      dlDetails.isDownloadAllowed = 1;
    }
  }
  return true;
}

function prepDownload(msg: TelegramBot.Message, match: string, isTar: boolean) {
  sendMessage(msg, 'Preparing', -1, statusMessage => {
    ariaTools.addUri(match, (err, gid) => {
      if (err) {
        var message = `Failed to start the download. ${err.message}`;
        console.error(message);
        cleanupDownload(gid, message);
      } else {
        dlManager.addDownload(gid, msg, statusMessage, isTar);
        console.log(`download:${match} gid:${gid}`);
      }
    });
  });

}

function sendMessage(msg: TelegramBot.Message, text: string, delay?: number,
  callback?: (res: TelegramBot.Message) => void, quickDeleteOriginal?: boolean) {
  if (!delay) delay = 5000;
  bot.sendMessage(msg.chat.id, text, {
    reply_to_message_id: msg.message_id,
    parse_mode: 'HTML'
  })
    .then((res) => {
      if (callback) callback(res);
      if (delay > -1) {
        msgTools.deleteMsg(bot, res, delay);
        if (quickDeleteOriginal) {
          msgTools.deleteMsg(bot, msg);
        } else {
          msgTools.deleteMsg(bot, msg, delay);
        }
      }
    })
    .catch((ignored) => { });
}

function sendUnauthorizedMessage(msg: TelegramBot.Message) {
  sendMessage(msg, `You aren't authorized to use this bot here.`);
}

function sendMessageReplyOriginal(dlDetails: details.DlVars, message: string): Promise<TelegramBot.Message> {
  return bot.sendMessage(dlDetails.tgChatId, message, {
    reply_to_message_id: dlDetails.tgMessageId,
    parse_mode: 'HTML'
  })
}

/**
 * Get a single status message for all active and queued downloads.
 */
function getStatusMessage(callback: (err: string, message: string) => void) {
  var singleStatusArr: Promise<string>[] = [];

  for (var gid of Object.keys(dlManager.allDls)) {
    var dlDetails: details.DlVars = dlManager.allDls[gid];
    singleStatusArr.push(getSingleStatus(dlDetails));
  }

  Promise.all(singleStatusArr)
    .then(statusArr => {
      callback(null, statusArr.reduce((prev, curr, i) => {
        return i > 0 ? `${prev}\n${curr}` : `${curr}`;
      }));
    })
    .catch(error => {
      console.log(`getStatusMessage: ${error}`);
      callback(error, null);
    })
}

/**
 * Sends a single status message for all active and queued downloads.
 */
function sendStatusMessage(msg: TelegramBot.Message) {
  var lastStatus = dlManager.getStatus(msg.chat.id);

  if (lastStatus) {
    msgTools.deleteMsg(bot, lastStatus);
    dlManager.deleteStatus(msg.chat.id);
  }

  getStatusMessage((err, messageText) => {
    var finalMessage = err ? err : messageText;
    sendMessage(msg, finalMessage, 60000, message => {
      dlManager.addStatus(message);
    }, true);
  });
}

/**
 * Updates the original status message sent by the bot as a reply to the
 * download command message.
 */
function updateStatusMessage(dlDetails: details.DlVars, text?: string) {
  if (text) {
    editMessage(dlDetails.origStatusMsg, text);
  } else {
    getSingleStatus(dlDetails)
      .then(res => {
        editMessage(dlDetails.origStatusMsg, res);
      })
      .catch(err => {
        console.log(`updateStatusMessage: ${err}`);
        editMessage(dlDetails.origStatusMsg, err);
      })
  }
}

/**
 * Updates all general status messages
 */
function updateAllGeneralStatus() {
  getStatusMessage((err, messageText) => {
    var finalMessage = err ? err : messageText;
    dlManager.forEachStatus(statusMessage => {
      editMessage(statusMessage, finalMessage);
    });
  });
}

/**
 * Updates all general status messages, and all single status messages
 * sent to individual download commands.
 */
function updateAllStatus() {
  var dlCount = 0;
  // TODO: Both updateAllGeneralStatus() and updateStatusMessage() fetch the 
  // status of each individual download. Rewrite to get each status only once.
  updateAllGeneralStatus();
  dlManager.forEachDownload(dlDetails => {
    updateStatusMessage(dlDetails);
  })
}

function editMessage(msg: TelegramBot.Message, text: string) {
  if (msg && msg.chat && msg.chat.id && msg.message_id) {
    bot.editMessageText(text, {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      parse_mode: 'HTML'
    })
      .catch(ignored => { });
  }
}

/**
 * Deletes the bot's original response to the download command, if less
 * than 10 messages have been sent to the group the download started in,
 * since the download was started. Deleted messages also count. Message
 * IDs are usually consecutive numbers, though that is not guaranteed by
 * the Telegram API. This function is not important enough for that to matter.
 **/
function deleteOrigReply(dlDetails: details.DlVars, lastStatusMsg: TelegramBot.Message) {
  if (lastStatusMsg.message_id - dlDetails.origStatusMsg.message_id < 10) {
    msgTools.deleteMsg(bot, dlDetails.origStatusMsg, 0);
  }
}

/**
 * After a download is complete (failed or otherwise), call this to clean up.
 * @param gid The gid for the download that just finished
 * @param message The message to send as the Telegram download complete message
 * @param url The public Google Drive URL for the uploaded file
 */
function cleanupDownload(gid: string, message: string, url?: string) {
  // TODO: Make sure to do this elsewhere
  // clearInterval(statusInterval);
  // statusInterval = null;
  var dlDetails = dlManager.getDownloadByGid(gid);
  if (dlDetails) {
    sendMessageReplyOriginal(dlDetails, message)
      .then(msg => deleteOrigReply(dlDetails, msg))
      .catch();
    updateStatusMessage(dlDetails, message);
    if (url) {
      msgTools.notifyExternal(true, gid, dlDetails.tgChatId, url);
    } else {
      msgTools.notifyExternal(false, gid, dlDetails.tgChatId);
    }
    dlManager.deleteDownload(gid);
    updateAllGeneralStatus();
  }
  ariaTools.getAriaFilePath(gid, (err, file) => {
    if (err || !file) {
      console.log('Failed to get the file to delete during cleanup');
    } else {
      downloadUtils.deleteDownloadedFile(file);
    }
  });
}

function initAria2() {
  ariaTools.openWebsocket((err) => {
    if (err) {
      console.error('A2C: Failed to open websocket. Run aria.sh first. Exiting.');
      process.exit();
    } else {
      websocketOpened = true;
      console.log('A2C: Websocket opened. Bot ready.');
    }
  });

  ariaTools.setOnDownloadStart((gid) => {
    var dlDetails = dlManager.getDownloadByGid(gid);
    if (!dlDetails) return;  // Can happen only in case of race conditions between start and stop download, not otherwise

    dlManager.moveDownloadToActive(dlDetails);
    console.log('start', gid);
    updateStatusMessage(dlDetails, 'Download started.');

    ariaTools.getStatus(gid, (err, message, filename) => {
      if (!err) {
        handleDisallowedFilename(dlDetails, filename);
      }
    });

    if (!statusInterval) {
      statusInterval = setInterval(updateAllStatus, 4000);
    }
  });

  ariaTools.setOnDownloadStop((gid) => {
    var dlDetails = dlManager.getDownloadByGid(gid);
    if (!dlDetails) return;  // Can happen only in case of race conditions between stop and download complete, not otherwise

    console.log('stop', gid);
    var message = 'Download stopped.';
    if (dlDetails.isDownloadAllowed === 0) {
      message += ' Blacklisted file name.';
    }
    cleanupDownload(gid, message);
  });

  ariaTools.setOnDownloadComplete((gid) => {
    var dlDetails = dlManager.getDownloadByGid(gid);
    if (!dlDetails) return;  // Can happen only in case of race conditions between stop and download complete, not otherwise

    ariaTools.getAriaFilePath(gid, (err, file) => {
      if (err) {
        console.log(`onDownloadComplete: ${err}`);
        var message = 'Upload failed. Could not get downloaded files.';
        cleanupDownload(gid, message);
        return;
      }

      if (file) {
        ariaTools.getFileSize(gid, (err, size) => {
          if (err) {
            console.log(`onDownloadComplete: ${err}`);
            var message = 'Upload failed. Could not get file size.';
            cleanupDownload(gid, message);
            return;
          }

          var filename = downloadUtils.getFileNameFromPath(file);
          dlDetails.isUploading = true;
          if (handleDisallowedFilename(dlDetails, filename)) {
            console.log('onDownloadComplete: ' + file);
            ariaTools.uploadFile(dlDetails, file, size, driveUploadCompleteCallback);
          } else {
            var reason = 'Upload failed. Blacklisted file name.';
            cleanupDownload(gid, reason);
          }
        });
      } else {
        ariaTools.isDownloadMetadata(gid, (err, isMetadata, newGid) => {
          if (err) {
            console.log(`onDownloadComplete: isMetadata: ${err}`);
            var message = 'Upload failed. Could not check if the file is metadata.';
            cleanupDownload(gid, message);
          } else if (isMetadata) {
            console.log(`onDownloadComplete: Changing GID to ${newGid}`);
            dlManager.changeDownloadGid(gid, newGid);
          } else {
            console.log('onDownloadComplete: No files - not metadata.');
            var reason = 'Upload failed. Could not get files.';
            cleanupDownload(gid, reason);
          }
        });
      }
    });
  });

  ariaTools.setOnDownloadError((gid) => {
    var dlDetails = dlManager.getDownloadByGid(gid);
    if (!dlDetails) return;  // Can happen only in case of race conditions between stop, download complete or download error, not otherwise

    console.log('error', gid);
    var message = 'Download error.';
    cleanupDownload(gid, message);
  });
}

function driveUploadCompleteCallback(err: string, gid:string, url: string, filePath: string, fileName: string, fileSize: number) {
  var finalMessage;
  if (err) {
    var message;
    try {
      message = JSON.stringify(err, null, 2);
    } catch (ignored) {
      message = err;
    }
    console.log(`uploadFile: ${filePath}: ${message}`);
    finalMessage = `Failed to upload <code>${fileName}</code> to Drive.${message}`;
    cleanupDownload(gid, finalMessage);
  } else {
    if (fileSize) {
      var fileSizeStr = downloadUtils.formatSize(fileSize);
      finalMessage = `<a href='${url}'>${fileName}</a> (${fileSizeStr})`;
    } else {
      finalMessage = `<a href='${url}'>${fileName}</a>`;
    }
    cleanupDownload(gid, finalMessage, url);
  }
}
