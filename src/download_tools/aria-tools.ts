import downloadUtils = require('./utils');
import drive = require('../fs-walk');
const Aria2 = require('aria2');
import dlVars = require('./vars.js');
import constants = require('../.constants');
import tar = require('../drive/tar');
const diskspace = require('diskspace');

const ariaOptions = {
  host: 'localhost',
  port: 8210,
  secure: false,
  secret: constants.ARIA_SECRET,
  path: '/jsonrpc'
};
const aria2 = new Aria2(ariaOptions);

export function openWebsocket(callback: (err: string) => void) {
  aria2.open()
    .then(() => {
      callback(null);
    })
    .catch((err: string) => {
      callback(err);
    });
}

export function setOnDownloadStart(callback: (gid: string) => void) {
  aria2.onDownloadStart = function (keys: any) {
    callback(keys.gid);
  };
}

export function setOnDownloadStop(callback: (gid: string) => void) {
  aria2.onDownloadStop = function (keys: any) {
    callback(keys.gid);
  };
}

export function setOnDownloadComplete(callback: (gid: string) => void) {
  aria2.onDownloadComplete = function (keys: any) {
    callback(keys.gid);
  };
}

export function setOnDownloadError(callback: (gid: string) => void) {
  aria2.onDownloadError = function (keys: any) {
    callback(keys.gid);
  };
}

export function getAriaFilePath(gid: string, callback: (err: string, file: string) => void) {
  aria2.getFiles(gid, (err: string, files: any[]) => {
    if (err) {
      callback(err, null);
    } else {
      var filePath = downloadUtils.findAriaFilePath(files);
      if (filePath) {
        callback(null, filePath);
      } else {
        callback(null, null);
      }
    }
  });
}

/**
 * Get a human-readable message about the status of the given download. Uses
 * HTML markup. Filename and filesize is always present if the download exists,
 * message is only present if the download is active.
 * @param {string} gid The Aria2 GID of the download
 * @param {function} callback The function to call on completion. (err, message, filename, filesize).
 */
export function getStatus(gid: string, callback: (err: string, message: string, filename: string, filesize: string) => void) {
  aria2.tellStatus(gid,
    ['status', 'totalLength', 'completedLength', 'downloadSpeed', 'files'],
    (err: string, res: any) => {
      var isActive;
      if (err) {
        callback(err, null, null, null);
        console.log('ERROR:', err);
        return;
      } else if (res['status'] === 'active') {
        isActive = true;
      }
      var statusMessage = downloadUtils.generateStatusMessage(parseFloat(res['totalLength']),
        parseFloat(res['completedLength']),
        parseFloat(res['downloadSpeed']),
        res['files']);
      if (!isActive) {
        statusMessage.message = 'No active downloads.';
      }
      callback(null, statusMessage.message, statusMessage.filename, statusMessage.filesize);
    });
}

export function isDownloadMetadata(gid: string, callback: (err: string, isMetadata: boolean) => void) {
  aria2.tellStatus(gid, ['followedBy'], (err: string, res: any) => {
    if (err) {
      callback(err, null);
      console.log('ERROR:', err);
    } else {
      if (res['followedBy']) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    }
  });
}

export function getFileSize(gid: string, callback: (err: string, fileSize: number) => void) {
  aria2.tellStatus(gid,
    ['totalLength'],
    (err: string, res: any) => {
      if (err) {
        callback(err, res);
      } else {
        callback(null, res['totalLength']);
      }
    });
}

interface DriveUploadCompleteCallback {
  (err: string, url: string, filePath: string, fileName: string, fileSize: number): void;
}

/**
 * Sets the upload flag, uploads the given path to Google Drive, then calls the callback,
 * cleans up the download directory, and unsets the download and upload flags.
 * If a directory  is given, and isTar is set in vars, archives the directory to a tar
 * before uploading. Archival fails if fileSize is more than or equal to half the free
 * space on disk.
 * @param {dlVars.DlVars} dlDetails The dlownload details for the current download
 * @param {string} filePath The path of the file or directory to upload
 * @param {number} fileSize The size of the file
 * @param {function} callback The function to call with the link to the uploaded file
 */
export function uploadFile(dlDetails: dlVars.DlVars, filePath: string, fileSize: number, callback: DriveUploadCompleteCallback) {

  dlDetails.isUploading = true;
  var fileName = downloadUtils.getFileNameFromPath(filePath);
  var realFilePath = constants.ARIA_DOWNLOAD_LOCATION + '/' + fileName;
  if (dlDetails.isTar) {
    if (filePath === realFilePath) {
      // If there is only one file, do not archive
      driveUploadFile(realFilePath, fileName, fileSize, callback);
    } else {
      diskspace.check(constants.ARIA_DOWNLOAD_LOCATION_ROOT, (err: string, res: any) => {
        if (err) {
          console.log('uploadFile: diskspace: ' + err);
          // Could not archive, so upload normally
          driveUploadFile(realFilePath, fileName, fileSize, callback);
          return;
        }
        if (res['free'] > fileSize) {
          console.log('Starting archival');
          var destName = fileName + '.tar';
          tar.archive(fileName, destName, (err: string, size: number) => {
            if (err) {
              callback(err, null, null, null, null);
            } else {
              console.log('Archive complete');
              driveUploadFile(realFilePath + '.tar', destName, size, callback);
            }
          });
        } else {
          console.log('uploadFile: Not enough space, uploading without archiving');
          driveUploadFile(realFilePath, fileName, fileSize, callback);
        }
      });
    }
  } else {
    driveUploadFile(realFilePath, fileName, fileSize, callback);
  }
}

function driveUploadFile(filePath: string, fileName: string, fileSize: number, callback: DriveUploadCompleteCallback) {
  drive.uploadRecursive(filePath,
    constants.GDRIVE_PARENT_DIR_ID,
    (err: string, url: string) => {
      console.log('uploadFile: deleting');
      callback(err, url, filePath, fileName, fileSize);
    });
}

export function stopDownload(gid: string, callback: () => void) {
  aria2.remove(gid, () => {
    callback();
  });
}

export function addUri(uri: string, callback: (err: any, gid: string) => void) {
  aria2.addUri([uri], { dir: constants.ARIA_DOWNLOAD_LOCATION })
    .then((gid: string) => {
      callback(null, gid);
    })
    .catch((err: any) => {
      callback(err, null);
    });
}
