const tar = require('tar');
const fs = require('fs');
const constants = require('../.constants.js');

function archive (srcName, destName, callback) {
  var writeStream = fs.createWriteStream(constants.ARIA_DOWNLOAD_LOCATION + '/' + destName);
  var size = 0;
  writeStream.on('close', () => callback(null, size));
  writeStream.on('error', (err) => callback(err, size));

  var stream = tar.c(
    {
      maxReadSize: 163840,
      jobs: 1,
      cwd: constants.ARIA_DOWNLOAD_LOCATION
    },
    [srcName]
  );

  stream.on('error', (err) => callback(err, size));
  stream.on('data', (chunk) => {
    size += chunk.length;
  });

  stream.pipe(writeStream);
}

module.exports.archive = archive;
