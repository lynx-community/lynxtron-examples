import { contextBridge } from '@lynx-js/lynxtron/context-bridge';
import fs from 'fs';
import path from 'path';

contextBridge.exposeInLynxBTS({
  readdir: (dirPath: string) => {
    return fs.promises.readdir(dirPath, { withFileTypes: true }).then(dirents => 
      dirents.map(dirent => ({
        name: dirent.name,
        isDirectory: dirent.isDirectory(),
        isFile: dirent.isFile(),
        path: path.join(dirPath, dirent.name)
      }))
    );
  },

  readFile: (filePath: string) => {
    return fs.promises.readFile(filePath, 'utf8');
  },

  writeFile: (filePath: string, content: string) => {
    return fs.promises.writeFile(filePath, content, 'utf8');
  },

  mkdir: (dirPath: string) => {
    return fs.promises.mkdir(dirPath, { recursive: true });
  },

  stat: (filePath: string) => {
    return fs.promises.stat(filePath).then(stats => ({
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size,
      mtime: stats.mtime
    }));
  },

  basename: path.basename,
  dirname: path.dirname,
  join: path.join,
  resolve: path.resolve,
  sep: path.sep,
  homedir: () => process.env.HOME || process.env.USERPROFILE || '/'
});
