import axios from 'axios';
import * as semver from 'semver';
import { GitHubRelease, ReleaseCheckResult } from '../interfaces/types';
import { log } from '../utils/logger';
import * as vscode from 'vscode';
import { marked } from 'marked';
import { getExtensionContext } from '../extension';
import { t } from '../utils/i18n';

const SHOWN_CHANGELOGS_KEY = 'shownChangelogs';

export async function checkGitHubRelease(): Promise<ReleaseCheckResult | null> {
    try {
        
        // Get current version from package.json
        const packageJson = require('../../package.json');
        const currentVersion = packageJson.version;

        const response = await axios.get('https://api.github.com/repos/dwtexe/cursor-stats/releases');
        const releases: GitHubRelease[] = response.data;

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
            releaseNotes: latestRelease.body,
            releaseName: latestRelease.name,
            zipballUrl: latestRelease.zipball_url,
            tarballUrl: latestRelease.tarball_url,
            assets: latestRelease.assets.map(asset => ({
                name: asset.name,
                downloadUrl: asset.browser_download_url
            }))
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

export async function checkForUpdates(lastReleaseCheck: number, RELEASE_CHECK_INTERVAL: number, specificVersion?: string): Promise<void> {
	try {
		const context = getExtensionContext();
		
		if (specificVersion) {
			// Check if changelog should be shown when explicitly requested on update
			const showChangelogOnUpdate = vscode.workspace.getConfiguration('cursorStats').get('showChangelogOnUpdate', false);
			
			if (!showChangelogOnUpdate) {
				log(`[GitHub] Changelog for specific version ${specificVersion} disabled by user setting`);
				return;
			}
			
			// Show changelog for specific version
			log(`[GitHub] Showing changelog for specific version: ${specificVersion}`);
			const versionQuery = specificVersion.startsWith('v') ? specificVersion : `v${specificVersion}`;
			
			const response = await axios.get(`https://api.github.com/repos/dwtexe/cursor-stats/releases/tags/${versionQuery}`);
			const release: GitHubRelease = response.data;
			
			if (!release) {
				log(`[GitHub] No release found for version ${specificVersion}`);
				return;
			}
			
			// Show changelog directly
			showChangelogWebview(release, specificVersion);
			return;
		}
		
		// Normal update check flow
		const now = Date.now();
		if (now - lastReleaseCheck < RELEASE_CHECK_INTERVAL) {
			log('[GitHub] Skipping update check - too soon since last check');
			return;
		}

		lastReleaseCheck = now;
		const releaseInfo = await checkGitHubRelease();

		if (releaseInfo?.hasUpdate) {
			// Check if changelog should be shown on update
			const showChangelogOnUpdate = vscode.workspace.getConfiguration('cursorStats').get('showChangelogOnUpdate', false);
			
			// Get previously shown changelogs
			const shownChangelogs: string[] = context.globalState.get(SHOWN_CHANGELOGS_KEY, []);
			
			// Check if this version's changelog has been shown before
			if (!shownChangelogs.includes(releaseInfo.latestVersion)) {
				const releaseType = releaseInfo.isPrerelease ? t('github.preRelease') : t('github.stableRelease');
				const message = t('github.updateAvailable', { 
					releaseType: releaseType, 
					releaseName: releaseInfo.releaseName, 
					currentVersion: releaseInfo.currentVersion 
				});
				log(`[GitHub] Showing update notification: ${message}`);

				if (showChangelogOnUpdate) {
					// Show changelog directly without asking
					log('[GitHub] Showing changelog webview...');
					
					// Create the GitHub release object from releaseInfo
					const release: GitHubRelease = {
						tag_name: `v${releaseInfo.latestVersion}`,
						name: releaseInfo.releaseName,
						body: releaseInfo.releaseNotes,
						html_url: releaseInfo.releaseUrl,
						prerelease: releaseInfo.isPrerelease,
						zipball_url: releaseInfo.zipballUrl,
						tarball_url: releaseInfo.tarballUrl,
						assets: releaseInfo.assets.map(asset => ({
							name: asset.name,
							browser_download_url: asset.downloadUrl
						}))
					};
					
					showChangelogWebview(release, releaseInfo.latestVersion);

					// Show a small notification that there's an update, but don't ask for action
					vscode.window.showInformationMessage(message);
				} else {
					log('[GitHub] Update notifications disabled by user setting, skipping changelog and notification');
				}
			} else {
				log(`[GitHub] Changelog for version ${releaseInfo.latestVersion} has already been shown`);
			}
		}
	} catch (error: any) {
		log(`[GitHub] Error checking for updates: ${error.message}`, true);
		log(`[GitHub] Error details: ${JSON.stringify({
			status: error.response?.status,
			data: error.response?.data,
			message: error.message
		})}`, true);
	}
}

function showChangelogWebview(release: GitHubRelease, version: string): void {
	try {
		const context = getExtensionContext();
			const releaseType = release.prerelease ? t('github.preRelease') : t('github.stableRelease');
	
	const panel = vscode.window.createWebviewPanel(
		'releaseNotes',
		t('github.changesTitle', { releaseType: releaseType, version: version }),
		vscode.ViewColumn.One,
		{
			enableScripts: false
		}
	);

		const markdownContent = marked(release.body);

		panel.webview.html = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<style>
					:root {
						--bg-color: var(--vscode-editor-background);
						--text-color: var(--vscode-editor-foreground);
						--border-color: var(--vscode-textSeparator-foreground);
						--heading-color: var(--vscode-textLink-foreground);
						--accent-color: #238636;
						--border-subtle: rgba(240, 246, 252, 0.1);
					}
					body {
						padding: 2rem;
						line-height: 1.5;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
						color: var(--text-color);
						background: var(--bg-color);
						font-size: 14px;
					}
					.container {
						max-width: 1012px;
						margin: 0 auto;
						background: color-mix(in srgb, var(--bg-color) 97%, white);
						border: 1px solid var(--border-subtle);
						border-radius: 6px;
					}
					.release-header {
						padding: 16px;
						background: color-mix(in srgb, var(--bg-color) 98%, white);
						border-bottom: 1px solid var(--border-subtle);
					}
					.release-title {
						font-size: 24px;
						font-weight: 400;
						margin: 0;
						color: var(--text-color);
						display: flex;
						align-items: center;
						justify-content: center;
						gap: 8px;
					}
					.release-tag {
						display: inline-block;
						padding: 0 7px;
						font-size: 12px;
						font-weight: 500;
						line-height: 18px;
						white-space: nowrap;
						border: 1px solid transparent;
						border-radius: 2em;
						background-color: ${release.prerelease ? '#bf8700' : '#238636'};
						color: #fff;
						margin-left: 8px;
					}
					.content {
						padding: 40px;
						font-size: 16px;
					}
					.content h3 {
						font-size: 20px;
						font-weight: 600;
						margin-top: 24px;
						margin-bottom: 16px;
						line-height: 1.25;
						display: flex;
						align-items: center;
						gap: 8px;
					}
					.content pre {
						background: none;
						border: none;
						padding: 0;
						margin: 1em 0;
						font-family: inherit;
						font-size: inherit;
						white-space: pre-wrap;
					}
					.content pre code {
						display: block;
						padding-left: 2em;
						line-height: 1.6;
					}
					.download-section {
						padding: 16px;
						border-top: 1px solid var(--border-subtle);
						border-bottom: 1px solid var(--border-subtle);
					}
					.download-grid {
						display: grid;
						grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
						gap: 8px;
					}
					.download-button {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						padding: 5px 16px;
						font-size: 12px;
						font-weight: 500;
						line-height: 20px;
						white-space: nowrap;
						border: 1px solid var(--border-subtle);
						border-radius: 6px;
						background-color: color-mix(in srgb, var(--bg-color) 95%, white);
						color: var(--text-color);
						text-decoration: none;
						transition: 0.2s ease;
					}
					.download-button:hover {
						background-color: color-mix(in srgb, var(--bg-color) 90%, white);
						border-color: var(--heading-color);
						text-decoration: none;
					}
					.download-button svg {
						margin-right: 8px;
					}
					.footer {
						padding: 16px;
						border-top: 1px solid var(--border-subtle);
						text-align: center;
					}
					a {
						color: var(--heading-color);
						text-decoration: none;
					}
					a:hover {
						text-decoration: underline;
					}
				</style>
			</head>
			<body>
				<div class="container">
					<div class="release-header">
						<h1 class="release-title">
							${release.name}
							<span class="release-tag">${release.prerelease ? t('github.preRelease') : t('github.latest')}</span>
						</h1>
					</div>
					<div class="content">
						${markdownContent}
					</div>
					<div class="download-section">
						<div class="download-grid">
							${release.assets.map(asset => `
								<a href="${asset.browser_download_url}" class="download-button" target="_blank">
									<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor">
										<path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"></path>
										<path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"></path>
									</svg>
									${asset.name}
								</a>
							`).join('')}
							<a href="${release.zipball_url}" class="download-button" target="_blank">
								<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor">
									<path d="M3.5 1.75v11.5c0 .09.048.173.126.217a.75.75 0 0 1-.752 1.298A1.748 1.748 0 0 1 2 13.25V1.75C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v11.5a1.748 1.748 0 0 1-.874 1.515.75.75 0 0 1-.752-1.298.25.25 0 0 0 .126-.217V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM8.75 6.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM8 4.75A.75.75 0 0 1 7.25 4h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 8 4.75ZM8.75 10.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM8 8.75A.75.75 0 0 1 7.25 8h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 8 8.75Z"></path>
								</svg>
								${t('github.sourceCodeZip')}
							</a>
							<a href="${release.tarball_url}" class="download-button" target="_blank">
								<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor">
									<path d="M3.5 1.75v11.5c0 .09.048.173.126.217a.75.75 0 0 1-.752 1.298A1.748 1.748 0 0 1 2 13.25V1.75C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v11.5a1.748 1.748 0 0 1-.874 1.515.75.75 0 0 1-.752-1.298.25.25 0 0 0 .126-.217V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM8.75 6.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM8 4.75A.75.75 0 0 1 7.25 4h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 8 4.75ZM8.75 10.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM8 8.75A.75.75 0 0 1 7.25 8h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 8 8.75Z"></path>
								</svg>
								${t('github.sourceCodeTarGz')}
							</a>
						</div>
					</div>
					<div class="footer">
						<a href="${release.html_url}" target="_blank">${t('github.viewFullRelease')}</a>
					</div>
				</div>
			</body>
			</html>`;
			
		// Add to the shown changelogs array
		const shownChangelogs: string[] = context.globalState.get(SHOWN_CHANGELOGS_KEY, []);
		if (!shownChangelogs.includes(version)) {
			shownChangelogs.push(version);
			context.globalState.update(SHOWN_CHANGELOGS_KEY, shownChangelogs);
			log(`[GitHub] Added version ${version} to shown changelogs`);
		}
		
		// If showing for a specific version, show an installation notification
		if (version !== release.tag_name.replace('v', '')) {
			vscode.window.showInformationMessage(t('github.installedMessage', { version: version }));
		}
	} catch (error: any) {
		log(`[GitHub] Error showing changelog webview: ${error.message}`, true);
	}
}