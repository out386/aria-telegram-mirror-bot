function getFileLink (fileId, isFolder) {
  if (isFolder) {
    return 'https://drive.google.com/drive/folders/' + fileId;
  } else {
    return 'https://drive.google.com/uc?id=' + fileId + '&export=download';
  }
}

module.exports.getFileLink = getFileLink;
