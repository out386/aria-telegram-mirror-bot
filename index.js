/**
 * This example demonstrates using polling.
 * It also demonstrates how you would process and send messages.
 */

var TelegramBot = require('node-telegram-bot-api');
const Aria2 = require('aria2');
require('dotenv').config();
const options = {
  polling: true
};
const ariaOptions = {
  host: 'localhost',
  port: 8210,
  secure: false,
  secret: process.env.ARIA_SECRET,
  path: '/jsonrpc'
};
const bot = new TelegramBot(process.env.TOKEN, options);
const aria2 = new Aria2(ariaOptions);

aria2.open()
  .then(() => {
    console.log(' A2C: Websocket opened');
  })
  .catch(() => {
    console.log(' A2C: Websocket open failed. Exiting.');
    process.exit(1);
  });

aria2.onDownloadStart = function (gid) {
  console.log('start', gid);
  bot.sendMessage('173749550', 'Started');
};
aria2.onDownloadStop = function (gid) {
  console.log('stop', gid);
  bot.sendMessage('173749550', 'Stopped');
};
aria2.onDownloadComplete = function (gid) {
  console.log('complete', gid);
  bot.sendMessage('173749550', 'Complete');
};
aria2.onDownloadError = function (gid) {
  console.log('error', gid);
  bot.sendMessage('173749550', 'Errored');
};

bot.onText(/^\/test$/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Meh');
});

bot.onText(/^\/mirror (.+)/, (msg, match) => {
  aria2.addUri([match[1]], {dir: process.env.AIRA_DOWNLOAD_LOCATION})
    .then((res) => {
    })
    .catch((err) => {
      console.log('Failure', err);
      bot.sendMessage(msg.chat.id, 'Failed to start the download.');
    });
});
