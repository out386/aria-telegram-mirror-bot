import fs = require('fs-extra');
import dlVars = require('./vars');
import constants = require('../.constants');
import TelegramBot = require('node-telegram-bot-api');

const TYPE_METADATA = 'Metadata';
const PROGRESS_MAX_SIZE = Math.floor(100 / 8);
const PROGRESS_INCOMPLETE = ['⣦', '⣦', '⣦', '⣀', '⣦', '⣦', '⣦'];

/**
 * Deletes the download directory and remakes it.
 * Then unsets the 'isDownloading' and 'isUploading' flags.
 */
export function cleanupDownload() {
  console.log('cleanupDownload: Deleting the downloaded file(s)\n');
  fs.remove(constants.ARIA_DOWNLOAD_LOCATION)
    .then(() => {
      fs.mkdir(constants.ARIA_DOWNLOAD_LOCATION)
        .then(() => {
        })
        .catch((err) => {
          console.error(`Failed to recreate the downloads directory: ${err.message}\n`);
        });
    })
    .catch((err) => {
      console.error(`cleanupDownload: ${err.message}\n`);
    });
}

/**
 * Given the path to a file in the download directory, returns
 * the name of the file. If the file is in a subdirectory of the
 * download directory, returns the name of that subdirectory.
 * @param {string} filePath The name of a file that was downloaded
 * @returns {string} The name of the file or directory that was downloaded
 */
export function getFileNameFromPath(filePath: string): string {
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

/**
 * Checks if the given chat already has a status message.
 * @param {dlVars.DlVars} details The dlownload details for the current download
 * @param {Number} chatId The ID of the chat to search in
 * @param {Number} startIndex Start searching from this index
 * @returns {Number} The index of the status. -1 if not found
 */
export function indexOfStatus(details: dlVars.DlVars, chatId: number, startIndex: number): number {
  if (!details) return -1;
  
  var sList = details.statusMsgsList;
  for (var i = startIndex; i < sList.length; i++) {
    if (sList[i].chat.id == chatId) return i;
  }
  return -1;
}

/**
 * Registers a new download status message, and facilitates deletion of the old status messages
 * in the same chat.
 * @param {dlVars.DlVars} details The dlownload details for the current download
 * @param {Object} msg The Message to be added
 */
export function addStatus(details: dlVars.DlVars, msg: TelegramBot.Message) {
  details.statusMsgsList.push(msg);
}

/**
 * Unregisters a status message
 * @param {dlVars.DlVars} details The dlownload details for the current download
 * @param {number} index The index of the message
 */
export function deleteStatus(details: dlVars.DlVars, index: number) {
  details.statusMsgsList.splice(index, 1);
}

/**
 * Finds the path of the file/torrent that Aria2 is downloading from a list of
 * files returned by Aria2.
 * @param {Object[]} files The list of files returned by Aria2
 * @returns {string} The name of the download, or null if it is a torrent metadata.
 */
export function findAriaFilePath(files: any[]): string {
  var filePath = files[0]['path'];
  if (filePath.startsWith(constants.ARIA_DOWNLOAD_LOCATION)) {
    if (filePath.substring(filePath.lastIndexOf('.') + 1) !== 'torrent') {
      // This is not a torrent's metadata
      return filePath;
    } else {
      return null;
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
 * @param {any[]} files The list of files in the download
 * @returns {StatusMessage} An object containing a printable status message and the file name
 */

function timeLeft (totalLength: number, speed: number) {
 var time = (totalLength/1048576)/((speed/125000)/8);
 var second = Math.floor(time%60);
 var minutes = Math.floor((time/60)%60);
 var hours = Math.floor(time/3600);
 if (hours > 999) {
  return 'Calculating';
 } else if (hours === 0 && minutes != 0) {
  return minutes + 'm' + ' ' + second +'s';
 } else if(hours === 0 && minutes === 0) {
 return second + 's';
 } else {
  return hours + 'hr' + ' ' + minutes + 'm' + ' ' + second + 's';
 }
}

export function generateStatusMessage(totalLength: number, completedLength: number, speed: number, files: any[]): StatusMessage {
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
    ` of ${totalLengthStr} at ${speedStr}ps` + '\nETA : ' + timeLeft(totalLength - completedLength,speed) ;
  var status = {
    message: message,
    filename: fileName,
    filesize: totalLengthStr
  };
  return status;
}

export interface StatusMessage {
  message: string;
  filename: string;
  filesize: string;
}

function generateProgress(p: number): string {
  p = Math.min(Math.max(p, 0), 100);
  var str = '[';
  var cFull = Math.floor(p / 8);
  var cPart = p % 8 - 1;
  str += '⣿'.repeat(cFull);
  if (cPart >= 0) {
    str += PROGRESS_INCOMPLETE[cPart];
  }
  str += ' '.repeat(PROGRESS_MAX_SIZE - cFull);
  str = `${str}] ${p}%`;

  return str;
}

export function formatSize(size: number): string {
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

function formatNumber(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isDownloadAllowed(url: string): boolean {
  for (var i = 0; i < constants.ARIA_FILTERED_DOMAINS.length; i++) {
    if (url.indexOf(constants.ARIA_FILTERED_DOMAINS[i]) > -1) return false;
  }
  return true;
}

export function isFilenameAllowed(filename: string): number {
  if (!constants.ARIA_FILTERED_FILENAMES) return 1;
  if (filename === TYPE_METADATA) return -1;

  for (var i = 0; i < constants.ARIA_FILTERED_FILENAMES.length; i++) {
    if (filename.indexOf(constants.ARIA_FILTERED_FILENAMES[i]) > -1) return 0;
  }
  return 1;
}
