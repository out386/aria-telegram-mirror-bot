export function getFileLink(fileId: string, isFolder: boolean): string {
  if (isFolder) {
    return 'https://drive.google.com/drive/folders/' + fileId;
  } else {
    return 'https://drive.google.com/uc?id=' + fileId + '&export=download';
  }
}

export function getPublicUrlRequestHeaders(size: number, mimeType: string, token: string, fileName: string, parent: string): any {
  return {
    method: 'POST',
    url: 'https://www.googleapis.com/upload/drive/v3/files',
    qs: {
      uploadType: 'resumable',
      supportsAllDrives: true
    },
    headers:
    {
      'Postman-Token': '1d58fdd0-0408-45fa-a45d-fc703bff724a',
      'Cache-Control': 'no-cache',
      'X-Upload-Content-Length': size,
      'X-Upload-Content-Type': mimeType,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: {
      name: fileName,
      mimeType: mimeType,
      parents: [parent]
    },
    json: true
  };
}