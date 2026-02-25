import * as core from '@actions/core';
import path from 'node:path';
import {
  SYSTEM_ROOT,
  installGoodKey,
  registerUser,
  sign,
  getSignToolFiles,
} from './utils';

const TOKEN = 'token';
const ORGANIZATION = 'organization';
const CERTIFICATE = 'certificate';
const FILE = 'file';

type ActionError = Error & {
  code?: number | string | null;
  exitCode?: number | null;
};

function getErrorCode(error: Error): number | string | null | undefined {
  const typedError = error as ActionError;
  return typedError.code ?? typedError.exitCode;
}

async function run() {
  const startTime = Date.now();
  core.info('🚀 Starting GoodKey Windows SignTool Action');

  const token = core.getInput(TOKEN);
  core.setSecret(token);

  // Step 1: Download SignTool artifacts
  core.startGroup('📦 Downloading GoodKey SignTool artifacts');
  try {
    const version = core.getInput('version');
    core.info(`Requested version: ${version || 'latest'}`);
    await getSignToolFiles(__dirname, 'goodkey-win-signtool-artifacts.zip', version);
    core.info('✅ SignTool artifacts downloaded successfully');
  } catch (error) {
    core.warning(`Failed to download signtool artifacts: ${error}`);
    core.warning('Using default signtool files');
  }
  core.endGroup();

  try {
    const organization = core.getInput(ORGANIZATION);
    const certificate = core.getInput(CERTIFICATE);
    const file = core.getInput(FILE);

    core.info(`📋 Configuration:`);
    core.info(`   Organization ID: ${organization}`);
    core.info(`   Certificate: ${certificate}`);
    core.info(`   File pattern: ${file}`);

    // Step 2: Install GoodKey
    core.startGroup('🔧 Installing GoodKey components');
    const systemDir = path.join(SYSTEM_ROOT, 'System32');
    core.info(`Target directory: ${systemDir}`);
    await installGoodKey(__dirname, systemDir);
    core.info('✅ GoodKey installed successfully');
    core.endGroup();

    // Step 3: Register user
    core.startGroup('🔐 Registering user with GoodKey');
    core.info(`Registering with organization: ${organization}`);
    await registerUser(token, organization);
    core.info('✅ User registered successfully');
    core.endGroup();

    // Step 4: Sign files
    core.startGroup('✍️ Signing files');
    core.info(`File pattern: ${file}`);
    await sign({
      file,
      certificate,
      timestampUrl: core.getInput('timestamp_url') || undefined,
      timestampRfc3161Url: core.getInput('timestamp_rfc3161_url') || undefined,
      timestampDigestAlgorithm: core.getInput('timestamp_digest_algorithm') || undefined,
      description: core.getInput('description') || undefined,
      descriptionUrl: core.getInput('description_url') || undefined,
      additionalCertificates: core.getInput('additional_certificate') || undefined,
      fileDigestAlgorithm: core.getInput('file_digest_algorithm') || undefined,
    });
    core.info('✅ All files signed successfully');
    core.endGroup();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    core.info(`🎉 GoodKey SignTool Action completed successfully in ${duration}s`);
  }
  catch (error) {
    core.endGroup(); // Ensure group is closed on error
    if (error instanceof Error) {
      const code = getErrorCode(error);
      core.setFailed(code !== undefined ? `${error.message} (code=${code})` : error.message);
    } else {
      core.setFailed(`Unknown error: ${error}`);
    }
  }
}

run();
