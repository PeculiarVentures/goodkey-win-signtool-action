import * as core from '@actions/core';
import path from 'node:path';
import util from 'node:util';
import { exec } from 'child_process';
import { env } from 'process';

const TOKEN = 'token';

async function run() {
  core.setSecret(core.getInput(TOKEN));
  try {

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
