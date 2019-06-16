import tar = require('tar');
import fs = require('fs');
import constants = require('../.constants');

export function archive(srcName: string, destName: string, callback: (err: string, size: number) => void) {
  var writeStream = fs.createWriteStream(constants.ARIA_DOWNLOAD_LOCATION + '/' + destName);
  var size = 0;
  writeStream.on('close', () => callback(null, size));
  writeStream.on('error', (err) => callback(err, size));

  var stream = tar.c(
    {
      // @ts-ignore Unknown property error
      maxReadSize: 163840,
      jobs: 1,
      cwd: constants.ARIA_DOWNLOAD_LOCATION
    },
    [srcName]
  );

  stream.on('error', (err: string) => callback(err, size));
  stream.on('data', (chunk:any) => {
    size += chunk.length;
  });

  stream.pipe(writeStream);
}

