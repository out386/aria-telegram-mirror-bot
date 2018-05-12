const driveAuth = require('./drive-auth.js');
const fs = require('fs');
const {google} = require('googleapis');

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
      createFile(drive, filePath, mime, parent, callback);
    }
  });
}

function createFile (drive, filePath, mime, parent, callback) {
  var body = {
    name: filePath.substring(filePath.lastIndexOf('/') + 1),
    mimeType: mime,
    parents: [parent]
  };
  var media = {
    mimeType: mime,
    body: fs.createReadStream(filePath)
  };

  drive.files.create({
    fields: 'id',
    requestBody: body,
    media: media
  },
  (err, res) => {
    if (err) {
      callback(err);
    } else {
      callback(null, res.data.id);
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
        callback(null, getFileLink(fileId, isFolder));
      }
    });
  });
}

function getFileLink (fileId, isFolder) {
  if (isFolder) {
    return 'https://drive.google.com/drive/folders/' + fileId;
  } else {
    return 'https://drive.google.com/uc?id=' + fileId + '&export=download';
  }
}

module.exports.uploadFileOrFolder = uploadFileOrFolder;
module.exports.getSharableLink = getSharableLink;
