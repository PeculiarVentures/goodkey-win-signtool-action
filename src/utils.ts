import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { X509Certificates } from "@peculiar/x509";

export const SYSTEM_ROOT = process.env['SystemRoot'] || 'C:\\Windows';

const serviceFile = 'gksvc.exe';
const keyProvFile = 'gkcng.dll';
const certProvFile = 'gkcertsvc.dll';
const utilFile = 'gkutils.exe';
const allFiles = [serviceFile, keyProvFile, certProvFile, utilFile];

const execAsync = promisify(exec);

export async function installGoodKey(distDir: string, systemDir: string) {
  try {

    for (const file of allFiles) {
      const srcPath = path.join(distDir, file);
      const destPath = path.join(systemDir, file);
      await fs.copyFile(srcPath, destPath);
    }

    // Register DLLs
    await execAsync(`regsvr32.exe /s "${path.join(systemDir, keyProvFile)}"`);
    await execAsync(`regsvr32.exe /s "${path.join(systemDir, certProvFile)}"`);

    // Install service
    await execAsync(`sc create gksvc binPath= "${path.join(systemDir, serviceFile)}" start= auto`);
    await execAsync(`sc start gksvc`);

    // Wait for the service to start
    let isRunning = false;
    let attempts = 0;
    const maxAttempts = 10; // Maximum number of attempts
    const interval = 400; // Interval between checks in milliseconds

    while (!isRunning && attempts < maxAttempts) {
      const { stdout } = await execAsync(`sc query gksvc`);
      isRunning = stdout.includes('RUNNING');
      if (!isRunning) {
        // Wait for a second before checking again
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      attempts++;
    }

    if (!isRunning) {
      throw new Error('Service did not start within the expected time.');
    }

    // Get User status using `gkutils auth status` and log it
    // const { stdout } = await execAsync(`${path.join(systemDir, utilFile)} auth status`);
    // console.log(stdout);
    // Error: Installation of GoodKey failed: rpc error: code = Unknown desc = Client for GoodKey Server is not initialized. Run 'gkutils auth register' to authenticate.
  } catch (error) {
    if (error instanceof Error) {
      const message = 'stdout' in error && error.stdout ? error.stdout.toString() : error.message;
      throw new Error(`Installation of GoodKey failed: ${message}`);
    }
    throw error;
  }
}

export async function registerUser(token: string, organizationId: string) {
  try {
    const { stdout } = await execAsync(`${path.join(SYSTEM_ROOT, 'System32', utilFile)} auth register -t ${token} -o ${organizationId}`);
    console.log(stdout);
  } catch (error) {
    if (error instanceof Error) {
      const message = 'stdout' in error && error.stdout ? error.stdout.toString() : error.message;
      throw new Error(`Registration of user failed: ${message}`);
    }
    throw error;
  }
}

export interface SignOptions {
  file: string;
  certificate: string;
  timestampUrl?: string;
  timestampRfc3161Url?: string;
  timestampDigestAlgorithm?: string;
  description?: string;
  descriptionUrl?: string;
  additionalCertificates?: string;
  fileDigestAlgorithm?: string;
}

export async function sign(options: SignOptions) {
  try {
    const signtool = await getSignToolPath();
    // signtool.exe sign /v /fd sha256 /a "file" /sha1 "hex(sha1(cert))"
    const args: Record<string, string | string[]> = {};
    if (options.timestampUrl) {
      args['t'] = options.timestampUrl;
    }
    if (options.timestampRfc3161Url) {
      args['tr'] = options.timestampRfc3161Url;
    }
    if (options.timestampDigestAlgorithm) {
      args['td'] = options.timestampDigestAlgorithm;
    }
    if (options.description) {
      args['d'] = options.description;
    }
    if (options.descriptionUrl) {
      args['du'] = options.descriptionUrl;
    }
    if (options.additionalCertificates) {
      const certs = new X509Certificates(options.additionalCertificates);

      const ac: string[] = [];
      // Write file for each certificate
      for (const cert of certs) {
        const thumbprint = await cert.getThumbprint();
        const certFile = path.join(__dirname, `${Buffer.from(new Uint8Array(thumbprint)).toString('hex')}.cer`);
        await fs.writeFile(certFile, Buffer.from(new Uint8Array(cert.rawData)));
        ac.push(certFile);
      }
      args['ac'] = ac;
    }
    if (options.fileDigestAlgorithm) {
      args['fd'] = options.fileDigestAlgorithm;
    }

    let argsString = '';
    for (const key in args) {
      if (Array.isArray(args[key])) {
        for (const value of args[key]) {
          argsString += ` /${key} "${value}"`;
        }
        continue;
      }

      argsString += ` /${key} "${args[key]}"`;
    }

    const command = `"${signtool}" sign /v /a /sha1 ${options.certificate} ${argsString} "${options.file}"`;
    console.log(command);
    const { stdout, stderr } = await execAsync(command);
    console.log(stdout);
    console.log(stderr);
  } catch (error) {
    if (error instanceof Error) {
      const message = 'stdout' in error && error.stdout ? error.stdout.toString() : error.message;
      throw new Error(`Signing of file failed: ${message}`);
    }
    throw error;
  }
}

export async function getSignToolPath(): Promise<string> {
  const rootDir = 'C:\\Program Files (x86)\\Windows Kits';
  const signtoolName = 'signtool.exe';

  const directories = [rootDir];

  while (directories.length > 0) {
    const directory = directories.pop() as string;
    let files = await fs.readdir(directory);

    // Sort files in descending order to get the latest version and prefer x64
    files = files.sort().reverse();

    for (const file of files) {
      const absolutePath = path.join(directory, file);

      const stat = await fs.stat(absolutePath);
      if (file === signtoolName && stat.isFile()) {
        return absolutePath;
      } else if (stat.isDirectory()) {
        directories.push(absolutePath);
      }
    }
  }

  throw new Error('signtool.exe not found');
}