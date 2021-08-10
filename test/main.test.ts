const upDockVersion = '1.2.3';
const gitHubToken = '123';
const email = 'email';
const search = 'search';
const config = '{}';
const dryRun = 'true';
const authentication = 'authentication';
const cache = 'false';
const report = 'true';

process.env['INPUT_UPDOCK-VERSION'] = upDockVersion;
process.env['INPUT_GITHUB-TOKEN'] = gitHubToken;
process.env['INPUT_EMAIL'] = email;
process.env['INPUT_SEARCH'] = search;
process.env['INPUT_CONFIG'] = config;
process.env['INPUT_DRY-RUN'] = dryRun;
process.env['INPUT_AUTHENTICATION'] = authentication;
process.env['INPUT_CACHE'] = cache;
process.env['INPUT_REPORT'] = report;
process.env['GITHUB_REPOSITORY'] = 'TestUser/TestRepo';

jest.mock('../src/wrapper');

import { UpDockWrapper } from '../src/wrapper';
import { run } from '../src/main';

describe('run tests', () => {
    beforeEach(async () => {
        (UpDockWrapper as jest.Mock).mockClear();

        process.env['INPUT_UPDOCK-VERSION'] = upDockVersion;
        process.env['INPUT_GITHUB-TOKEN'] = gitHubToken;
        process.env['INPUT_EMAIL'] = email;
        process.env['INPUT_SEARCH'] = search;
        process.env['INPUT_CONFIG'] = config;
        process.env['INPUT_DRY-RUN'] = dryRun;
        process.env['INPUT_AUTHENTICATION'] = authentication;
        process.env['INPUT_CACHE'] = cache;
        process.env['INPUT_REPORT'] = report;
    });

    it('install and run the wrapper', async () => {
        await run();

        expectValues(
            upDockVersion,
            gitHubToken,
            email,
            search,
            config,
            true,
            authentication,
            false
        );
    });

    it('install and run the wrapper without email', async () => {
        delete process.env['INPUT_EMAIL'];

        await run();

        expectValues(
            upDockVersion,
            gitHubToken,
            '41898282+github-actions[bot]@users.noreply.github.com',
            search,
            config,
            true,
            authentication,
            false
        );
    });

    it('install and run the wrapper without search', async () => {
        delete process.env['INPUT_SEARCH'];

        await run();

        expectValues(
            upDockVersion,
            gitHubToken,
            email,
            'repo:TestUser/TestRepo',
            config,
            true,
            authentication,
            false
        );
    });

    it('install and run the wrapper without config', async () => {
        delete process.env['INPUT_CONFIG'];

        await run();

        expectValues(upDockVersion, gitHubToken, email, search, null, true, authentication, false);
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

        expectValues(null, gitHubToken, email, search, config, true, authentication, false);
    });

    it('install and run the wrapper without authentication', async () => {
        delete process.env['INPUT_AUTHENTICATION'];

        await run();

        expectValues(upDockVersion, gitHubToken, email, search, config, true, null, false);
    });

    it('install and run the wrapper without cache', async () => {
        delete process.env['INPUT_CACHE'];

        let thrown = false;
        try {
            await run();
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
    });

    it('install and run the wrapper without report', async () => {
        delete process.env['INPUT_REPORT'];

        let thrown = false;
        try {
            await run();
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
    });
});

function expectValues(
    version: string | null,
    token: string,
    email: string,
    search: string,
    config: string | null,
    dryRun: boolean,
    authentication: string | null,
    cache: boolean
) {
    expect((UpDockWrapper as jest.Mock).mock.instances.length).toBe(1);

    let constructorCall = (UpDockWrapper as jest.Mock).mock.calls[0];

    expect(constructorCall[0]).toBe(version);
    expect(constructorCall[1]).toBe(token);

    let instance = (UpDockWrapper as jest.Mock).mock.instances[0];

    expect(instance.install.mock.calls.length).toBe(1);
    expect(instance.run.mock.calls.length).toBe(1);

    let call = instance.run.mock.calls[0];

    expect(call[0]).toBe(email);
    expect(call[1]).toBe(search);
    expect(call[2]).toBe(config);
    expect(call[3]).toBe(dryRun);
    expect(call[4]).toBe(authentication);
    expect(call[5]).toBe(cache);
}
