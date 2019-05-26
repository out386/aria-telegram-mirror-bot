const fs = require('fs-extra');
const dlVars = require('./vars.js');
const constants = require('../.constants.js');

const TYPE_METADATA = 'Metadata';
const PROGRESS_MAX_SIZE = Math.floor(100 / 8);
const PROGRESS_INCOMPLETE = ['▏', '▎', '▍', '▌', '▋', '▊', '▉'];

/**
 * Deletes the download directory and remakes it.
 * Then unsets the 'isDownloading' and 'isUploading' flags.
 */
function cleanupDownload () {
  console.log('cleanupDownload: deleting');
  fs.remove(constants.ARIA_DOWNLOAD_LOCATION)
    .then(() => {
      fs.mkdir(constants.ARIA_DOWNLOAD_LOCATION)
        .then(() => {
          resetVars();
        })
        .catch((ignored) => {
          resetVars();
        });
    })
    .catch((err) => {
      console.log('cleanupDownload: ' + JSON.stringify(err, null, 2));
      resetVars();
    });
}

function resetVars () {
  dlVars.isDownloading = undefined;
  dlVars.isUploading = undefined;
  dlVars.statusMsgsList = [];
  dlVars.messagesSinceStart = undefined;
  dlVars.isDownloadAllowed = undefined;
  dlVars.fileSize = undefined;
  dlVars.filename = undefined;
}

/**
 * Given the path to a file in the download directory, returns
 * the name of the file. If the file is in a subdirectory of the
 * download directory, returns the name of that subdirectory.
 * @param {string} filePath The name of a file that was downloaded
 * @returns {string} The name of the file or directory that was downloaded
 */
function getFileNameFromPath (filePath) {
  if (!filePath) return TYPE_METADATA;

  var baseDirLength = constants.ARIA_DOWNLOAD_LOCATION.length;
  var fileName = filePath.substring(baseDirLength + 1);
  var nameEndIndex = fileName.indexOf('/');
  if (nameEndIndex === -1) {
    nameEndIndex = fileName.length;
  }
  fileName = fileName.substring(0, nameEndIndex);

  if (!fileName) return TYPE_METADATA; // This really shouldn't be possible
  return fileName;
}

function setDownloadVars (msg, statusMsg, isTar) {
  dlVars.isDownloading = true;
  dlVars.isTar = isTar;
  dlVars.tgFromId = msg.from.id;
  if (msg.from.username) {
    dlVars.tgUsername = '@' + msg.from.username;
  } else {
    dlVars.tgUsername = msg.from.first_name;
  }
  dlVars.tgChatId = msg.chat.id;
  dlVars.tgMessageId = msg.message_id;
  dlVars.tgStatusMessageId = statusMsg.message_id;
  dlVars.statusMsgsList.push({
    message_id: statusMsg.message_id,
    chat: {
      id: statusMsg.chat.id,
      all_members_are_administrators: statusMsg.chat.all_members_are_administrators
    },
    from: {id: statusMsg.from.id}
  });
}

/**
 * Checks if the given chat already has a status message.
 * @param {Number|String} chatId The ID of the chat to search in
 * @param {Number} startIndex Start searching from this index
 * @returns {Number} The index of the status. -1 if not found
 */
function indexOfStatus (chatId, startIndex) {
  var sList = dlVars.statusMsgsList;
  for (var i = startIndex; i < sList.length; i++) {
    if (sList[i].chat.id == chatId) return i;
  }
  return -1;
}

/**
 * Registers a new download status message, and optionally deletes an old status message
 * in the same chat.
 * @param {Object} msg The Message to be added
 */
function addStatus (msg) {
  dlVars.statusMsgsList.push({
    message_id: msg.message_id,
    chat: {
      id: msg.chat.id,
      all_members_are_administrators: msg.chat.all_members_are_administrators
    },
    from: {id: msg.from.id}
  });
}

/**
 * Unregisters a status message
 * @param {Number} index The index of the message
 */
function deleteStatus (index) {
  dlVars.statusMsgsList.splice(index, 1);
}

/**
 * Finds the path of the file/torrent that Aria2 is downloading from a list of
 * files returned by Aria2.
 * @param {Object[]} files The list of files returned by Aria2
 * @returns {string} The name of the download, or null if it is a torrent metadata.
 */
function findAriaFilePath (files) {
  var filePath = files[0]['path'];
  if (filePath.startsWith(constants.ARIA_DOWNLOAD_LOCATION)) {
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
 * @returns {Object} An object containing a printable status message and the file name
 */
function generateStatusMessage (totalLength, completedLength, speed, files) {
  var fileName = findAriaFilePath(files);
  fileName = getFileNameFromPath(fileName);
  var progress;
  if (totalLength === 0) {
    progress = 0;
  } else {
    progress = Math.round(completedLength * 100 / totalLength);
  }
  var totalLengthStr = formatSize(totalLength);
  var progressString = generateProgress(progress);
  var speedStr = formatSize(speed);
  var message = `Filename: <i>${fileName}</i>\nProgress: <code>${progressString}</code>` +
      ` of ${totalLengthStr} at ${speedStr}ps`;
  var status = {
    message: message,
    filename: fileName,
    filesize: totalLengthStr
  };
  return status;
}

function generateProgress (p) {
  p = Math.min(Math.max(p, 0), 100);
  var str = '[';
  var cFull = Math.floor(p / 8);
  var cPart = p % 8 - 1;
  str += '█'.repeat(cFull);
  if (cPart >= 0) {
    str += PROGRESS_INCOMPLETE[cPart];
  }
  str += ' '.repeat(PROGRESS_MAX_SIZE - cFull);
  str = `${str}] ${p}%`;

  return str;
}

function formatSize (size) {
  if (size < 1000) {
    return formatNumber(size) + 'B';
  }
  if (size < 1024000) {
    return formatNumber(size / 1024) + 'KB';
  }
  if (size < 1048576000) {
    return formatNumber(size / 1048576) + 'MB';
  }
  return formatNumber(size / 1073741824) + 'GB';
}

function formatNumber (n) {
  return Math.round(n * 100) / 100;
}

function isDownloadAllowed (url) {
  for (var i = 0; i < constants.ARIA_FILTERED_DOMAINS.length; i++) {
    if (url.indexOf(constants.ARIA_FILTERED_DOMAINS[i]) > -1) return false;
  }
  return true;
}

function isFilenameAllowed (filename) {
  if (!constants.ARIA_FILTERED_FILENAMES) return 1;
  if (filename === TYPE_METADATA) return -1;

  for (var i = 0; i < constants.ARIA_FILTERED_FILENAMES.length; i++) {
    if (filename.indexOf(constants.ARIA_FILTERED_FILENAMES[i]) > -1) return 0;
  }
  return 1;
}

module.exports.cleanupDownload = cleanupDownload;
module.exports.getFileNameFromPath = getFileNameFromPath;
module.exports.setDownloadVars = setDownloadVars;
module.exports.findAriaFilePath = findAriaFilePath;
module.exports.generateStatusMessage = generateStatusMessage;
module.exports.isDownloadAllowed = isDownloadAllowed;
module.exports.indexOfStatus = indexOfStatus;
module.exports.addStatus = addStatus;
module.exports.deleteStatus = deleteStatus;
module.exports.formatSize = formatSize;
module.exports.isFilenameAllowed = isFilenameAllowed;
