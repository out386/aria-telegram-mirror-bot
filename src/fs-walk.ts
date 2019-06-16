import fs = require('fs');
import mime = require('mime-types');
import gdrive = require('./drive/drive-upload');

/**
 * Recursively uploads a directory or a file to Google Drive. Also makes this upload
 * visible to everyone on Drive, then calls a callback with the public link to this upload.
 * @param {string} path The path of the file or directory to upload
 * @param {string} parent The ID of the Drive folder to upload into
 * @param {function} callback A function to call with an error or the public Drive link
 */
export function uploadRecursive(path: string, parent: string, callback: (err: string, url: string) => void) {
  fs.stat(path, (err, stat) => {
    if (err) {
      callback(err.message, null);
      return;
    }
    if (stat.isDirectory()) {
      gdrive.uploadFileOrFolder(path, 'application/vnd.google-apps.folder', parent, 0, (err, fileId) => {
        if (err) {
          callback(err, null);
        } else {
          walkSubPath(path, fileId, (err) => {
            if (err) {
              callback(err, null);
            } else {
              gdrive.getSharableLink(fileId, true, callback);
            }
          });
        }
      });
    } else {
      processFileOrDir(path, parent, (err: string, fileId: string) => {
        if (err) {
          callback(err, null);
        } else {
          gdrive.getSharableLink(fileId, false, callback);
        }
      });
    }
  });
}

/* function getSharableLink (fileId:string, isFolder:boolean, callback) {
  gdrive.getSharableLink(fileId, isFolder, (err, link) => {
    if (err) {
      callback(err);
    } else {
      callback(null, link);
    }
  });
} */

function walkSubPath(path: string, parent: string, callback: (err: string) => void) {
  fs.readdir(path, (err, files) => {
    if (err) {
      callback(err.message);
    } else {
      walkSingleDir(path, files, parent, callback);
    }
  });
}

function walkSingleDir(path: string, files: string[], parent: string, callback: (err: string) => void) {
  if (files.length === 0) {
    callback(null);
    return;
  }

  var uploadNext = function (position: number) {
    processFileOrDir(path + '/' + files[position], parent, (err: string) => {
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

function processFileOrDir(path: string, parent: string, callback: (err: string, fileId?: string) => void) {
  console.log('processFileOrDir: ' + path);
  fs.stat(path, (err, stat) => {
    if (err) {
      callback(err.message);
      return;
    }
    if (stat.isDirectory()) {
      // path is a directory. Do not call the callback until the path has been completely traversed.
      gdrive.uploadFileOrFolder(path, 'application/vnd.google-apps.folder', parent, 0, (err: string, fileId: string) => {
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
      gdrive.uploadFileOrFolder(path, mimeType, parent, stat.size, (err: string, fileId: string) => {
        if (err) {
          callback(err);
        } else {
          callback(null, fileId);
        }
      });
    }
  });
}

