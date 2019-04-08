const downloadUtils = require('./utils.js');
const drive = require('../fs-walk.js');
const Aria2 = require('aria2');
const dlVars = require('./vars.js');
const constants = require('../.constants.js');
const tar = require('../drive/tar.js');
var diskspace = require('diskspace');

const ariaOptions = {
  host: 'localhost',
  port: 8210,
  secure: false,
  secret: constants.ARIA_SECRET,
  path: '/jsonrpc'
};
const aria2 = new Aria2(ariaOptions);

function openWebsocket (callback) {
  aria2.open()
    .then(() => {
      callback(null);
    })
    .catch((err) => {
      callback(err);
    });
}

function setOnDownloadStart (callback) {
  aria2.onDownloadStart = function (keys) {
    callback(keys.gid);
  };
}

function setOnDownloadStop (callback) {
  aria2.onDownloadStop = function (keys) {
    callback(keys.gid);
  };
}

function setOnDownloadComplete (callback) {
  aria2.onDownloadComplete = function (keys) {
    callback(keys.gid);
  };
}

function setOnDownloadError (callback) {
  aria2.onDownloadError = function (keys) {
    callback(keys.gid);
  };
}

function getAriaFilePath (gid, callback) {
  aria2.getFiles(gid, (err, files) => {
    if (err) {
      callback(err);
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
function getStatus (gid, callback) {
  aria2.tellStatus(gid,
    ['status', 'totalLength', 'completedLength', 'downloadSpeed', 'files'],
    (err, res) => {
      var isActive;
      if (err) {
        callback(err);
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

function getFileSize (gid, callback) {
  aria2.tellStatus(gid,
    ['totalLength'],
    (err, res) => {
      if (err) {
        callback(err);
      } else {
        callback(null, res['totalLength']);
      }
    });
}

/**
 * Sets the upload flag, uploads the given path to Google Drive, then calls the callback,
 * cleans up the download directory, and unsets the download and upload flags.
 * If a directory  is given, and isTar is set in vars, archives the directory to a tar
 * before uploading. Archival fails if fileSize is more than or equal to half the free
 * space on disk.
 * @param {string} filePath The path of the file or directory to upload
 * @param {number} fileSize The size of the file
 * @param {function} callback The function to call with the link to the uploaded file
 */
function uploadFile (filePath, fileSize, callback) {
  dlVars.isUploading = true;
  var fileName = downloadUtils.getFileNameFromPath(filePath);
  var realFilePath = constants.ARIA_DOWNLOAD_LOCATION + '/' + fileName;
  if (dlVars.isTar) {
    if (filePath === realFilePath) {
      // If there is only one file, do not archive
      driveUploadFile(realFilePath, fileName, callback);
    } else {
      diskspace.check(constants.ARIA_DOWNLOAD_LOCATION_ROOT, (err, res) => {
        if (err) {
          console.log('uploadFile: diskspace: ' + err);
          // Could not archive, so upload normally
          driveUploadFile(realFilePath, fileName, callback);
          return;
        }
        if (res['free'] > fileSize) {
          console.log('Starting archival');
          var destName = fileName + '.tar';
          tar.archive(fileName, destName, (err) => {
            if (err) callback(err);
            else {
              console.log('Archive complete');
              driveUploadFile(realFilePath + '.tar', destName, callback);
            }
          });
        } else {
          console.log('uploadFile: Not enough space, uploading without archiving');
          driveUploadFile(realFilePath, fileName, callback);
        }
      });
    }
  } else {
    driveUploadFile(realFilePath, fileName, callback);
  }
}

function driveUploadFile (filePath, fileName, callback) {
  drive.uploadRecursive(filePath,
    constants.GDRIVE_PARENT_DIR_ID,
    (err, url) => {
      console.log('uploadFile: deleting');
      callback(err, url, filePath, fileName);
    });
}

function stopDownload (gid, callback) {
  aria2.remove(gid, () => {
    callback();
  });
}

function addUri (uri, callback) {
  aria2.addUri(uri, {dir: constants.ARIA_DOWNLOAD_LOCATION})
    .then((gid) => {
      callback(null, gid);
    })
    .catch((err) => {
      callback(err);
    });
}

module.exports.getAriaFilePath = getAriaFilePath;
module.exports.openWebsocket = openWebsocket;
module.exports.setOnDownloadStart = setOnDownloadStart;
module.exports.setOnDownloadStop = setOnDownloadStop;
module.exports.setOnDownloadComplete = setOnDownloadComplete;
module.exports.setOnDownloadError = setOnDownloadError;
module.exports.uploadFile = uploadFile;
module.exports.addUri = addUri;
module.exports.getStatus = getStatus;
module.exports.stopDownload = stopDownload;
module.exports.getFileSize = getFileSize;
