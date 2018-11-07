const dlVars = require('./download_tools/vars.js');
const constants = require('./.constants.js');
const http = require('http');
const ariaTools = require('./download_tools/aria-tools.js');

async function deleteMsg (bot, msg, delay) {
  if (delay) await sleep(delay);

  bot.deleteMessage(msg.chat.id, msg.message_id)
    .catch(ignored => {});
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function isAdmin (bot, msg, callback) {
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
 * @param {Boolean} successful True is the download completed successfully
 * @param {String} gid The GID of the downloaded file
 * @param {Number} originGroup The Telegram chat ID of the group where the download started
 * @param {String} driveURL The URL of the uploaded file
 */
function notifyExternal (successful, gid, originGroup, driveURL) {
  if (!constants.DOWNLOAD_NOTIFY_TARGET || !constants.DOWNLOAD_NOTIFY_TARGET.enabled) return;
  ariaTools.getStatus(gid, (err, message, filename, filesize) => {
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

module.exports.deleteMsg = deleteMsg;
module.exports.sleep = sleep;
module.exports.isAuthorized = isAuthorized;
module.exports.isAdmin = isAdmin;
module.exports.notifyExternal = notifyExternal;
