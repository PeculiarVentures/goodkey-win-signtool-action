import { promises as fs } from 'fs';
import * as path from 'path';

const serviceFile = 'gksvc.exe';
const keyProvFile = 'gkcng.dll';
const certProvFile = 'gkcertsvc.dll';
const utilFile = 'gkutils.exe';
const allFiles = [serviceFile, keyProvFile, certProvFile, utilFile];

export async function installGoodKey(distDir: string, systemDir: string) {
  for (const file of allFiles) {
    const srcPath = path.join(distDir, file);
    const destPath = path.join(systemDir, file);
    await fs.copyFile(srcPath, destPath);
  }
}