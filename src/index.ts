import * as core from '@actions/core';
import path from 'node:path';
import { SYSTEM_ROOT, installGoodKey, registerUser } from './utils';

const TOKEN = 'token';
const ORGANIZATION = 'organization';

async function run() {
  core.setSecret(core.getInput(TOKEN));
  try {
    // to System32
    await installGoodKey(__dirname, path.join(SYSTEM_ROOT, 'System32'));
    await registerUser(core.getInput(TOKEN), core.getInput(ORGANIZATION));
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
