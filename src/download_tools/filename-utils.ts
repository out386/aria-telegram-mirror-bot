import constants = require('../.constants');

const TYPE_METADATA = 'Metadata';

interface FilePath {
  path: string,
  /**
   * The path extracted from the files array returned by aria2c.
   * It is present even for metadata, unlike 'path'
   */
  inputPath: string,
  downloadUri: string
}

/**
 * Finds the path of the file/torrent that Aria2 is downloading from a list of
 * files returned by Aria2.
 * @param {Object[]} files The list of files returned by Aria2
 * @returns {string} The name of the download, or null if it is a torrent metadata.
 */
export function findAriaFilePath(files: any[]): FilePath {
  var filePath = files[0]['path'];
  var uri = files[0].uris[0] ? files[0].uris[0].uri : null;

  if (filePath.startsWith(constants.ARIA_DOWNLOAD_LOCATION)) {
    if (filePath.substring(filePath.lastIndexOf('.') + 1) !== 'torrent') {
      // This is not a torrent's metadata
      return { path: filePath, inputPath: filePath, downloadUri: uri };
    } else {
      return { path: null, inputPath: filePath, downloadUri: uri };
    }
  } else {
    return { path: null, inputPath: filePath, downloadUri: uri };
  }
}

/**
 * Given the path to a file in the download directory, returns the name of the
 * file. If the file is in a subdirectory of the download directory, returns
 * the name of that subdirectory.
 * If the path is missing, it tries to return an unreliable name from the URI
 * of the download. If the URI is also missing, returns TYPE_METADATA.
 * @param {string} filePath The name of a file that was downloaded
 * @returns {string} The name of the file or directory that was downloaded
 */
export function getFileNameFromPath(filePath: string, inputPath: string, downloadUri?: string): string {
  if (!filePath) {
    return getFilenameFromUri(inputPath, downloadUri);
  }

  var baseDirLength = constants.ARIA_DOWNLOAD_LOCATION.length;
  var nameEndIndex = filePath.indexOf('/', baseDirLength + 1);
  if (nameEndIndex === -1) {
    nameEndIndex = filePath.length;
  }
  var fileName = filePath.substring(baseDirLength + 1, nameEndIndex);

  if (!fileName) {// This really shouldn't be possible
    return getFilenameFromUri(inputPath, downloadUri);
  }
  return fileName;
}

/**
 * Returns the file name in the torrent metadata, or embedded in the URI. The
 * file name in the URI might not be the actual name of the downloaded file.
 * Use this function only to show messages to the user, and that too, only if
 * aria2c doesn't give a list of files (which happens before the download starts).
 * @param uri The URI of the download
 */
function getFilenameFromUri(path: string, uri: string): string {
  if (path) {
    if (path.startsWith('[METADATA]')) {
      return path.substring(10);
    } else {
      return TYPE_METADATA;
    }
  } else {
    if (uri) {
      return uri.replace(/#.*$|\/\?.*$|\?.*$/, "").replace(/^.*\//, "");
    } else {
      return TYPE_METADATA;
    }
  }

}

export function isFilenameAllowed(filename: string): number {
  if (!constants.ARIA_FILTERED_FILENAMES) return 1;
  if (filename === TYPE_METADATA) return -1;

  for (var i = 0; i < constants.ARIA_FILTERED_FILENAMES.length; i++) {
    if (filename.indexOf(constants.ARIA_FILTERED_FILENAMES[i]) > -1) return 0;
  }
  return 1;
}