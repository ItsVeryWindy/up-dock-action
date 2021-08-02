import io = require('@actions/io');
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

    const real = jest.requireActual('child_process');

    const mockSpawnEvent = new events.EventEmitter();

    const mockSpawn = jest.fn(() => {
        return mockSpawnEvent;
    });

    return { ...real, spawn: mockSpawn, spawnEvent: mockSpawnEvent };
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

        expect(fs.existsSync(path.join(toolDir, 'up-dock', '1.0.0', 'x64', filename))).toBe(true);
    });

    it('get specific version of up-dock', async () => {
        nock('https://github.com')
            .persist()
            .get('/ItsVeryWindy/up-dock/releases/download/1.1.2/up-dock-linux-x64')
            .reply(200, 'binary-file');

        await installUpDock('1.1.2');

        expect(fs.existsSync(path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename))).toBe(true);
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
            await wrapper.run('', '', '', false);
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
    });

    it('run up-dock', async () => {
        await runUpDock('emmm', 'aaa', null, false);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(
            path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename)
        );
        expect(child_process.spawn.mock.calls[0][1]).toStrictEqual([
            '--email',
            'emmm',
            '--search',
            'aaa',
            '--token',
            '123'
        ]);
    });

    it('dry run up-dock', async () => {
        await runUpDock('emm', 'bbb', null, true);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(
            path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename)
        );
        expect(child_process.spawn.mock.calls[0][1]).toStrictEqual([
            '--email',
            'emm',
            '--search',
            'bbb',
            '--token',
            '123',
            '--dry-run'
        ]);
    });

    it('run up-dock with config file', async () => {
        await runUpDock('em', 'ccc', '{}', false);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(
            path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename)
        );
        expect(child_process.spawn.mock.calls[0][1]).toStrictEqual([
            '--email',
            'em',
            '--search',
            'ccc',
            '--token',
            '123',
            '--config',
            path.join(tempDir, 'up-dock.json')
        ]);
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
    dryRun: boolean
): Promise<void> {
    const wrapper = new UpDockWrapper('1.1.2', '123');

    nock('https://github.com')
        .persist()
        .get('/ItsVeryWindy/up-dock/releases/download/1.1.2/up-dock-linux-x64')
        .reply(200, 'binary-file');

    await wrapper.install();

    let runPromise = wrapper.run(email, search, config, dryRun);

    await new Promise(resolve => {
        setTimeout(resolve, 100);
    });

    child_process.spawnEvent.emit('close', 0);

    await runPromise;
}
