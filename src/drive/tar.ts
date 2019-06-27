import tar = require('tar');
import fs = require('fs');

export function archive(srcPath: string, destName: string, callback: (err: string, size: number) => void) {
  var dlDirPath = srcPath.substring(0, srcPath.lastIndexOf('/'));
  var writeStream = fs.createWriteStream(`${dlDirPath}/${destName}`);
  var size = 0;
  writeStream.on('close', () => callback(null, size));
  writeStream.on('error', (err) => callback(err, size));

  var stream = tar.c(
    {
      // @ts-ignore Unknown property error
      maxReadSize: 163840,
      jobs: 1,
      cwd: dlDirPath
    },
    [srcPath]
  );

  stream.on('error', (err: string) => callback(err, size));
  stream.on('data', (chunk:any) => {
    size += chunk.length;
  });

  stream.pipe(writeStream);
}

