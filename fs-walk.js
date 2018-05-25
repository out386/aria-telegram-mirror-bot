const fs = require('fs');
const mime = require('mime-types');
const gdrive = require('./drive/drive-upload.js');

/**
 * Recursively uploads a directory or a file to Google Drive. Also makes this upload
 * visible to everyone on Drive, then calls a callback with the public link to this upload.
 * @param {string} path The path of the file or directory to upload
 * @param {string} parent The ID of the Drive folder to upload into
 * @param {function} callback A function to call with an error or the public Drive link
 */
function uploadRecursive (path, parent, callback) {
  fs.stat(path, (err, stat) => {
    if (err) {
      callback(err);
      return;
    }
    if (stat.isDirectory()) {
      gdrive.uploadFileOrFolder(path, 'application/vnd.google-apps.folder', parent, (err, fileId) => {
        if (err) {
          callback(err);
        } else {
          walkSubPath(path, fileId, (err) => {
            if (err) {
              callback(err);
            } else {
              getSharableLink(fileId, true, callback);
            }
          });
        }
      });
    } else {
      processFileOrDir(path, parent, (err, fileId) => {
        if (err) {
          callback(err);
        } else {
          getSharableLink(fileId, false, callback);
        }
      });
    }
  });
}

function getSharableLink (fileId, isFolder, callback) {
  gdrive.getSharableLink(fileId, isFolder, (err, link) => {
    if (err) {
      callback(err);
    } else {
      callback(null, link);
    }
  });
}

function walkSubPath (path, parent, callback) {
  fs.readdir(path, (err, files) => {
    if (err) {
      callback(err);
    } else {
      walkSingleDir(path, files, parent, callback);
    }
  });
}

function walkSingleDir (path, files, parent, callback) {
  if (files.length === 0) {
    callback(null);
    return;
  }

  var uploadNext = function (position) {
    processFileOrDir(path + '/' + files[position], parent, (err, fileId) => {
      if (err) {
        callback(err);
      } else {
        if (++position < files.length) {
          uploadNext(position);
        } else {
          callback(null);
        }
      }
    });
  };
  uploadNext(0);
}

function processFileOrDir (path, parent, callback) {
  console.log('processFileOrDir: ' + path);
  fs.stat(path, (err, stat) => {
    if (err) {
      callback(err);
      return;
    }
    if (stat.isDirectory()) {
      // path is a directory. Do not call the callback until path has been completely traversed.
      gdrive.uploadFileOrFolder(path, 'application/vnd.google-apps.folder', parent, (err, fileId) => {
        if (err) {
          callback(err);
        } else {
          walkSubPath(path, fileId, callback);
        }
      });
    } else {
      var mimeType = mime.lookup(path);
      if (!mimeType) {
        mimeType = 'application/octet-stream';
      }
      gdrive.uploadFileOrFolder(path, mimeType, parent, (err, fileId) => {
        if (err) {
          callback(err);
        } else {
          callback(null, fileId);
        }
      });
    }
  });
}

module.exports.uploadRecursive = uploadRecursive;
