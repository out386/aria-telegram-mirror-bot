const downloadUtils = require('./utils.js');
const drive = require('../fs-walk.js');
const Aria2 = require('aria2');
const dlVars = require('./vars.js');
const constants = require('../.constants.js');

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
 * HTML markup.
 * @param {string} gid The Aria2 GID of the download
 * @param {function} callback The function to call with an error or the status message
 */
function getStatus (gid, callback) {
  aria2.tellStatus(gid,
    ['status', 'totalLength', 'completedLength', 'downloadSpeed', 'files'],
    (err, res) => {
      if (err) {
        callback(err);
      } else if (res['status'] !== 'active') {
        callback(null, 'No active downloads.');
      } else {
        var statusMessage = downloadUtils.generateStatusMessage(parseFloat(res['totalLength']),
          parseFloat(res['completedLength']),
          parseFloat(res['downloadSpeed']),
          res['files']);
        callback(null, statusMessage);
      }
    });
}

/**
 * Sets the upload flag, uploads the given path to Google Drive, then calls the callback,
 * cleans up the download directory, and unsets the download and upload flags.
 * @param {string} filePath The path of the file or directory to upload
 * @param {function} callback The function to call with the link to the uploaded file
 */
function uploadFile (filePath, callback) {
  dlVars.isUploading = true;
  var fileName = downloadUtils.getFileNameFromPath(filePath);
  filePath = constants.AIRA_DOWNLOAD_LOCATION + '/' + fileName;
  drive.uploadRecursive(filePath,
    constants.GDRIVE_PARENT_DIR_ID,
    (err, url) => {
      callback(err, url, filePath, fileName);
      downloadUtils.cleanupDownload();
    });
}

function stopDownload (gid, callback) {
  aria2.remove(gid, () => {
    callback();
  });
}

function addUri (uri, callback) {
  aria2.addUri(uri, {dir: constants.AIRA_DOWNLOAD_LOCATION})
    .then((gid) => {
      callback(null, gid);
    })
    .catch((err) => {
      callback(err);
    });
}

module.exports.getAriaFiles = getAriaFilePath;
module.exports.openWebsocket = openWebsocket;
module.exports.setOnDownloadStart = setOnDownloadStart;
module.exports.setOnDownloadStop = setOnDownloadStop;
module.exports.setOnDownloadComplete = setOnDownloadComplete;
module.exports.setOnDownloadError = setOnDownloadError;
module.exports.uploadFile = uploadFile;
module.exports.addUri = addUri;
module.exports.getStatus = getStatus;
module.exports.stopDownload = stopDownload;
