import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

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

  // Register DLLs
  await exec(`regsvr32.exe /s "${path.join(systemDir, keyProvFile)}"`);
  await exec(`regsvr32.exe /s "${path.join(systemDir, certProvFile)}"`);

  // Install service
  await exec(`sc create gksvc binPath= "${path.join(systemDir, serviceFile)}" start= auto`);

  // Get User status using gkutils
  const { stdout } = await exec(`${path.join(systemDir, utilFile)} auth status`);
  console.log(stdout);
}