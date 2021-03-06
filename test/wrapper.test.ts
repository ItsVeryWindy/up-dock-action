import io = require('@actions/io');
import os = require('os');
import fs = require('fs');
import path = require('path');
import nock from 'nock';
import utils = require('@actions/cache/lib/internal/cacheUtils');
import tar = require('@actions/cache/lib/internal/tar');

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');
const cachePath = 'up-dock-cache.json';
const reportPath = 'up-dock-report.json';
const archiveDir = path.join(tempDir, 'archive');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;
process.env['ACTIONS_CACHE_URL'] = 'http://cache/';

const IS_WINDOWS = process.platform === 'win32';

const filename = IS_WINDOWS ? 'up-dock.exe' : 'up-dock';

const updockPath = path.join(toolDir, 'up-dock', '1.1.2', 'x64', filename);

jest.mock('child_process', () => {
    const events = require('events');
    const { PassThrough } = require('stream');

    let data: string;

    const real = jest.requireActual('child_process');
    const mockSpawn = jest.fn((...args: any[]) => {
        if (args[0] != updockPath) {
            return real.spawn.apply(null, args);
        }

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

async function cleanupFiles() {
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);

    if (fs.existsSync(cachePath)) {
        await fs.promises.rm(cachePath);
    }

    if (fs.existsSync(reportPath)) {
        await fs.promises.rm(reportPath);
    }
}

describe('wrapper tests', () => {
    beforeAll(async () => {
        process.env.RUNNER_TOOL_CACHE = toolDir;
        process.env.RUNNER_TEMP = tempDir;
        process.env.ACTIONS_CACHE_URL = 'http://cache/';
        await cleanupFiles();
    });

    afterAll(async () => {
        try {
            await cleanupFiles();
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
            await wrapper.run('', '', '', false, null, false, false);
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
    });

    it('run up-dock', async () => {
        await runUpDock('emmm', 'aaa', null, false, null, false, false);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(updockPath);
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
        await runUpDock('emm', 'bbb', null, true, null, false, false);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(updockPath);
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
        await runUpDock('em', 'ccc', '{}', false, null, false, false);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(updockPath);
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

        await runUpDock('em', 'ccc', null, false, JSON.stringify(auth), false, false);

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

    it('run up-dock with caching when cache unavailable', async () => {
        nock('http://cache')
            .get(/_apis\/artifactcache\/cache\?keys=up-dock-cache&version=.*/)
            .reply(204)
            .post('/_apis/artifactcache/caches')
            .reply(200, {
                cacheId: 'cache-id'
            })
            .patch('/_apis/artifactcache/caches/cache-id')
            .reply(200)
            .post('/_apis/artifactcache/caches/cache-id')
            .reply(200);

        await fs.promises.writeFile(cachePath, 'cache-file');

        await runUpDock('em', 'ccc', null, false, null, true, false);

        expect(child_process.spawn.mock.calls.length).toEqual(4);

        expect(child_process.spawn.mock.calls[1][0]).toBe(updockPath);
        expect(child_process.spawn.mock.calls[1][1]).toStrictEqual([
            '--email',
            'em',
            '--search',
            'ccc',
            '--@token'
        ]);

        expect(child_process.stdin()).toBe(`123${os.EOL}`);
    });

    it('run up-dock with caching when cache available', async () => {
        await fs.promises.writeFile(cachePath, 'cache-file');

        const compressionMethod = await utils.getCompressionMethod();
        const archivePath = path.join(archiveDir, utils.getCacheFileName(compressionMethod));

        await fs.promises.mkdir(archiveDir);

        await tar.createTar(archiveDir, [cachePath], compressionMethod);

        await fs.promises.rm(cachePath);

        nock('http://cache')
            .get(/_apis\/artifactcache\/cache\?keys=up-dock-cache&version=.*/)
            .reply(200, {
                cacheKey: 'up-dock-cache',
                archiveLocation: 'http://cache/archive-location'
            })
            .get('/archive-location')
            .replyWithFile(200, archivePath, {
                'content-length': fs.statSync(archivePath).size.toString()
            })
            .post('/_apis/artifactcache/caches')
            .reply(200, {
                cacheId: 'cache-id'
            })
            .patch('/_apis/artifactcache/caches/cache-id')
            .reply(200)
            .post('/_apis/artifactcache/caches/cache-id')
            .reply(200);

        await runUpDock('em', 'ccc', null, false, null, true, false);

        expect(child_process.spawn.mock.calls.length).toBe(7);

        expect(child_process.spawn.mock.calls[4][0]).toBe(updockPath);
        expect(child_process.spawn.mock.calls[4][1]).toStrictEqual([
            '--email',
            'em',
            '--search',
            'ccc',
            '--@token',
            '--cache',
            cachePath
        ]);

        expect(child_process.stdin()).toBe(`123${os.EOL}`);
    });

    it('run up-dock with reporting', async () => {
        await fs.promises.writeFile(reportPath, 'report-file');

        const mockStdOut = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

        await runUpDock('em', 'ccc', null, false, null, false, true);

        expect(child_process.spawn.mock.calls.length).toBe(1);

        expect(child_process.spawn.mock.calls[0][0]).toBe(updockPath);
        expect(child_process.spawn.mock.calls[0][1]).toStrictEqual([
            '--email',
            'em',
            '--search',
            'ccc',
            '--@token',
            '--report',
            reportPath
        ]);

        expect(child_process.stdin()).toBe(`123${os.EOL}`);

        expect(mockStdOut).toHaveBeenCalledWith(`::set-output name=report::report-file${os.EOL}`);
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
    authentication: string | null,
    cache: boolean,
    report: boolean
): Promise<void> {
    const wrapper = new UpDockWrapper('1.1.2', '123');

    nock('https://github.com')
        .persist()
        .get('/ItsVeryWindy/up-dock/releases/download/1.1.2/up-dock-linux-x64')
        .reply(200, 'binary-file');

    await wrapper.install();

    await wrapper.run(email, search, config, dryRun, authentication, cache, report);
}
