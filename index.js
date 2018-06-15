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

initAria2();

bot.onText(/^\/mirror (.+)/i, (msg, match) => {
  var authorizedCode = msgTools.isAuthorized(msg);
  if (authorizedCode > -1) {
    if (websocketOpened) {
      if (dlVars.isDownloading) {
        sendMessage(msg, dlVars.tgUsername + ' is mirroring something. Please wait.');
      } else {
        download(msg, match[1]);
      }
    } else {
      sendMessage(msg, 'Websocket isn\'t open. Can\'t download');
    }
  } else {
    sendMessage(msg, 'You cannot use this bot here.');
  }
});

bot.onText(/^\/mirrorStatus/i, (msg) => {
  var authorizedCode = msgTools.isAuthorized(msg);
  if (authorizedCode > -1) {
    if (dlVars.isDownloading) {
      if (dlVars.isUploading) {
        sendMessage(msg, 'Upload in progress.');
      } else {
        ariaTools.getStatus(dlVars.downloadGid, (err, message) => {
          if (!err) {
            sendMessage(msg, message);
          } else {
            console.log('status: ', err);
          }
        });
      }
    } else {
      sendMessage(msg, 'No active downloads');
    }
  } else {
    sendMessage(msg, 'You cannot use this bot here.');
  }
});

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
        downloadUtils.cleanupDownload();
      });
    }
  } else {
    sendMessage(msg, 'No download in progress.');
  }
}

function download (msg, match) {
  downloadUtils.setDownloadVars(msg);
  ariaTools.addUri([match],
    (err, gid) => {
      if (err) {
        console.log('Failure', err);
        sendMessageReplyOriginal('Failed to start the download. ' + err['message']);
        downloadUtils.cleanupDownload();
      } else {
        console.log('download: ' + match + ' gid: ' + gid);
      }
    });
}

function sendMessage (msg, message, delay) {
  if (!delay) delay = 5000;
  bot.sendMessage(msg.chat.id, message, {
    reply_to_message_id: msg.message_id,
    parse_mode: 'HTML'
  })
    .then((res) => {
      msgTools.deleteMsg(bot, res, delay);
      msgTools.deleteMsg(bot, msg, delay);
    })
    .catch((ignored) => {});
}

function sendMessageReplyOriginal (message) {
  bot.sendMessage(dlVars.tgChatId, message, {
    reply_to_message_id: dlVars.tgMessageId,
    parse_mode: 'HTML'
  })
    .catch((ignored) => {});
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
    sendMessageReplyOriginal('Download started.');
  });
  ariaTools.setOnDownloadStop((gid) => {
    console.log('stop', gid);
    sendMessageReplyOriginal('Download stopped.');
    downloadUtils.cleanupDownload();
  });
  ariaTools.setOnDownloadComplete((gid) => {
    ariaTools.getAriaFilePath(gid, (err, file) => {
      if (err) {
        console.log('onDownloadComplete: tellStatus: ' + JSON.stringify(err, null, 2));
        sendMessageReplyOriginal('Upload failed. Could not get downloaded files.');
        downloadUtils.cleanupDownload();
        return;
      }
      if (file) {
        console.log('onDownloadComplete: ' + file);
        ariaTools.uploadFile(file, driveUploadCompleteCallback);
      } else {
        console.log('onDownloadComplete: No files');
      }
    });
  });
  ariaTools.setOnDownloadError((gid) => {
    console.log('error', gid);
    sendMessageReplyOriginal('Download error.');
    downloadUtils.cleanupDownload();
  });
}

function driveUploadCompleteCallback (err, url, filePath, fileName) {
  if (err) {
    var message;
    try {
      message = JSON.stringify(err, null, 2);
    } catch (ignored) {
      message = err;
    }
    console.log('uploadFile: ' + filePath + ': ' + message);
    sendMessageReplyOriginal('Failed to make <code>' + fileName + '</code> publicly accessible.' +
      message +
      'If you have the Drive password, download it from the web UI. ');
  } else {
    sendMessageReplyOriginal('<a href=\'' + url + '\'>' + fileName + '</a>');
  }
}
