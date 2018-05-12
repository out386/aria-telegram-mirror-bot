const fs = require('fs');
const mime = require('mime-types');

function walkPath (path, callback) {
  fs.readdir(path, (err, files) => {
    if (err) {
      callback(err);
    } else {
      walkSingleDir(path, files, callback);
    }
  });
}

function walkSingleDir (path, files, callback) {
  if (files.length === 0) {
    callback(null);
    return;
  }

  var position = files.length;
  files.forEach(file => {
    processFileOrDir(path + '/' + file, (err) => {
      if (err) {
        callback(err);
      } else {
        if (--position === 0) {
          callback(null);
        }
      }
    });
  });
}

function processFileOrDir (path, callback) {
  fs.stat(path, (err, stat) => {
    if (err) {
      callback(err);
      return;
    }
    if (stat.isDirectory()) {
      console.log('application/vnd.google-apps.folder: ' + path);
      // path is a directory. Do not call the callback until path has been completely traversed.
      walkPath(path, callback);
    } else {
      var mimeType = mime.lookup(path);
      if (mimeType) {
        console.log(mimeType + ': ' + path);
      } else {
        console.log('application/octet-stream: ' + path);
      }
      callback(null);
    }
  });
}

module.exports.walkPath = walkPath;
