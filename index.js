const TelegramBot = require('node-telegram-bot-api');
const downloadUtils = require('./download_tools/utils.js');
const dlVars = require('./download_tools/vars.js');
const ariaTools = require('./download_tools/aria-tools.js');
const constants = require('./.constants.js');
const msgTools = require('./msg-tools.js');
const driveList = require('./drive/drive-list.js');
const driveUtils = require('./drive/drive-utils.js');

const options = {
  polling: true
};
const bot = new TelegramBot(constants.TOKEN, options);
var websocketOpened = false;
var statusInterval;

initAria2();

bot.onText(/^\/mirrortar (.+)/i, (msg, match) => {
  mirror(msg, match, true);
});

bot.onText(/^\/mirror (.+)/i, (msg, match) => {
  mirror(msg, match);
});

function mirror (msg, match, isTar) {
  var authorizedCode = msgTools.isAuthorized(msg);
  if (authorizedCode > -1) {
    if (websocketOpened) {
      if (dlVars.isDownloading) {
        sendMessage(msg, dlVars.tgUsername + ' is mirroring something. Please wait.');
      } else {
        if (downloadUtils.isDownloadAllowed(match[1])) {
          prepDownload(msg, match[1], isTar);
        } else {
          sendMessage(msg, 'You aren\'t allowed to download from that domain');
        }
      }
    } else {
      sendMessage(msg, 'Websocket isn\'t open. Can\'t download');
    }
  } else {
    sendMessage(msg, 'You cannot use this bot here.');
  }
}

bot.onText(/^\/mirrorStatus/i, (msg) => {
  sendStatusMessage(msg, undefined, 1);
});

function getStatus (msg, callback) {
  var authorizedCode;
  if (msg) {
    authorizedCode = msgTools.isAuthorized(msg);
  } else {
    authorizedCode = 1;
  }

  if (authorizedCode > -1) {
    if (dlVars.isDownloading) {
      if (dlVars.isUploading) {
        callback(null, 'Upload in progress.');
      } else {
        ariaTools.getStatus(dlVars.downloadGid, (err, message) => {
          if (!err) {
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
    callback(null, 'You cannot use this bot here.');
  }
}

bot.onText(/^\/list (.+)/i, (msg, match) => {
  var authorizedCode = msgTools.isAuthorized(msg);
  if (authorizedCode > -1) {
    driveList.listFiles(match[1], (err, res) => {
      if (err) {
        sendMessage(msg, 'Failed to fetch the list of files');
      } else {
        sendMessage(msg, res, 60000);
      }
    });
  } else {
    sendMessage(msg, 'You cannot use this bot here.');
  }
});

bot.onText(/^\/getFolder/i, (msg) => {
  sendMessage(msg,
    '<a href = \'' + driveUtils.getFileLink(constants.GDRIVE_PARENT_DIR_ID, true) + '\'>Drive mirror folder</a>',
    60000);
});

bot.onText(/^\/cancelMirror/i, (msg) => {
  var authorizedCode = msgTools.isAuthorized(msg);
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

function cancelMirror (msg) {
  if (dlVars.isDownloading) {
    if (dlVars.isUploading) {
      sendMessage(msg, 'Upload in progress. Cannot cancel.');
    } else {
      ariaTools.stopDownload(dlVars.downloadGid, () => {
      // Not sending a message here, because a cancel will fire
      // the onDownloadStop notification, which will notify the
      // person who started the download

        if (dlVars.tgChatId !== msg.chat.id) {
          // Notify if this is not the chat the download started in
          sendMessage(msg, 'The download was canceled.');
        }
        clearInterval(statusInterval);
        statusInterval = null;
        downloadUtils.cleanupDownload();
      });
    }
  } else {
    sendMessage(msg, 'No download in progress.');
  }
}

function prepDownload (msg, match, isTar) {
  sendMessage(msg, 'Preparing', -1, statusMessage => {
    downloadUtils.setDownloadVars(msg, statusMessage, isTar);
    download(msg, match, isTar);
  });
}

function download (msg, match, isTar) {
  ariaTools.addUri([match],
    (err, gid) => {
      if (err) {
        console.log('Failure', err);
        sendMessageReplyOriginal('Failed to start the download. ' + err['message']);
        statusInterval = null;
        downloadUtils.cleanupDownload();
      } else {
        console.log('download: ' + match + ' gid: ' + gid);
      }
    });
}

function sendMessage (msg, text, delay, callback) {
  if (!delay) delay = 5000;
  bot.sendMessage(msg.chat.id, text, {
    reply_to_message_id: msg.message_id,
    parse_mode: 'HTML'
  })
    .then((res) => {
      if (callback) callback(res);
      if (delay > -1) {
        msgTools.deleteMsg(bot, res, delay);
        msgTools.deleteMsg(bot, msg, delay);
      }
    })
    .catch((ignored) => {});
}

function sendMessageReplyOriginal (message, callback) {
  bot.sendMessage(dlVars.tgChatId, message, {
    reply_to_message_id: dlVars.tgMessageId,
    parse_mode: 'HTML'
  })
    .catch((ignored) => {});
}

function sendStatusMessage (msg) {
  // Skipping 0, which is the reply to the download command message
  var index = downloadUtils.indexOfStatus(msg.chat.id, 1);

  if (index > -1) {
    msgTools.deleteMsg(bot, dlVars.statusMsgsList[index]);
    downloadUtils.deleteStatus(index);
  }

  getStatus(msg, (err, text) => {
    if (!err) {
      sendMessage(msg, text, 60000, message => {
        downloadUtils.addStatus(message);
      });
    }
  });
}

function updateStatusMessage (msg, text) {
  if (!text) {
    getStatus(msg, (err, text) => {
      if (!err) editMessage(msg, text);
    });
  } else {
    editMessage(msg, text);
  }
}

function editMessage (msg, text) {
  bot.editMessageText(text, {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: 'HTML'
  })
    .catch(ignored => {});
}

function updateAllStatus () {
  getStatus(null, (err, text) => {
    if (err) return;
    dlVars.statusMsgsList.forEach(status => {
      editMessage(status, text);
    });
  });
}

function initAria2 () {
  ariaTools.openWebsocket((err) => {
    if (err) {
      console.log('A2C: Failed to open websocket. Exiting.');
      process.exit(1);
    } else {
      websocketOpened = true;
      console.log('A2C: Websocket opened');
    }
  });

  ariaTools.setOnDownloadStart((gid) => {
    dlVars.isDownloading = true;
    dlVars.isUploading = false;
    dlVars.downloadGid = gid;
    console.log('start', gid);
    // downloadUtils.setDownloadVars makes sure the first element in the list refers
    // to the download command's message
    updateStatusMessage(dlVars.statusMsgsList[0], 'Download started.');

    if (!statusInterval) {
      statusInterval = setInterval(updateAllStatus, 4000);
    }
  });
  ariaTools.setOnDownloadStop((gid) => {
    console.log('stop', gid);
    sendMessageReplyOriginal('Download stopped.');
    clearInterval(statusInterval);
    statusInterval = null;
    downloadUtils.cleanupDownload();
  });
  ariaTools.setOnDownloadComplete((gid) => {
    ariaTools.getAriaFilePath(gid, (err, file) => {
      if (err) {
        console.log('onDownloadComplete: ' + JSON.stringify(err, null, 2));
        sendMessageReplyOriginal('Upload failed. Could not get downloaded files.');
        clearInterval(statusInterval);
        statusInterval = null;
        downloadUtils.cleanupDownload();
        return;
      }
      if (file) {
        ariaTools.getFileSize(gid, (err, size) => {
          if (err) {
            console.log('onDownloadComplete: ' + JSON.stringify(err, null, 2));
            sendMessageReplyOriginal('Upload failed. Could not get file size.');
            clearInterval(statusInterval);
            statusInterval = null;
            downloadUtils.cleanupDownload();
            return;
          }
          console.log('onDownloadComplete: ' + file);
          ariaTools.uploadFile(file, size, driveUploadCompleteCallback);
        });
      } else {
        console.log('onDownloadComplete: No files');
      }
    });
  });
  ariaTools.setOnDownloadError((gid) => {
    console.log('error', gid);
    sendMessageReplyOriginal('Download error.');
    clearInterval(statusInterval);
    statusInterval = null;
    downloadUtils.cleanupDownload();
  });
}

function driveUploadCompleteCallback (err, url, filePath, fileName) {
  clearInterval(statusInterval);
  statusInterval = null;
  if (err) {
    var message;
    try {
      message = JSON.stringify(err, null, 2);
    } catch (ignored) {
      message = err;
    }
    console.log('uploadFile: ' + filePath + ': ' + message);
    sendMessageReplyOriginal('Failed to upload <code>' + fileName + '</code> to Drive.' + message);
  } else {
    sendMessageReplyOriginal('<a href=\'' + url + '\'>' + fileName + '</a>');
  }
  downloadUtils.cleanupDownload();
}
