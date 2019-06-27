import fs = require('fs-extra');
import filenameUtils = require('./filename-utils');
import constants = require('../.constants');

const PROGRESS_MAX_SIZE = Math.floor(100 / 8);
const PROGRESS_INCOMPLETE = ['▏', '▎', '▍', '▌', '▋', '▊', '▉'];

export function deleteDownloadedFile(subdirName: string) {
  fs.remove(`${constants.ARIA_DOWNLOAD_LOCATION}/${subdirName}`)
    .then(() => {
      console.log(`cleanup: Deleted ${subdirName}\n`);
    })
    .catch((err) => {
      console.error(`cleanup: Failed to delete ${subdirName}: ${err.message}\n`);
    });
}

function downloadETA(totalLength: number, completedLength: number, speed: number): string {
  if (speed === 0)
    return '-';
  var time = (totalLength - completedLength) / speed;
  var seconds = Math.floor(time % 60);
  var minutes = Math.floor((time / 60) % 60);
  var hours = Math.floor(time / 3600);

  if (hours === 0) {
    if (minutes === 0) {
      return `${seconds}s`;
    } else {
      return `${minutes}m ${seconds}s`;
    }
  } else {
    return `${hours}h ${minutes}m ${seconds}s`;
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
export function generateStatusMessage(totalLength: number, completedLength: number, speed: number, files: any[]): StatusMessage {
  var filePath = filenameUtils.findAriaFilePath(files);
  var fileName = filenameUtils.getFileNameFromPath(filePath.path, filePath.inputPath, filePath.downloadUri);
  var progress;
  if (totalLength === 0) {
    progress = 0;
  } else {
    progress = Math.round(completedLength * 100 / totalLength);
  }
  var totalLengthStr = formatSize(totalLength);
  var progressString = generateProgress(progress);
  var speedStr = formatSize(speed);
  var eta = downloadETA(totalLength, completedLength, speed);
  var message = `<i>${fileName}</i> - <code>${progressString}</code> of ${totalLengthStr} at ${speedStr}ps, ETA: ${eta}`;
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
  str += '█'.repeat(cFull);
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
