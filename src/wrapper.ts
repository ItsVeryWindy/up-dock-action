import * as exec from '@actions/exec';
import * as path from 'path';
import * as semver from 'semver';
import { getOctokit } from '@actions/github';
import * as os from 'os';
import * as fs from 'fs';
import * as tc from '@actions/tool-cache';

const IS_WINDOWS = process.platform === 'win32';

export class UpDockWrapper {
    private version: string | null;
    private token: string;
    private path: string | null;
    
    constructor(version: string | null, token: string) {
        this.version = version;
        this.token = token;
        this.path = null;
  
        if(!version)
            return;

        if (semver.valid(semver.clean(version) || '') != null) {
            this.version = semver.clean(version) as string;    
            return;
        }

        throw 'Invalid version number!';
    }

    public async install() {
        let version = this.version || await this.getLatestVersion();

        const downloadPath = await tc.downloadTool(`https://github.com/ItsVeryWindy/up-dock/releases/download/${version}/up-dock-linux-x64`);

        const filename = IS_WINDOWS ? 'up-dock.exe' : 'up-dock';

        this.path = path.join(await tc.cacheFile(downloadPath, filename, 'up-dock', version), filename);
    }

    public async run(search: string, config: string | null, dryRun: boolean) {
        if(this.path == null)
            throw 'install method has not been run';

        let configFile = this.createConfigurationFile(config);

        let args = [
            '--search',
            search,
            '--token',
            this.token
        ];

        if(dryRun) {
            args.push('--dry-run');
        }

        if(configFile) {
            args.push('--config', configFile);
        }

        await exec.exec(this.path, args);
    }

    private async getLatestVersion(): Promise<string> {
        const octokit = getOctokit(this.token);

        const releases = await octokit.rest.repos.listReleases({ owner: 'ItsVeryWindy', repo: 'up-dock', 'per_page': 1});

        return releases.data[0].tag_name;
    }

    private createConfigurationFile(config: string | null): string | null {
        if(!config)
            return null;

        const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
        
        const updockConfigPath = path.join(tempDir, 'up-dock.json');

        fs.writeFileSync(updockConfigPath, config);

        return updockConfigPath;
    }
}
