import * as exec from '@actions/exec';
import * as path from 'path';
import * as semver from 'semver';
import { getOctokit } from '@actions/github';
import * as os from 'os';
import * as fs from 'fs';
import * as tc from '@actions/tool-cache';
import * as c from '@actions/cache';
import * as core from '@actions/core';
import { S_IXGRP, S_IXOTH, S_IXUSR } from 'constants';

const IS_WINDOWS = process.platform === 'win32';

export class UpDockWrapper {
    private version: string | null;
    private token: string;
    private path: string | null;

    public constructor(version: string | null, token: string) {
        this.version = version;
        this.token = token;
        this.path = null;

        if (!version) return;

        if (semver.valid(semver.clean(version) || '') != null) {
            this.version = semver.clean(version) as string;
            return;
        }

        throw new Error('Invalid version number!');
    }

    public async install(): Promise<void> {
        const version = this.version || (await this.getLatestVersion());

        const downloadUrl = `https://github.com/ItsVeryWindy/up-dock/releases/download/${version}/up-dock-linux-x64`;

        core.info(`Downloading tool from '${downloadUrl}'`);

        const downloadPath = await tc.downloadTool(downloadUrl);

        core.info(`Saved tool to '${downloadPath}'`);

        const filename = IS_WINDOWS ? 'up-dock.exe' : 'up-dock';

        const cachePath = await tc.cacheFile(downloadPath, filename, 'up-dock', version);

        this.path = path.join(cachePath, filename);

        core.info(`Copied tool to '${this.path}'`);

        let mode = (await fs.promises.stat(this.path)).mode;

        mode = mode | S_IXUSR | S_IXGRP | S_IXOTH;

        await fs.promises.chmod(this.path, mode);
    }

    public async run(
        email: string,
        search: string,
        config: string | null,
        dryRun: boolean,
        authentication: string | null,
        cache: boolean,
        report: boolean
    ): Promise<void> {
        if (this.path == null) throw new Error('install method has not been run');

        const configFile = this.createConfigurationFile(config);

        const args = ['--email', email, '--search', search];

        if (dryRun) {
            args.push('--dry-run');
        }

        if (configFile) {
            args.push('--config', configFile);
        }

        let input = '';

        args.push('--@token');

        input += `${this.token}${os.EOL}`;

        if (authentication) {
            const authenticationJson = JSON.parse(authentication);

            for (const key in authenticationJson) {
                args.push('--@auth');

                const item = authenticationJson[key];

                input += `${key}=${item.username},${item.password}${os.EOL}`;
            }
        }

        const cacheFile = 'up-dock-cache.json';

        if (cache) {
            const cacheKey = await c.restoreCache([cacheFile], 'up-dock-cache');

            if (cacheKey && fs.existsSync(cacheFile)) {
                args.push('--cache');
                args.push(cacheFile);
            }
        }

        const reportFile = 'up-dock-report.json';

        if (report) {
            args.push('--report');
            args.push(reportFile);
        }

        await exec.exec(this.path, args, { input: Buffer.from(input) });

        if (cache && fs.existsSync(cacheFile)) {
            await c.saveCache([cacheFile], 'up-dock-cache');
        }

        if (report && fs.existsSync(reportFile)) {
            const reportContents = await fs.promises.readFile(reportFile, 'utf8');

            core.setOutput('report', reportContents);
        }
    }

    private async getLatestVersion(): Promise<string> {
        const octokit = getOctokit(this.token);

        const releases = await octokit.rest.repos.listReleases({
            owner: 'ItsVeryWindy',
            repo: 'up-dock',
            per_page: 1
        });

        return releases.data[0].tag_name;
    }

    private createConfigurationFile(config: string | null): string | null {
        if (!config) return null;

        const tempDir = process.env.RUNNER_TEMP || os.tmpdir();

        const updockConfigPath = path.join(tempDir, 'up-dock.json');

        fs.writeFileSync(updockConfigPath, config);

        return updockConfigPath;
    }
}
