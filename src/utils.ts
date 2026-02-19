import { promises as fs, createWriteStream } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { globSync } from 'glob';
import { promisify } from 'util';
import { pipeline } from 'stream';
import type { ReadableStream } from 'node:stream/web';

import { X509Certificates } from '@peculiar/x509';
import { Open } from 'unzipper';

export const SYSTEM_ROOT = process.env['SystemRoot'] || 'C:\\Windows';
export const GOODKEY_DOWNLOADS_REPO = 'https://github.com/peculiarventures/goodkey-downloads';

const serviceFile = 'gksvc.exe';
const keyProvFile = 'gkcng.dll';
const certProvFile = 'gkcertsvc.dll';
const utilFile = 'gkutils.exe';
const allFiles = [serviceFile, keyProvFile, certProvFile, utilFile];

const execAsync = (command: string) => {
  return new Promise<{ stdout: string, stderr: string; exitCode?: number | null }>((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      const code = (error as any)?.code;
      const signal = (error as any)?.signal;

      if (error) {
        const execError = new Error(`Command failed${code !== undefined ? ` (code=${code})` : ``}${signal ? ` (signal=${signal})` : ``}: ${command}\n${stderr}`);
        (execError as any).code = code;
        (execError as any).exitCode = code;
        (execError as any).signal = signal;
        (execError as any).stdout = stdout;
        (execError as any).stderr = stderr;
        reject(execError);
      } else {
        resolve({ stdout, stderr, exitCode: 0 });
      }
    });
  });
};

export async function getSignToolFiles(distDir: string, zipName: string, version: string) {
  const versionRegex = /^(\d+\.)?(\d+\.)?(\*|\d+)$/;
  try {
    const streamPipeline = promisify(pipeline);
    let url = `${GOODKEY_DOWNLOADS_REPO}/releases/latest/download/${zipName}`;
    if (versionRegex.test(version)) {
      url = `${GOODKEY_DOWNLOADS_REPO}/releases/download/v${version}/${zipName}`;
    }

    const response = await fetch(url);

    if (!response.body || !response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    await streamPipeline(response.body as ReadableStream<Uint8Array>, createWriteStream(zipName));

    const directory = await Open.file(zipName);
    await directory.extract({ path: distDir });
  } catch (error) {
    if (error instanceof Error) {
      const message = 'stdout' in error && error.stdout ? error.stdout.toString() : error.message;
      throw new Error(`Failed to download files archive: ${message}`);
    }
    throw error;
  }
}

export async function installGoodKey(distDir: string, systemDir: string) {
  try {
    for (const file of allFiles) {
      const srcPath = path.join(distDir, file);
      const destPath = path.join(systemDir, file);
      await fs.copyFile(srcPath, destPath);
    }

    // Register DLLs
    // DEBUG: detect process/runner architecture and prefer Sysnative when running 32-bit Node on 64-bit Windows

    let regsvr32Path = path.join(SYSTEM_ROOT, 'System32', 'regsvr32.exe');
    if (process.arch === 'ia32' && process.env.PROCESSOR_ARCHITEW6432) {
      // 32-bit Node on 64-bit Windows — try Sysnative to reach 64-bit regsvr32
      const sysnative = path.join(SYSTEM_ROOT, 'Sysnative', 'regsvr32.exe');
      try {
        await fs.access(sysnative);
        regsvr32Path = sysnative;
      } catch (err) {
        // Sysnative not available — System32/SysWOW64 redirection may apply
      }
    }

    // Temporarily disable /s (silent) so we can see regsvr32 output in CI logs
    try {
      await execAsync(`"${regsvr32Path}" /s "${path.join(systemDir, keyProvFile)}"`);
    } catch (err) {
      // Some Windows crashes produce STATUS_STACK_BUFFER_OVERRUN (0xC0000409 / 3221226505)
      // Node/Windows may surface this as a large unsigned number or as its signed 32-bit equivalent.
      const code = (err as any)?.code ?? (err as any)?.exitCode;
      const ignoredCodes = new Set<number | null>([3221226505, -1073740791]);
      if (code != null && ignoredCodes.has(code)) {
        const stdout = (err as any)?.stdout ?? '';
        const stderr = (err as any)?.stderr ?? '';
        console.warn(`Warning: registering ${keyProvFile} returned STATUS_STACK_BUFFER_OVERRUN (0xC0000409) (code=${code}). This error is being temporarily ignored; continuing installation. stderr: ${stderr}`);
      } else {
        throw err;
      }
    }

    await execAsync(`"${regsvr32Path}" /s "${path.join(systemDir, certProvFile)}"`);

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
      const stack = 'error' in error && error.error ? error.error.toString() : error.stack;
      const codeInfo = (error as any).code !== undefined ? ` (code=${(error as any).code})` : '';
      throw new Error(`Installation of GoodKey failed: ${message}${codeInfo}, ${stack}`);
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
      const codeInfo = (error as any).code !== undefined ? ` (code=${(error as any).code})` : '';
      throw new Error(`Registration of user failed: ${message}${codeInfo}`);
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

function globFilePathString(filePath: string): string[] {
  const split = /[,\n]/;

  return filePath.split(split)
    .map(pathString => pathString.trimStart())
    .map(pathString => pathString.split(path.sep).join("/"))
    .map(pattern => globSync(pattern, { mark: true }))
    .filter((globResult) => globResult.length)
    .reduce((accumulated, current) => accumulated.concat(current), []);
}

export async function signFile(options: SignOptions) {
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

    const command = `"${signtool}" sign /v /sha1 ${options.certificate} ${argsString} "${options.file}"`;
    console.log(command);
    const { stdout, stderr } = await execAsync(command);
    console.log(stdout);
    console.log(stderr);
  } catch (error) {
    if (error instanceof Error) {
      const message = 'stdout' in error && error.stdout ? error.stdout.toString() : error.message;
      const codeInfo = (error as any).code !== undefined ? ` (code=${(error as any).code})` : '';
      throw new Error(`Signing of file failed: ${message}${codeInfo}`);
    }
    throw error;
  }
}

export async function sign(options: SignOptions) {
  const filePaths = globFilePathString(options.file);

  if (filePaths.length === 0) {
    throw Error(`Files by specified pattern "${options.file}" did not match any files`);
  }

  for (const filePath of filePaths) {
    await signFile({
      ...options,
      file: filePath,
    });
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
