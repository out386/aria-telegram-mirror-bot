const TelegramBot = require('node-telegram-bot-api');
const downloadUtils = require('./download_tools/utils.js');
const dlVars = require('./download_tools/vars.js');
const ariaTools = require('./download_tools/aria-tools.js');
const constants = require('./.constants.js');

const options = {
  polling: true
};
const bot = new TelegramBot(constants.TOKEN, options);
var websocketOpened = false;

initAria2();

bot.onText(/^\/mirror (.+)/i, (msg, match) => {
  var authorizedCode = isAuthorized(msg);
  if (authorizedCode > -1) {
    if (websocketOpened) {
      if (dlVars.isDownloading) {
        bot.sendMessage(msg.chat.id,
          dlVars.tgUsername + ' is mirroring something. Please wait.',
          {reply_to_message_id: msg.message_id}
        );
      } else {
        download(msg, match[1]);
      }
    } else {
      bot.sendMessage(msg.chat.id,
        'Websocket isn\'t open. Can\'t download',
        {reply_to_message_id: msg.message_id}
      );
    }
  } else {
    bot.sendMessage(msg.chat.id, 'You cannot use this bot here.', {reply_to_message_id: msg.message_id});
  }
});

bot.onText(/^\/mirrorStatus/i, (msg) => {
  var authorizedCode = isAuthorized(msg);
  if (authorizedCode > -1) {
    if (dlVars.isDownloading) {
      if (dlVars.isUploading) {
        bot.sendMessage(msg.chat.id, 'Upload in progress.', {
          reply_to_message_id: msg.message_id
        });
      } else {
        ariaTools.getStatus(dlVars.downloadGid, (err, message) => {
          if (!err) {
            bot.sendMessage(msg.chat.id, message, {
              reply_to_message_id: msg.message_id,
              parse_mode: 'HTML'
            });
          } else {
            console.log('status: ', err);
          }
        });
      }
    } else {
      bot.sendMessage(msg.chat.id, 'No active downloads', {
        reply_to_message_id: msg.message_id
      });
    }
  } else {
    bot.sendMessage(msg.chat.id, 'You cannot use this bot here.', {reply_to_message_id: msg.message_id});
  }
});

bot.onText(/^\/cancelMirror/i, (msg) => {
  var authorizedCode = isAuthorized(msg);
  if (authorizedCode > -1 && authorizedCode < 3) {
    cancelMirror(msg);
  } else if (authorizedCode === 3) {
    isAdmin(msg, (e, res) => {
      if (res) {
        cancelMirror(msg);
      } else {
        bot.sendMessage(msg.chat.id, 'You do not have the permission to do that.', {reply_to_message_id: msg.message_id});
      }
    });
  } else {
    bot.sendMessage(msg.chat.id, 'You cannot use this bot here.', {reply_to_message_id: msg.message_id});
  }
});

function cancelMirror (msg) {
  if (dlVars.isDownloading) {
    if (dlVars.isUploading) {
      bot.sendMessage(msg.chat.id, 'Upload in progress. Cannot cancel.', {
        reply_to_message_id: msg.message_id
      });
    } else {
      ariaTools.stopDownload(dlVars.downloadGid, () => {
      // Not sending a message here, because a cancel will fire
      // the onDownloadStop notification, which will notify the
      // person who started the download

        if (dlVars.tgChatId !== msg.chat.id) {
        // Notify if this is not the chat the download started in
          bot.sendMessage(msg.chat.id, 'The download was canceled.', {
            reply_to_message_id: msg.message_id
          });
        }
        downloadUtils.cleanupDownload();
      });
    }
  } else {
    bot.sendMessage(msg.chat.id, 'No download in progress.', {
      reply_to_message_id: msg.message_id
    });
  }
}

function download (msg, match) {
  downloadUtils.setDownloadVars(msg);
  ariaTools.addUri([match],
    (err, gid) => {
      if (err) {
        console.log('Failure', err);
        sendMessage('Failed to start the download. ' + err['message']);
        downloadUtils.cleanupDownload();
      } else {
        console.log('download: ' + match + ' gid: ' + gid);
      }
    });
}

function sendMessage (message) {
  bot.sendMessage(dlVars.tgChatId, message, {
    reply_to_message_id: dlVars.tgMessageId,
    parse_mode: 'HTML'
  })
    .then((res) => {})
    .catch((err) => {
      console.log('sendMessage:' + JSON.stringify(err, null, 2));
    });
}

function initAria2 () {
  ariaTools.openWebsocket((err) => {
    if (err) {
      console.log(' A2C: Failed to open websocket. Exiting.');
      process.exit(1);
    } else {
      websocketOpened = true;
      console.log(' A2C: Websocket opened');
    }
  });

  ariaTools.setOnDownloadStart((gid) => {
    dlVars.downloadGid = gid;
    console.log('start', gid);
    sendMessage('Download started.');
  });
  ariaTools.setOnDownloadStop((gid) => {
    console.log('stop', gid);
    sendMessage('Download stopped.');
    downloadUtils.cleanupDownload();
  });
  ariaTools.setOnDownloadComplete((gid) => {
    ariaTools.getAriaFilePath(gid, (err, file) => {
      if (err) {
        console.log('onDownloadComplete: tellStatus: ' + JSON.stringify(err, null, 2));
        sendMessage('Upload failed. Could not get downloaded files.');
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
    sendMessage('Download error.');
    downloadUtils.cleanupDownload();
  });
}

function driveUploadCompleteCallback (err, url, filePath, fileName) {
  if (err) {
    console.log('uploadFile: ' + filePath + ': ' + JSON.stringify(err, null, 2));
    sendMessage('Failed to upload <code>' + fileName + '</code> to Drive');
  } else {
    sendMessage('<a href=\'' + url + '\'>' + fileName + '</a>');
  }
}

function isAuthorized (msg) {
  for (var i = 0; i < constants.SUDO_USERS.length; i++) {
    if (constants.SUDO_USERS[i] === msg.from.id) return 0;
  }
  if (dlVars.isDownloading && msg.from.id === dlVars.tgFromId) return 1;
  if (constants.AUTHORIZED_CHATS.indexOf(msg.chat.id) > -1 &&
    msg.chat.all_members_are_administrators) return 2;
  if (constants.AUTHORIZED_CHATS.indexOf(msg.chat.id) > -1) return 3;
  return -1;
}

function isAdmin (msg, callback) {
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
