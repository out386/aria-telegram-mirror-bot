const dlVars = require('./download_tools/vars.js');
const constants = require('./.constants.js');

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

module.exports.deleteMsg = deleteMsg;
module.exports.sleep = sleep;
module.exports.isAuthorized = isAuthorized;
module.exports.isAdmin = isAdmin;
