// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { StatusBarHandler } from './handlers/statusBar';
import { NotificationHandler } from './handlers/notifications';
import { GithubService } from './services/github';
import { ApiService } from './services/api';
import { DatabaseService } from './services/database';
import { log } from './utils/logger';

let extensionContext: vscode.ExtensionContext;
let statusBarHandler: StatusBarHandler;
let notificationHandler: NotificationHandler;
let githubService: GithubService;
let apiService: ApiService;
let dbService: DatabaseService;

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
	log('Activating extension...');
	extensionContext = context;

	try {
		dbService = DatabaseService.getInstance();
		statusBarHandler = new StatusBarHandler(context);
		notificationHandler = NotificationHandler.getInstance();
		githubService = GithubService.getInstance();
		apiService = ApiService.getInstance();

		context.subscriptions.push(
			vscode.commands.registerCommand('cursor-stats.updateToken', async () => {
				try {
					const token = await dbService.getSetting('sessionToken');
					if (token) {
						vscode.window.showInformationMessage('Session token updated successfully!');
						await statusBarHandler.refresh();
					} else {
						vscode.window.showErrorMessage('Failed to update session token.');
					}
				} catch (error: unknown) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					vscode.window.showErrorMessage(`Error updating token: ${errorMessage}`);
				}
			}),

			vscode.commands.registerCommand('cursor-stats.refreshStats', async () => {
				await statusBarHandler.refresh();
			}),

			vscode.commands.registerCommand('cursor-stats.openSettings', () => {
				vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Dwtexe.cursor-stats');
			}),

			vscode.commands.registerCommand('cursor-stats.setLimit', async () => {
				const token = await dbService.getSetting('sessionToken');
				if (!token) {
					vscode.window.showErrorMessage('No session token found. Please update your token first.');
					return;
				}

				const currentLimit = await apiService.getCurrentUsageLimit(token);
				const input = await vscode.window.showInputBox({
					prompt: 'Enter your monthly token limit',
					value: currentLimit?.toString() || '100000',
					validateInput: (value) => {
						const num = parseInt(value);
						return (!isNaN(num) && num > 0) ? null : 'Please enter a valid positive number';
					}
				});

				if (input) {
					const limit = parseInt(input);
					const success = await apiService.setUsageLimit(token, limit);
					if (success) {
						vscode.window.showInformationMessage(`Usage limit updated to ${limit} tokens`);
						await statusBarHandler.refresh();
					} else {
						vscode.window.showErrorMessage('Failed to update usage limit');
					}
				}
			})
		);

		// Check for updates periodically
		setInterval(async () => {
			const currentVersion = vscode.extensions.getExtension('Dwtexe.cursor-stats')?.packageJSON.version;
			if (currentVersion) {
				const hasUpdate = await githubService.checkForUpdates(currentVersion);
				if (hasUpdate) {
					const action = await vscode.window.showInformationMessage(
						'A new version of Cursor Stats is available!',
						'Update Now'
					);
					if (action === 'Update Now') {
						vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', ['Dwtexe.cursor-stats']);
					}
				}
			}
		}, 1000 * 60 * 60); // Check every hour
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		log(`Error during extension activation: ${errorMessage}`, true);
		vscode.window.showErrorMessage(`Failed to activate Cursor Stats: ${errorMessage}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (dbService) {
		dbService.close();
	}
}
