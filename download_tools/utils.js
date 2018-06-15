const fs = require('fs-extra');
const dlVars = require('./vars.js');
const constants = require('../.constants.js');

/**
 * Deletes the download directory and remakes it.
 * Then unsets the 'isDownloading' and 'isUploading' flags.
 */
function cleanupDownload () {
  console.log('cleanupDownload: deleting');
  fs.remove(constants.AIRA_DOWNLOAD_LOCATION)
    .then(() => {
      fs.mkdir(constants.AIRA_DOWNLOAD_LOCATION)
        .then(() => {
          dlVars.isDownloading = undefined;
          dlVars.isUploading = undefined;
        })
        .catch((ignored) => {
          dlVars.isDownloading = undefined;
          dlVars.isUploading = undefined;
        });
    })
    .catch((err) => {
      console.log('cleanupDownload: ' + JSON.stringify(err, null, 2));
      dlVars.isDownloading = undefined;
      dlVars.isUploading = undefined;
    });
}

/**
 * Given the path to a file in the download directory, returns
 * the name of the file. If the file is in a subdirectory of the
 * download directory, returns the name of that subdirectory.
 * @param {string} filePath The name of a file that was downloaded
 * @returns {string} The name of the file or directory that was downloaded
 */
function getFileNameFromPath (filePath) {
  var baseDirLength = constants.AIRA_DOWNLOAD_LOCATION.length;
  var fileName = filePath.substring(baseDirLength + 1);
  var nameEndIndex = fileName.indexOf('/');
  if (nameEndIndex === -1) {
    nameEndIndex = fileName.length;
  }
  fileName = fileName.substring(0, nameEndIndex);
  return fileName;
}

function setDownloadVars (msg) {
  dlVars.isDownloading = true;
  dlVars.tgFromId = msg.from.id;
  if (msg.from.username) {
    dlVars.tgUsername = '@' + msg.from.username;
  } else {
    dlVars.tgUsername = msg.from.first_name;
  }
  dlVars.tgChatId = msg.chat.id;
  dlVars.tgMessageId = msg.message_id;
}

/**
 * Finds the path of the file/torrent that Aria2 is downloading from a list of
 * files returned by Aria2.
 * @param {Object[]} files The list of files returned by Aria2
 * @returns {string} The name of the download, or null if it is a torrent metadata.
 */
function findAriaFilePath (files) {
  var filePath = files[0]['path'];
  if (filePath.startsWith(constants.AIRA_DOWNLOAD_LOCATION)) {
    if (filePath.substring(filePath.lastIndexOf('.') + 1) !== 'torrent') {
      // This is not a torrent's metadata
      return filePath;
    }
  } else {
    return null;
  }
}

/**
 * Generates a human-readable message for the status of the given download
 * @param {number} totalLength The total size of the download
 * @param {number} completedLength The downloaded length
 * @param {number} speed The speed of the download in B/s
 * @param {Object[]} files The list of files in the download
 * @returns {string} A printable status message
 */
function generateStatusMessage (totalLength, completedLength, speed, files) {
  var fileName = findAriaFilePath(files);
  if (fileName) {
    fileName = getFileNameFromPath(fileName);
  } else {
    fileName = 'Metadata';
  }
  var progress;
  if (totalLength === 0) {
    progress = 0;
  } else {
    progress = Math.round(completedLength * 100 / totalLength);
  }
  var message = progress + '% of <code>' + fileName + '</code> downloaded at ' + formatSpeed(speed);
  return message;
}

function formatSpeed (speed) {
  var suffix;
  if (speed < 1024) {
    suffix = 'Bps';
  } else if (speed >= 1024 && speed < 1048576) {
    speed = Math.round(speed / 1024);
    suffix = 'kBps';
  } else if (speed >= 1048576 && speed < 1073741824) {
    speed = Math.round(speed / 1048576);
    suffix = 'mBps';
  } else if (speed >= 1073741824) {
    speed = Math.round(speed / 1073741824);
    suffix = 'wPps (Weed Particles Per Second)';
  }
  return speed + ' ' + suffix;
}

module.exports.cleanupDownload = cleanupDownload;
module.exports.getFileNameFromPath = getFileNameFromPath;
module.exports.setDownloadVars = setDownloadVars;
module.exports.findAriaFilePath = findAriaFilePath;
module.exports.generateStatusMessage = generateStatusMessage;
