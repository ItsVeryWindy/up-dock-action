import * as core from '@actions/core';
import { context } from '@actions/github';
import { UpDockWrapper } from './wrapper';

export async function run() {
  try {
    let version = core.getInput('updock-version') || null;

    let token = core.getInput('github-token', { required: true });

    let search = core.getInput('search') || `repo:${context.repo.owner}/${context.repo.repo}`;

    let config = core.getInput('config') || null;

    let dryRun = core.getBooleanInput('dry-run');

    const wrapper = new UpDockWrapper(version, token);

    await wrapper.install();

    await wrapper.run(search, config, dryRun);

  } catch (error) {
    core.setFailed(error.message);
    throw error;
  }
}

if (require.main === module) {
  run();
}
