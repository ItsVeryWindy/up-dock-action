import * as core from '@actions/core';
import { context } from '@actions/github';
import { UpDockWrapper } from './wrapper';

export async function run(): Promise<void> {
    try {
        const email =
            core.getInput('email') || '41898282+github-actions[bot]@users.noreply.github.com';

        const version = core.getInput('updock-version') || null;

        const token = core.getInput('github-token', { required: true });

        const search = core.getInput('search') || `repo:${context.repo.owner}/${context.repo.repo}`;

        const config = core.getInput('config') || null;

        const dryRun = core.getBooleanInput('dry-run');

        const wrapper = new UpDockWrapper(version, token);

        await wrapper.install();

        await wrapper.run(email, search, config, dryRun);
    } catch (error) {
        core.setFailed(error.message);
        throw error;
    }
}

if (require.main === module) {
    run();
}
