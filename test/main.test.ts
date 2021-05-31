const upDockVersion = '1.2.3';
const gitHubToken = '123';
const search = 'search';
const config = '{}';
const dryRun = 'true';

process.env['INPUT_UPDOCK-VERSION'] = upDockVersion;
process.env['INPUT_GITHUB-TOKEN'] = gitHubToken;
process.env['INPUT_SEARCH'] = search;
process.env['INPUT_CONFIG'] = config;
process.env['INPUT_DRY-RUN'] = dryRun;
process.env['GITHUB_REPOSITORY'] = 'TestUser/TestRepo';

jest.mock('../src/wrapper');

import { UpDockWrapper } from '../src/wrapper';
import { run } from '../src/main';

describe('run tests', () => {
    beforeEach(async () => {
        (UpDockWrapper as jest.Mock).mockClear();

        process.env['INPUT_UPDOCK-VERSION'] = upDockVersion;
        process.env['INPUT_GITHUB-TOKEN'] = gitHubToken;
        process.env['INPUT_SEARCH'] = search;
        process.env['INPUT_CONFIG'] = config;
        process.env['INPUT_DRY-RUN'] = dryRun;
    });

    it('install and run the wrapper', async () => {
        await run();

        expectValues(upDockVersion, gitHubToken, search, config, true);
    });

    it('install and run the wrapper without search', async () => {
        delete process.env['INPUT_SEARCH'];

        await run();

        expectValues(upDockVersion, gitHubToken, 'repo:TestUser/TestRepo', config, true);
    });

    it('install and run the wrapper without config', async () => {
        delete process.env['INPUT_CONFIG'];

        await run();

        expectValues(upDockVersion, gitHubToken, search, null, true);
    });

    it('install and run the wrapper without dry run', async () => {
        delete process.env['INPUT_DRY-RUN'];

        let thrown = false;
        try {
          await run();
        } catch {
          thrown = true;
        }
        expect(thrown).toBe(true);
    });

    it('install and run the wrapper without token', async () => {
        delete process.env['INPUT_GITHUB-TOKEN'];

        let thrown = false;
        try {
          await run();
        } catch {
          thrown = true;
        }

        expect(thrown).toBe(true);
    });

    it('install and run the wrapper without version', async () => {
        delete process.env['INPUT_UPDOCK-VERSION'];

        await run();

        expectValues(null, gitHubToken, search, config, true);
    });
});

function expectValues(version: string | null, token: string, search: string, config: string | null, dryRun: boolean) {
    expect((UpDockWrapper as jest.Mock).mock.instances.length).toBe(1);

    let constructorCall = (UpDockWrapper as jest.Mock).mock.calls[0];

    expect(constructorCall[0]).toBe(version);
    expect(constructorCall[1]).toBe(token);

    let instance = (UpDockWrapper as jest.Mock).mock.instances[0];

    expect(instance.install.mock.calls.length).toBe(1);
    expect(instance.run.mock.calls.length).toBe(1);

    let call = instance.run.mock.calls[0];

    expect(call[0]).toBe(search);
    expect(call[1]).toBe(config);
    expect(call[2]).toBe(dryRun);
}
