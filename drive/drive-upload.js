const driveAuth = require('./drive-auth.js');
const {google} = require('googleapis');
const driveFile = require('./upload-file.js');
const utils = require('./drive-utils.js');

function uploadFileOrFolder (filePath, mime, parent, callback) {
  driveAuth.call((err, auth) => {
    if (err) {
      callback(err);
      return;
    }
    const drive = google.drive({version: 'v3', auth});

    if (mime === 'application/vnd.google-apps.folder') {
      createFolder(drive, filePath, parent, callback);
    } else {
      driveFile.uploadGoogleDriveFile(parent, {
        filePath: filePath,
        mimeType: mime
      })
        .then(id => callback(null, id))
        .catch(err => callback(err));
    }
  });
}

function createFolder (drive, filePath, parent, callback) {
  drive.files.create({
    fields: 'id',
    resource: {
      mimeType: 'application/vnd.google-apps.folder',
      name: filePath.substring(filePath.lastIndexOf('/') + 1),
      parents: [parent]
    }
  },
  (err, res) => {
    if (err) {
      callback(err);
    } else {
      callback(null, res.data.id);
    }
  });
}

function getSharableLink (fileId, isFolder, callback) {
  driveAuth.call((err, auth) => {
    if (err) {
      callback(err);
      return;
    }
    const drive = google.drive({version: 'v3', auth});

    drive.permissions.create({
      fileId: fileId,
      resource: {
        role: 'reader',
        type: 'anyone'
      }
    },
    (err, res) => {
      if (err) {
        callback(err);
      } else {
        callback(null, utils.getFileLink(fileId, isFolder));
      }
    });
  });
}

module.exports.uploadFileOrFolder = uploadFileOrFolder;
module.exports.getSharableLink = getSharableLink;
