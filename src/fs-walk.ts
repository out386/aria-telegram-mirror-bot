import fs = require('fs');
import mime = require('mime-types');
import gdrive = require('./drive/drive-upload');
import { DlVars } from './dl_model/detail';

/**
 * Recursively uploads a directory or a file to Google Drive. Also makes this upload
 * visible to everyone on Drive, then calls a callback with the public link to this upload.
 * @param {string} path The path of the file or directory to upload
 * @param {string} parent The ID of the Drive folder to upload into
 * @param {function} callback A function to call with an error or the public Drive link
 */
export function uploadRecursive(dlDetails: DlVars, path: string, parent: string, callback: (err: string, url: string, isFolder: boolean) => void): void {
  fs.stat(path, (err, stat) => {
    if (err) {
      callback(err.message, null, false);
      return;
    }
    if (stat.isDirectory()) {
      gdrive.uploadFileOrFolder(dlDetails, path, 'application/vnd.google-apps.folder', parent, 0,
        (err, fileId) => {
          if (err) {
            callback(err, null, false);
          } else {
            walkSubPath(dlDetails, path, fileId, (err) => {
              if (err) {
                callback(err, null, false);
              } else {
                gdrive.getSharableLink(fileId, true, callback);
              }
            });
          }
        });
    } else {
      processFileOrDir(dlDetails, path, parent, (err: string, fileId: string) => {
        if (err) {
          callback(err, null, false);
        } else {
          gdrive.getSharableLink(fileId, false, callback);
        }
      });
    }
  });
}

function walkSubPath(dlDetails: DlVars, path: string, parent: string, callback: (err: string) => void): void {
  fs.readdir(path, (err, files) => {
    if (err) {
      callback(err.message);
    } else {
      walkSingleDir(dlDetails, path, files, parent, callback);
    }
  });
}

function walkSingleDir(dlDetails: DlVars, path: string, files: string[], parent: string, callback: (err: string) => void): void {
  if (files.length === 0) {
    callback(null);
    return;
  }

  var uploadNext = function (position: number): void {
    processFileOrDir(dlDetails, path + '/' + files[position], parent, (err: string) => {
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

function processFileOrDir(dlDetails: DlVars, path: string, parent: string, callback: (err: string, fileId?: string) => void): void {
  fs.stat(path, (err, stat) => {
    if (err) {
      callback(err.message);
      return;
    }
    if (stat.isDirectory()) {
      // path is a directory. Do not call the callback until the path has been completely traversed.
      gdrive.uploadFileOrFolder(dlDetails, path, 'application/vnd.google-apps.folder', parent, 0, (err: string, fileId: string) => {
        if (err) {
          callback(err);
        } else {
          walkSubPath(dlDetails, path, fileId, callback);
        }
      });
    } else {
      var mimeType = mime.lookup(path);
      if (!mimeType) {
        mimeType = 'application/octet-stream';
      }
      gdrive.uploadFileOrFolder(dlDetails, path, mimeType, parent, stat.size, (err: string, fileId: string) => {
        if (err) {
          callback(err);
        } else {
          callback(null, fileId);
        }
      });
    }
  });
}

