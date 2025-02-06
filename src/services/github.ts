import axios from 'axios';
import * as semver from 'semver';
import { GitHubRelease, ReleaseCheckResult } from '../interfaces/types';
import { log } from '../utils/logger';
import * as vscode from 'vscode';

export async function checkGitHubRelease(): Promise<ReleaseCheckResult | null> {
    try {
        log('[GitHub] Starting release check...');
        
        // Get current version from package.json
        const packageJson = require('../../package.json');
        const currentVersion = packageJson.version;
        log(`[GitHub] Current version: ${currentVersion}`);

        log('[GitHub] Fetching releases from GitHub API...');
        const response = await axios.get('https://api.github.com/repos/dwtexe/cursor-stats/releases');
        const releases: GitHubRelease[] = response.data;
        log(`[GitHub] Fetched ${releases.length} releases from GitHub`);

        if (!releases || releases.length === 0) {
            log('[GitHub] No releases found');
            return null;
        }

        // Find the latest release (can be prerelease or stable)
        const latestRelease = releases[0];
        const latestVersion = latestRelease.tag_name.replace('v', '');
        log(`[GitHub] Latest release: ${latestVersion} (${latestRelease.prerelease ? 'pre-release' : 'stable'})`);

        // Use semver to compare versions
        const hasUpdate = semver.gt(latestVersion, currentVersion);
        log(`[GitHub] Version comparison: ${currentVersion} -> ${latestVersion} (update available: ${hasUpdate})`);

        if (!hasUpdate) {
            log('[GitHub] No update needed - current version is up to date');
            return null;
        }

        log(`[GitHub] Update available: ${latestRelease.name}`);
        log(`[GitHub] Release notes: ${latestRelease.body.substring(0, 100)}...`);

        return {
            hasUpdate,
            currentVersion,
            latestVersion,
            isPrerelease: latestRelease.prerelease,
            releaseUrl: latestRelease.html_url,
            releaseNotes: latestRelease.body
        };
    } catch (error: any) {
        log(`[GitHub] Error checking for updates: ${error.message}`, true);
        log(`[GitHub] Error details: ${JSON.stringify({
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        })}`, true);
        return null;
    }
} 

export async function checkForUpdates(lastReleaseCheck: number, RELEASE_CHECK_INTERVAL: number): Promise<void> {
	const now = Date.now();
	if (now - lastReleaseCheck < RELEASE_CHECK_INTERVAL) {
		log('[GitHub] Skipping update check - too soon since last check');

		return;
	}

	log('[GitHub] Starting periodic update check...');
	lastReleaseCheck = now;
	const releaseInfo = await checkGitHubRelease();

	if (releaseInfo?.hasUpdate) {
		const releaseType = releaseInfo.isPrerelease ? 'Pre-release' : 'Stable release';
		const message = `${releaseType} ${releaseInfo.latestVersion} is available! You are on ${releaseInfo.currentVersion}`;
		log(`[GitHub] Showing update notification: ${message}`);
		
		const selection = await vscode.window.showInformationMessage(
			message,
			'View Release',
			'Ignore'
		);

		if (selection === 'View Release') {
			log('[GitHub] User clicked "View Release" - opening browser...');
			vscode.env.openExternal(vscode.Uri.parse(releaseInfo.releaseUrl));
		} else {
			log('[GitHub] Update notification dismissed');
		}
	} else {
		log('[GitHub] No updates available');
	}
}

export class GithubService {
    private static instance: GithubService;
    private baseUrl = 'https://api.github.com';
    private owner = 'Dwtexe';
    private repo = 'cursor-stats';

    private constructor() {}

    public static getInstance(): GithubService {
        if (!GithubService.instance) {
            GithubService.instance = new GithubService();
        }
        return GithubService.instance;
    }

    public async getLatestRelease(): Promise<string | undefined> {
        try {
            const response = await axios.get(`${this.baseUrl}/repos/${this.owner}/${this.repo}/releases/latest`);
            return response.data.tag_name;
        } catch (error) {
            log(`Error fetching latest release: ${error}`, true);
            return undefined;
        }
    }

    public async checkForUpdates(currentVersion: string): Promise<boolean> {
        const latestVersion = await this.getLatestRelease();
        if (!latestVersion) {
            return false;
        }

        // Remove 'v' prefix if present
        const current = currentVersion.replace(/^v/, '');
        const latest = latestVersion.replace(/^v/, '');

        // Compare versions
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (latestParts[i] > currentParts[i]) {
                return true;
            }
            if (latestParts[i] < currentParts[i]) {
                return false;
            }
        }

        return false;
    }
}