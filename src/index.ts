import TelegramBot = require('node-telegram-bot-api');
import downloadUtils = require('./download_tools/utils');
import dlVars = require('./download_tools/vars.js');
import ariaTools = require('./download_tools/aria-tools.js');
import constants = require('./.constants.js');
import msgTools = require('./msg-tools.js');
import driveList = require('./drive/drive-list.js');
import driveUtils = require('./drive/drive-utils.js');

const bot = new TelegramBot(constants.TOKEN, { polling: true });
var websocketOpened = false;
var statusInterval: NodeJS.Timeout;
var dlDetails: dlVars.DlVars;

initAria2();

bot.on("polling_error", msg => console.log(msg.message));

bot.onText(/^\/start/, (msg) => {
  if (msgTools.isAuthorized(msg, dlDetails) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    sendMessage(msg, 'You should know the commands already. Happy mirroring.');
  }
});

bot.onText(/^\/mirrortar (.+)/i, (msg, match) => {
  if (msgTools.isAuthorized(msg, dlDetails) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    mirror(msg, match, true);
  }
});

bot.onText(/^\/mirror (.+)/i, (msg, match) => {
  if (msgTools.isAuthorized(msg, dlDetails) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    mirror(msg, match);
  }
});

bot.on('message', (msg) => {
  if (dlDetails && dlDetails.isDownloading && msg.chat.id === dlDetails.tgChatId) {
    if (dlDetails.messagesSinceStart) {
      if (dlDetails.messagesSinceStart < 10) {
        dlDetails.messagesSinceStart++;
      }
    } else {
      dlDetails.messagesSinceStart = 1;
    }
  }
});

/**
 * Start a new download operation. Only one is allowed at a time. Make sure
 * that this is triggered by an authorized user, because this function itself
 * does not check for that.
 * @param {Object} msg The Message that triggered the download
 * @param {Array} match Message matches
 * @param {boolean} isTar Decides if this download should be archived before upload
 */
function mirror(msg: TelegramBot.Message, match: RegExpExecArray, isTar?: boolean) {
  if (websocketOpened) {
    if (dlDetails && dlDetails.isDownloading) {
      sendMessage(msg, dlDetails.tgUsername + ' is mirroring something. Please wait.');
    } else {
      if (downloadUtils.isDownloadAllowed(match[1])) {
        prepDownload(msg, match[1], isTar);
      } else {
        sendMessage(msg, `Download failed. Blacklisted URL.`);
      }
    }
  } else {
    sendMessage(msg, `Websocket isn't open. Can't download`);
  }
}

bot.onText(/^\/mirrorStatus/i, (msg) => {
  if (msgTools.isAuthorized(msg, dlDetails) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    sendStatusMessage(msg);
  }
});

function getStatus(msg: TelegramBot.Message, callback: (err: string, message: string) => void) {
  var authorizedCode;
  if (msg) {
    authorizedCode = msgTools.isAuthorized(msg, dlDetails);
  } else {
    authorizedCode = 1;
  }

  if (authorizedCode > -1) {
    if (dlDetails && dlDetails.isDownloading) {
      if (dlDetails.isUploading) {
        callback(null, 'Upload in progress.');
      } else {
        ariaTools.getStatus(dlDetails.downloadGid, (err, message, filename, filesize) => {
          if (!err) {
            handleDisallowedFilename(filename);
            callback(null, message);
          } else {
            console.log('status: ', err);
            callback(err, null);
          }
        });
      }
    } else {
      callback(null, 'No active downloads');
    }
  } else {
    callback(null, `You aren't authorized to use this bot here.`);
  }
}

bot.onText(/^\/list (.+)/i, (msg, match) => {
  if (msgTools.isAuthorized(msg, dlDetails) < 0) {
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
  if (msgTools.isAuthorized(msg, dlDetails) < 0) {
    sendUnauthorizedMessage(msg);
  } else {
    sendMessage(msg,
      '<a href = \'' + driveUtils.getFileLink(constants.GDRIVE_PARENT_DIR_ID, true) + '\'>Drive mirror folder</a>',
      60000);
  }
});

bot.onText(/^\/cancelMirror/i, (msg) => {
  var authorizedCode = msgTools.isAuthorized(msg, dlDetails);
  if (authorizedCode > -1 && authorizedCode < 3) {
    cancelMirror(msg);
  } else if (authorizedCode === 3) {
    msgTools.isAdmin(bot, msg, (e, res) => {
      if (res) {
        cancelMirror(msg);
      } else {
        sendMessage(msg, 'You do not have the permission to do that.');
      }
    });
  } else {
    sendMessage(msg, 'You cannot use this bot here.');
  }
});

function cancelMirror(msg?: TelegramBot.Message) {
  if (dlDetails && dlDetails.isDownloading) {
    if (dlDetails.isUploading) {
      if (msg) {
        sendMessage(msg, 'Upload in progress. Cannot cancel.');
      }
    } else {
      ariaTools.stopDownload(dlDetails.downloadGid, () => {
        // Not sending a message here, because a cancel will fire
        // the onDownloadStop notification, which will notify the
        // person who started the download

        if (msg && dlDetails.tgChatId !== msg.chat.id) {
          // Notify if this is not the chat the download started in
          sendMessage(msg, 'The download was canceled.');
        }
      });
    }
  } else if (msg) {
    sendMessage(msg, 'No download in progress.');
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
function handleDisallowedFilename(filename: string): boolean {
  if (dlDetails) {
    if (dlDetails.isDownloadAllowed === 0) return false;
    if (dlDetails.isDownloadAllowed === 1) return true;
    if (!filename) return true;

    var isAllowed = downloadUtils.isFilenameAllowed(filename);
    if (isAllowed === 0) {
      dlDetails.isDownloadAllowed = 0;
      if (dlDetails.isDownloading && !dlDetails.isUploading) {
        cancelMirror();
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
    dlDetails = new dlVars.DlVars(msg, statusMessage, isTar);
    download(match);
  });
}

function download(match: string) {
  ariaTools.addUri(match,
    (err, gid) => {
      if (err) {
        var message = `Failed to start the download. ${err.message}`;
        console.error(message);
        cleanupDownload(gid, message);
      } else {
        console.log(`download:${match} gid:${gid}`);
      }
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

function sendMessageReplyOriginal(message: string) {
  if (dlDetails) {
    bot.sendMessage(dlDetails.tgChatId, message, {
      reply_to_message_id: dlDetails.tgMessageId,
      parse_mode: 'HTML'
    })
      .catch((ignored) => { });
  }
}

function sendStatusMessage(msg: TelegramBot.Message) {
  // Skipping 0, which is the reply to the download command message
  var index = downloadUtils.indexOfStatus(dlDetails, msg.chat.id, 1);

  if (index > -1) {
    msgTools.deleteMsg(bot, dlDetails.statusMsgsList[index]);
    downloadUtils.deleteStatus(dlDetails, index);
  }

  getStatus(msg, (err, text) => {
    if (!err) {
      sendMessage(msg, text, 60000, message => {
        if (dlDetails) {
          downloadUtils.addStatus(dlDetails, message);
        }
      }, true);
    }
  });
}

function updateStatusMessage(msg: TelegramBot.Message, text: string) {
  if (!text) {
    getStatus(msg, (err, text) => {
      if (!err) editMessage(msg, text);
    });
  } else {
    editMessage(msg, text);
  }
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

function updateAllStatus(message: string) {
  if (!dlDetails) return;
  if (message) {
    dlDetails.statusMsgsList.forEach(status => {
      editMessage(status, message);
    });
  } else {
    getStatus(null, (err, text) => {
      if (err) return;
      dlDetails.statusMsgsList.forEach(status => {
        editMessage(status, text);
      });
    });
  }
}

/**
 * Deletes the bot's original response to the download command, if less
 * than 10 messages have been sent to the group the download started in,
 * since the download was started. Also deletes if the bot doesn't have
 * message read permissions.
 **/
function deleteOrigReply() {
  /* Reason: The download task has been completed, and a new status message
   * has been sent. No need to clutter the group with dulpicate status.
   */
  if (dlDetails && (!dlDetails.messagesSinceStart || dlDetails.messagesSinceStart < 10)) {
    msgTools.deleteMsg(bot, dlDetails.statusMsgsList[0], 0);
  }
}

/**
 * After a download is complete (failed or otherwise), call this to reset
 * download state and prepare for a new download.
 * @param gid The gid for the download that just finished
 * @param message The message to send as the Telegram download complete message
 * @param url The public Google Drive URL for the uploaded file
 */
function cleanupDownload(gid: string, message: string, url?: string) {
  clearInterval(statusInterval);
  statusInterval = null;
  sendMessageReplyOriginal(message);
  updateAllStatus(message);
  deleteOrigReply();
  if (dlDetails) {
    if (url) {
      msgTools.notifyExternal(true, gid, dlDetails.tgChatId, url);
    } else {
      msgTools.notifyExternal(false, gid, dlDetails.tgChatId);
    }
  }
  dlDetails = null;
  downloadUtils.cleanupDownload();
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
    if (!dlDetails) return;  // Can happen only in case of race conditions between start and stop download, not otherwise

    dlDetails.isDownloading = true;
    dlDetails.isUploading = false;
    dlDetails.downloadGid = gid;
    console.log('start', gid);
    // downloadUtils.setDownloadVars makes sure the first element in the list refers
    // to the download command's message
    updateStatusMessage(dlDetails.statusMsgsList[0], 'Download started.');

    ariaTools.getStatus(dlDetails.downloadGid, (err, message, filename) => {
      if (!err) {
        handleDisallowedFilename(filename);
      }
    });

    if (!statusInterval) {
      statusInterval = setInterval(updateAllStatus, 4000);
    }
  });
  ariaTools.setOnDownloadStop((gid) => {
    if (!dlDetails) return;  // Can happen only in case of race conditions between stop and download complete, not otherwise

    console.log('stop', gid);
    var message = 'Download stopped.';
    if (dlDetails.isDownloadAllowed === 0) {
      message += ' Blacklisted file name.';
    }
    cleanupDownload(gid, message);
  });
  ariaTools.setOnDownloadComplete((gid) => {
    if (!dlDetails) return;  // Can happen only in case of race conditions between stop and download complete, not otherwise

    ariaTools.getAriaFilePath(gid, (err, file) => {
      if (err) {
        console.log('onDownloadComplete: ' + JSON.stringify(err, null, 2));
        var message = 'Upload failed. Could not get downloaded files.';
        cleanupDownload(gid, message);
        return;
      }

      if (file) {
        ariaTools.getFileSize(gid, (err, size) => {
          if (err) {
            console.log('onDownloadComplete: ' + JSON.stringify(err, null, 2));
            var message = 'Upload failed. Could not get file size.';
            cleanupDownload(gid, message);
            return;
          }

          var filename = downloadUtils.getFileNameFromPath(file);
          dlDetails.isUploading = true;
          if (handleDisallowedFilename(filename)) {
            console.log('onDownloadComplete: ' + file);
            ariaTools.uploadFile(dlDetails, file, size, driveUploadCompleteCallback);
          } else {
            var reason = 'Upload failed. Blacklisted file name.';
            cleanupDownload(gid, reason);
          }
        });
      } else {
        ariaTools.isDownloadMetadata(gid, (err, isMetadata) => {
          if (err) {
            console.log('onDownloadComplete: isMetadata: ' + JSON.stringify(err, null, 2));
            var message = 'Upload failed. Could not check if the file is metadata.';
            cleanupDownload(gid, message);
            return;
          }

          if (isMetadata) {
            console.log('onDownloadComplete: No files');
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
    if (!dlDetails) return;  // Can happen only in case of race conditions between stop, download complete or download error, not otherwise

    console.log('error', gid);
    var message = 'Download error.';
    cleanupDownload(gid, message);
  });
}

function driveUploadCompleteCallback(err: string, url: string, filePath: string, fileName: string, fileSize: number) {
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
    cleanupDownload(dlDetails ? dlDetails.downloadGid : null, finalMessage);
  } else {
    if (fileSize) {
      var fileSizeStr = downloadUtils.formatSize(fileSize);
      finalMessage = `<a href='${url}'>${fileName}</a> (${fileSizeStr})`;
    } else {
      finalMessage = `<a href='${url}'>${fileName}</a>`;
    }
    cleanupDownload(dlDetails ? dlDetails.downloadGid : null, finalMessage, url);
  }
}
