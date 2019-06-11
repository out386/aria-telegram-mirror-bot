import driveAuth = require('./drive-auth');
import driveFile = require('./upload-file');
import utils = require('./drive-utils');
import { google, drive_v3 } from 'googleapis';


export function uploadFileOrFolder(filePath: string, mime: string, parent: string, callback: (err: string, id: string) => void) {
  driveAuth.call((err, auth) => {
    if (err) {
      callback(err, null);
      return;
    }
    const drive = google.drive({ version: 'v3', auth });

    if (mime === 'application/vnd.google-apps.folder') {
      createFolder(drive, filePath, parent, callback);
    } else {
      driveFile.uploadGoogleDriveFile(parent, {
        filePath: filePath,
        mimeType: mime
      })
        .then(id => callback(null, id))
        .catch(err => callback(err, null));
    }
  });
}

function createFolder(drive: drive_v3.Drive, filePath: string, parent: string, callback: (err: string, id: string) => void) {
  drive.files.create({
    fields: 'id',
    resource: { 
      mimeType: 'application/vnd.google-apps.folder',
      name: filePath.substring(filePath.lastIndexOf('/') + 1),
      parents: [parent]
    }
  },
    (err:Error, res:any) => {
      if (err) {
        callback(err.message, null);
      } else {
        callback(null, res.data.id);
      }
    });
}

export function getSharableLink(fileId:string, isFolder:boolean, callback: (err: string, url: string) => void) {
  driveAuth.call((err, auth) => {
    if (err) {
      callback(err, null);
      return;
    }
    const drive = google.drive({ version: 'v3', auth });

    drive.permissions.create({
      fileId: fileId,
      resource: {
        role: 'reader',
        type: 'anyone'
      }
    },
      (err:Error, res:any) => {
        if (err) {
          callback(err.message, null);
        } else {
          callback(null, utils.getFileLink(fileId, isFolder));
        }
      });
  });
}

