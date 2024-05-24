import * as core from '@actions/core';
import path from 'node:path';
import { installGoodKey } from './utils';

const TOKEN = 'token';
const SYSTEM_ROOT = process.env['SystemRoot'] || 'C:\\Windows';

async function run() {
  core.setSecret(core.getInput(TOKEN));
  try {
    // to System32
    await installGoodKey(__dirname, path.join(SYSTEM_ROOT, 'System32'));
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
