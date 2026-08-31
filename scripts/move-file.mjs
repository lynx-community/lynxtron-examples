import { copyFile, rename, unlink } from 'node:fs/promises';

/** Move a file, falling back to copy+unlink when source and destination are on different volumes. */
export async function moveFile(source, destination, operations = {}) {
  const renameFile = operations.renameFile ?? rename;
  const copy = operations.copyFile ?? copyFile;
  const removeSource = operations.unlinkFile ?? unlink;

  try {
    await renameFile(source, destination);
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    await copy(source, destination);
    await removeSource(source);
  }
}
