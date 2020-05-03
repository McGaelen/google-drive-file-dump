const fs = require('fs');
const {google} = require('googleapis');
const l = require('./helpers.js');

/**
 * wrapper around GDrive api
**/
class GoogleDriveService {
  drive;

  constructor(auth) {
    this.drive = google.drive({version: 'v3', auth});
  }

  /**
   * @returns Promise<{data: Schema$File}>
  **/
  createFolder(dirName, parentId) {
    const fileMetadata = {
      'name': dirName,
      'mimeType': 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    };
    return this.drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });
  }

  /**
   * @param string entityName - Name of a Directory or File.
   * @returns Promise<{data: { files: Schema$File[] }}>
  **/
  searchForEntity(entityName) {
    return this.drive.files.list({
      q: `name = '${entityName}'`
    });
  }

  /**
   * @returns {data: Schema$File}
  **/
  async uploadFile(filePath, fileName, parentId) {
    const fileSize = fs.statSync(filePath).size;

    const fileMetadata = {
      'name': fileName,
      parents: parentId ? [parentId] : []
    };
    const media = {
      // mimeType: '',
      body: fs.createReadStream(filePath)
    };
    // Use the `onUploadProgress` event from Axios to track the
    // number of bytes uploaded to this point.
    const onUploadProgress = evt => {
      const progress = (evt.bytesRead / fileSize) * 100;
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(`${Math.round(progress)}% complete\t${filePath}`);
    }

    const res = await this.drive.files.create({
      resource: fileMetadata,
      media: media
    }, {
      onUploadProgress: onUploadProgress,
    });
    l(''); // add a new line once complete, since `process.stdout` won't.
    return res;
  }
}

module.exports = GoogleDriveService;
