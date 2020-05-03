const fs = require('fs');
const OAuth = require('./OAuth.js');
const l = require('./helpers.js');
const GoogleDriveService = require('./GoogleDriveService.js')

const ROOT_FOLDER = 'Videos Backup';

class Main {
  /** @type GoogleDriveService **/
  driveService;
  /**
   * Id for the folder where everything will be dumped. (the id for ROOT_FOLDER) 
   * @type string
   **/
  rootGDriveFolderId;
  /**
   * Name of the folder on the file system that we want to dump into GDrive.
   * @type string
  **/
  rootFSFolderName;
  /**
   * List of all the full paths for every individual file to be uploaded.
   * Path is relative to ROOT_FOLDER
   * @type string[]
  **/
  fileList = [];
  /**
   * Record of directory name -> corresponding ID in GDrive.
   * key: string - name of directory
   * value: string - GDriveId of directory
  **/
  createdDirectories = new Map();

  constructor(rootFSFolderName) {
    this.rootFSFolderName = rootFSFolderName || '.';
    new OAuth(this.uploadFiles.bind(this));
  }

  async uploadFiles(auth) {
    try {
      this.driveService = new GoogleDriveService(auth);
      this.rootGDriveFolderId = await this.findOrCreateRootFolder();

      // this call sets `this.fileList`
      await this.scanDirectories(this.rootFSFolderName);
      
      // for every file, create the directory structure to match and upload the file.
      for (const filePath of this.fileList) {
        const pathArray = filePath.split('/');
        const fileName = pathArray.pop(); // Remove the actual file from the path so we don't iterate over it.
        const immediateParentDirName = pathArray.peek();

        await this.createDirectoryHierarchy(pathArray);

        // upload the file if it doesn't already exist.
        const gDriveFile = await this.driveService.searchForEntity(fileName);
        if (!gDriveFile.data.files.length) {
          await this.driveService.uploadFile(filePath, fileName, this.createdDirectories.get(immediateParentDirName))
        } else {
          l(`skipped\t\t${filePath}`);
        }
      }

    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  /**
   * @returns {string} Root folder id
  **/
  async findOrCreateRootFolder() {
    const findRootFolderResp = await this.driveService.searchForEntity(ROOT_FOLDER);
    const findRootFolderResults = findRootFolderResp.data.files;

    if (findRootFolderResults.length) {
      l(`preexisting root folder: ${findRootFolderResults[0].id}`)
      return findRootFolderResults[0].id;
    } else {
      const createFolderResp = await this.driveService.createFolder(ROOT_FOLDER);
      l(`creating root folder: ${createFolderResp.data.id}`)
      return createFolderResp.data.id;
    }
  }

  /**
   * Recursively scans directories and populates `this.fileList`
  **/
  async scanDirectories(startPoint) {
    const dir = fs.opendirSync(startPoint);
    for await (const dirent of dir) {
      if (dirent.isDirectory()) {
        await this.scanDirectories(`${startPoint}/${dirent.name}`);
      } else if (dirent.isFile() || dirent.isSymbolicLink()) {
        this.fileList.push(`${startPoint}/${dirent.name}`);
      }
    }
  }

  /**
   * Creates a hierarchy of directories in GDrive to match pathArray,
   * with the first element in pathArray being the topmost parent,
   * and the last element in pathArray being the farthest child.
  **/
  async createDirectoryHierarchy(pathArray) {
    // for every directory in the path, create it if doesn't exist, and add it to our record of createdDirectories.
    for (const [index, dirName] of pathArray.entries()) {
      // if we don't know the ID for a directory already, see if it exists in GDrive.
      if (!this.createdDirectories.has(dirName)) {
        const gDriveDir = await this.driveService.searchForEntity(dirName);
        // if there are no results from GDrive, create it.
        if (!gDriveDir.data.files.length) {
          const createResponse = await this.driveService.createFolder(dirName, (index === 0 ? this.rootGDriveFolderId : this.createdDirectories.get(pathArray[index-1])));
          this.createdDirectories.set(dirName, createResponse.data.id);
        } else {
          // otherwise, add the ID for this directory that we got back from GDrive.
          this.createdDirectories.set(dirName, gDriveDir.data.files[0].id);
        }
      }
    }
  }
}

new Main(process.argv[2]);
