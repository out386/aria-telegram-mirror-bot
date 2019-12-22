/* Copyright seedceo */

const parseRange = require('http-range-parse');
import request = require('request');
import fs = require('fs');
import driveAuth = require('./drive-auth');
import driveUtils = require('./drive-utils');
import { DlVars } from '../dl_model/detail';

interface Chunk {
  bstart: number;
  bend: number;
  cr: string;
  clen: number;
  stime: number;
}

/**
   * Divide the file to multi path for upload
   * @returns {array} array of chunk info
   */
function getChunks(filePath: string, start: number): Chunk[] {
  var allsize = fs.statSync(filePath).size;
  var sep = allsize < (20 * 1024 * 1024) ? allsize : (20 * 1024 * 1024) - 1;
  var ar = [];
  for (var i = start; i < allsize; i += sep) {
    var bstart = i;
    var bend = i + sep - 1 < allsize ? i + sep - 1 : allsize - 1;
    var cr = 'bytes ' + bstart + '-' + bend + '/' + allsize;
    var clen = bend != allsize - 1 ? sep : allsize - i;
    var stime = allsize < (20 * 1024 * 1024) ? 5000 : 10000;
    ar.push({
      bstart: bstart,
      bend: bend,
      cr: cr,
      clen: clen,
      stime: stime
    });
  }
  return ar;
}

/**
   * Upload one chunk to the server
   * @returns {string} file id if any
   */
function uploadChunk(filePath: string, chunk: Chunk, mimeType: string, uploadUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    request.put({
      url: uploadUrl,
      headers: {
        'Content-Length': chunk.clen,
        'Content-Range': chunk.cr,
        'Content-Type': mimeType
      },
      body: fs.createReadStream(filePath, {
        encoding: null,
        start: chunk.bstart,
        end: chunk.bend + 1
      })
    }, function (error, response, body) {
      if (error) {
        console.log(`Upload chunk failed, Error from request module: ${error.message}`);
        return reject(error);
      }

      let headers = response.headers;
      if (headers && headers.range) {
        let range: any = parseRange(headers.range);
        if (range && range.last != chunk.bend) {
          // range is diff, need to return to recreate chunks
          return resolve(range);
        }
      }

      if (!body) {
        console.log(`Upload chunk return empty body.`);
        return resolve(null);
      }

      try {
        body = JSON.parse(body);
      } catch (e) {
        // TODO: So far `body` has been 1 liners here. If large `body` is noticed, change this
        // to dump `body` to a file instead.
        console.log(body);
        return resolve(null);
      }
      if (body && body.id) {
        return resolve(body.id);
      } else {
        console.log(`Got file id null`);
        // Yes, I know this should be a reject, but meh, why bother changing what works
        return resolve(null);
      }
    });
  });
}

export function uploadGoogleDriveFile(dlDetails: DlVars, parent: string, file: { filePath: string; mimeType: string }): Promise<string> {
  var fileName = file.filePath.substring(file.filePath.lastIndexOf('/') + 1);
  return new Promise((resolve, reject) => {
    var size = fs.statSync(file.filePath).size;
    driveAuth.call((err, auth) => {
      if (err) {
        return reject(new Error('Failed to get OAuth client'));
      }
      auth.getAccessToken().then(tokenResponse => {
        var token = tokenResponse.token;
        var options = driveUtils.getPublicUrlRequestHeaders(size, file.mimeType, token, fileName, parent);

        request(options, async function (error: Error, response: request.Response) {
          if (error) {
            return reject(error);
          }

          if (!response) {
            return reject(new Error(`Get drive resumable url return undefined headers`));
          }

          if (!response.headers || !response.headers.location || response.headers.location.length <= 0) {
            return reject(new Error(`Get drive resumable url return invalid headers: ${JSON.stringify(response.headers, null, 2)}`));
          }

          let chunks = getChunks(file.filePath, 0);
          let fileId = null;
          try {
            let i = 0;
            let lastUploadedBytes = 0;
            while (i < chunks.length) {
              // last chunk will return the file id
              fileId = await uploadChunk(file.filePath, chunks[i], file.mimeType, response.headers.location);
              if ((typeof fileId === 'object') && (fileId !== null)) {
                chunks = getChunks(file.filePath, fileId.last);
                i = 0;
                dlDetails.uploadedBytes = dlDetails.uploadedBytes - lastUploadedBytes + fileId.last;
                lastUploadedBytes = fileId.last;
              } else {
                dlDetails.uploadedBytes = dlDetails.uploadedBytes - lastUploadedBytes + chunks[i].bend;
                lastUploadedBytes = chunks[i].bend;
                i++;
              }
            }

            if (fileId && fileId.length > 0) {
              return resolve(fileId);
            } else {
              return reject(new Error('Uploaded and got invalid id for file ' + fileName));
            }
          } catch (er) {
            console.log(`Uploading chunks for file ${fileName} failed: ${er.message}`);
            return reject(er);
          }
        });
      }).catch(err => {
        console.log('Sending request to get resumable url: ' + err.message);
        return reject(err);
      });
    });
  });
}
