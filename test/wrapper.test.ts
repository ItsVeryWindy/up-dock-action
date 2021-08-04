import io = require('@actions/io');
import os = require('os');
import fs = require('fs');
import path = require('path');
import nock from 'nock';

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;

const IS_WINDOWS = process.platform === 'win32';

const filename = IS_WINDOWS ? 'up-dock.exe' : 'up-dock';

jest.mock('child_process', () => {
    const events = require('events');
    const { PassThrough } = require('stream');

    let data: string;

    const real = jest.requireActual('child_process');
    const mockSpawn = jest.fn(() => {
        const mockSpawnEvent = new events.EventEmitter();

        let stdin = new PassThrough();

        const buffers: Buffer[] = [];

        stdin.on('data', (data: Buffer) => buffers.push(data));
        stdin.on('end', () => (data = Buffer.concat(buffers).toString()));

        mockSpawnEvent.stdin = stdin;

        setTimeout(() => mockSpawnEvent.emit('close', 0), 10);

        return mockSpawnEvent;
    });

    return { ...real, spawn: mockSpawn, stdin: () => data };
});

const child_process = require('child_process');

import { UpDockWrapper } from '../src/wrapper';

describe('wrapper tests', () => {
    beforeAll(async () => {
        process.env.RUNNER_TOOL_CACHE = toolDir;
        process.env.RUNNER_TEMP = tempDir;
        await io.rmRF(toolDir);
        await io.rmRF(tempDir);
    });

    afterAll(async () => {
        try {
            await io.rmRF(toolDir);
            await io.rmRF(tempDir);
        } catch {
            console.log('Failed to remove test directories');
        }
    });

    it('get latest version of up-dock', async () => {
        nock('https://api.github.com')
            .persist()
            .get('/repos/ItsVeryWindy/up-dock/releases?per_page=1')
            .matchHeader('authorization', 'token 123')
            .reply(200, [
                {
                    tag_name: 'v1.0.0'
                }
            ]);

        nock('https://github.com')
            .persist()
            .get('/ItsVeryWindy/up-dock/releases/download/v1.0.0/up-dock-linux-x64')
            .reply(200, 'binary-file');

        await installUpDock(null);

        const filePath = path.join(toolDir, 'up-dock', '1.0.0', 'x64', filename);

        expect(fs.existsSync(filePath)).toBe(true);
        expect(await io.findInPath(filePath)).toStrictEqual([filePath]);
    });

    it('get specific version of up-dock', async () => {
        nock('https://github.com')
            .persist()
            .get('/ItsVeryWindy/up-dock/releases/download/1.1.2/up-dock-linux-x64')
            .reply(200, 'binary-file');

        await installUpDock('1.1.2');

        const filePath = path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename);

        expect(fs.existsSync(filePath)).toBe(true);
        expect(await io.findInPath(filePath)).toStrictEqual([filePath]);
    });

    it('throw if version cannot be installed', async () => {
        nock('https://github.com')
            .persist()
            .get('/ItsVeryWindy/up-dock/releases/download/1.2.3000/up-dock-linux-x64')
            .reply(404);

        let thrown = false;
        try {
            await installUpDock('1.2.3000');
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
    });

    it('throw if install not run', async () => {
        const wrapper = new UpDockWrapper(null, '');

        let thrown = false;
        try {
            await wrapper.run('', '', '', false, null);
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
    });

    it('run up-dock', async () => {
        await runUpDock('emmm', 'aaa', null, false, null);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(
            path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename)
        );
        expect(child_process.spawn.mock.calls[0][1]).toStrictEqual([
            '--email',
            'emmm',
            '--search',
            'aaa',
            '--@token'
        ]);
        expect(child_process.stdin()).toBe(`123${os.EOL}`);
    });

    it('dry run up-dock', async () => {
        await runUpDock('emm', 'bbb', null, true, null);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(
            path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename)
        );
        expect(child_process.spawn.mock.calls[0][1]).toStrictEqual([
            '--email',
            'emm',
            '--search',
            'bbb',
            '--dry-run',
            '--@token'
        ]);
        expect(child_process.stdin()).toBe(`123${os.EOL}`);
    });

    it('run up-dock with config file', async () => {
        await runUpDock('em', 'ccc', '{}', false, null);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(
            path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename)
        );
        expect(child_process.spawn.mock.calls[0][1]).toStrictEqual([
            '--email',
            'em',
            '--search',
            'ccc',
            '--config',
            path.join(tempDir, 'up-dock.json'),
            '--@token'
        ]);
        expect(child_process.stdin()).toBe(`123${os.EOL}`);
    });

    it('run up-dock with authentication', async () => {
        let auth = {
            'repository.com': {
                username: 'my-username',
                password: 'my-password'
            }
        };

        await runUpDock('em', 'ccc', null, false, JSON.stringify(auth));

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(
            path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename)
        );
        expect(child_process.spawn.mock.calls[0][1]).toStrictEqual([
            '--email',
            'em',
            '--search',
            'ccc',
            '--@token',
            '--@auth'
        ]);

        expect(child_process.stdin()).toBe(
            `123${os.EOL}repository.com=my-username,my-password${os.EOL}`
        );
    });
});

async function installUpDock(version: string | null): Promise<void> {
    const wrapper = new UpDockWrapper(version, '123');

    await wrapper.install();
}

async function runUpDock(
    email: string,
    search: string,
    config: string | null,
    dryRun: boolean,
    authentication: string | null
): Promise<void> {
    const wrapper = new UpDockWrapper('1.1.2', '123');

    nock('https://github.com')
        .persist()
        .get('/ItsVeryWindy/up-dock/releases/download/1.1.2/up-dock-linux-x64')
        .reply(200, 'binary-file');

    await wrapper.install();

    await wrapper.run(email, search, config, dryRun, authentication);
}
