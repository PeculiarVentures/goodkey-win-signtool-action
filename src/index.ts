import * as core from '@actions/core';
import path from 'node:path';
import { SYSTEM_ROOT, installGoodKey, registerUser, sign } from './utils';

const TOKEN = 'token';
const ORGANIZATION = 'organization';
const CERTIFICATE = 'certificate';
const FILE = 'file';

async function run() {
  core.setSecret(core.getInput(TOKEN));
  try {
    const token = core.getInput(TOKEN);
    const organization = core.getInput(ORGANIZATION);
    const certificate = core.getInput(CERTIFICATE);
    const file = core.getInput(FILE);

    await installGoodKey(__dirname, path.join(SYSTEM_ROOT, 'System32'));
    await registerUser(token, organization);
    await sign({
      file,
      certificate,
      timestampUrl: core.getInput('timestamp_url') || undefined,
      description: core.getInput('description') || undefined,
      descriptionUrl: core.getInput('description_url') || undefined,
      additionalCertificates: core.getInput('additional_certificate') || undefined,
      fileDigestAlgorithm: core.getInput('file_digest_algorithm') || undefined,
    });
  }
  catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(`Unknown error: ${error}`);
    }
  }
}

run();
