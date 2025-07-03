import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { CursorReport, CursorUsageResponse } from '../interfaces/types';
import { fetchCursorStats, getCurrentUsageLimit } from '../services/api';
import { getCursorTokenFromDB } from '../services/database';
import { log, getLogHistory } from './logger';
import { getTeamSpend, checkTeamMembership } from '../services/team';
import { getExtensionContext } from '../extension';
import { t } from './i18n';

/**
 * Generates a comprehensive report of the extension's data and API responses
 */
export async function generateReport(): Promise<{ reportPath: string; success: boolean }> {
    log('[Report] Starting report generation');
    
    const context = getExtensionContext();
    const packageJson = require('../../package.json');
    
    // Initialize the report object
    const report: CursorReport = {
        timestamp: new Date().toISOString(),
        extensionVersion: packageJson.version,
        os: `${os.platform()} ${os.release()}`,
        vsCodeVersion: vscode.version,
        cursorStats: null,
        usageLimitResponse: null,
        premiumUsage: null,
        teamInfo: null,
        teamSpend: null,
        rawResponses: {},
        logs: getLogHistory().reverse(),
        errors: {}
    };
    
    try {
        // Get the Cursor token
        const token = await getCursorTokenFromDB();
        if (!token) {
            report.errors.token = 'Failed to retrieve token from database';
            log('[Report] Failed to retrieve token', true);
            return saveReport(report, context);
        }
        
        // Extract user ID from token
        const userId = token.split('%3A%3A')[0];
        
        // Get current date for usage-based pricing (which renews on 2nd/3rd of each month)
        const currentDate = new Date();
        const usageBasedBillingDay = 3; // Assuming it's the 3rd day of the month
        let usageBasedCurrentMonth = currentDate.getMonth() + 1;
        let usageBasedCurrentYear = currentDate.getFullYear();
        
        // If we're in the first few days of the month (before billing date),
        // consider the previous month as the current billing period
        if (currentDate.getDate() < usageBasedBillingDay) {
            usageBasedCurrentMonth = usageBasedCurrentMonth === 1 ? 12 : usageBasedCurrentMonth - 1;
            if (usageBasedCurrentMonth === 12) {
                usageBasedCurrentYear--;
            }
        }

        // Calculate previous month for usage-based pricing
        const usageBasedLastMonth = usageBasedCurrentMonth === 1 ? 12 : usageBasedCurrentMonth - 1;
        const usageBasedLastYear = usageBasedCurrentMonth === 1 ? usageBasedCurrentYear - 1 : usageBasedCurrentYear;

        // Collect data in parallel to speed up the process
        await Promise.all([
            // Get Cursor usage stats
            fetchCursorStats(token)
                .then(stats => {
                    report.cursorStats = stats;
                    log('[Report] Successfully fetched cursor stats');
                })
                .catch(error => {
                    report.errors.cursorStats = `Error fetching stats: ${error.message}`;
                    log('[Report] Error fetching cursor stats: ' + error.message, true);
                }),
            
            // Get usage limit info
            getCurrentUsageLimit(token)
                .then(limitResponse => {
                    report.usageLimitResponse = limitResponse;
                    report.rawResponses.usageLimit = limitResponse;
                    log('[Report] Successfully fetched usage limit info');
                })
                .catch(error => {
                    report.errors.usageLimit = `Error fetching usage limit: ${error.message}`;
                    log('[Report] Error fetching usage limit: ' + error.message, true);
                }),
            
            // Get premium usage directly
            axios.get<CursorUsageResponse>('https://cursor.com/api/usage', {
                params: { user: userId },
                headers: { 
                    Cookie: `WorkosCursorSessionToken=${token}` 
                }
            })
                .then(response => {
                    report.premiumUsage = response.data;
                    report.rawResponses.premiumUsage = response.data;
                    log('[Report] Successfully fetched premium usage data');
                })
                .catch(error => {
                    report.errors.premiumUsage = `Error fetching premium usage: ${error.message}`;
                    log('[Report] Error fetching premium usage: ' + error.message, true);
                }),
            
            // Get team membership info
            checkTeamMembership(token, context)
                .then(teamInfo => {
                    report.teamInfo = {
                        isTeamMember: teamInfo.isTeamMember,
                        teamId: teamInfo.teamId,
                        userId: teamInfo.userId
                    };
                    report.rawResponses.teamInfo = teamInfo;
                    log('[Report] Successfully fetched team membership info');
                    
                    // If user is a team member, fetch team spend data
                    if (teamInfo.isTeamMember && teamInfo.teamId) {
                        return getTeamSpend(token, teamInfo.teamId)
                            .then(teamSpend => {
                                report.teamSpend = teamSpend;
                                report.rawResponses.teamSpend = teamSpend;
                                log('[Report] Successfully fetched team spend data');
                            })
                            .catch((error: any) => {
                                report.errors.teamSpend = `Error fetching team spend: ${error.message}`;
                                log('[Report] Error fetching team spend: ' + error.message, true);
                            });
                    }
                    // Return a resolved promise if user is not a team member
                    return Promise.resolve();
                })
                .catch((error: any) => {
                    report.errors.teamInfo = `Error checking team membership: ${error.message}`;
                    log('[Report] Error checking team membership: ' + error.message, true);
                }),

            // Get current month invoice data
            axios.post('https://cursor.com/api/dashboard/get-monthly-invoice', {
                month: usageBasedCurrentMonth,
                year: usageBasedCurrentYear,
                includeUsageEvents: false
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `WorkosCursorSessionToken=${token}`
                }
            })
                .then(response => {
                    if (!report.rawResponses.monthlyInvoice) {
                        report.rawResponses.monthlyInvoice = {};
                    }
                    report.rawResponses.monthlyInvoice.current = response.data;
                    log('[Report] Successfully fetched current month invoice data');
                })
                .catch(error => {
                    report.errors.currentMonthInvoice = `Error fetching current month invoice: ${error.message}`;
                    log('[Report] Error fetching current month invoice: ' + error.message, true);
                }),

            // Get last month invoice data
            axios.post('https://cursor.com/api/dashboard/get-monthly-invoice', {
                month: usageBasedLastMonth,
                year: usageBasedLastYear,
                includeUsageEvents: false
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `WorkosCursorSessionToken=${token}`
                }
            })
                .then(response => {
                    if (!report.rawResponses.monthlyInvoice) {
                        report.rawResponses.monthlyInvoice = {};
                    }
                    report.rawResponses.monthlyInvoice.last = response.data;
                    log('[Report] Successfully fetched last month invoice data');
                })
                .catch(error => {
                    report.errors.lastMonthInvoice = `Error fetching last month invoice: ${error.message}`;
                    log('[Report] Error fetching last month invoice: ' + error.message, true);
                })
        ]);
        
        log('[Report] All data collection tasks completed');
        
        // Update logs with final entries
        report.logs = getLogHistory().reverse();
        
        return saveReport(report, context);
    } catch (error: any) {
        report.errors.general = `General error: ${error.message}`;
        log('[Report] General error during report generation: ' + error.message, true);
        
        // Update logs with error entries
        report.logs = getLogHistory().reverse();
        
        return saveReport(report, context);
    }
}

/**
 * Saves the report to a JSON file in the extension directory
 */
function saveReport(report: CursorReport, context: vscode.ExtensionContext): Promise<{ reportPath: string; success: boolean }> {
    try {
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `cursor-stats-report-${timestamp}.json`;
        const reportPath = path.join(context.extensionPath, filename);
        
        // Pretty-print the JSON with 2-space indentation
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        log(`[Report] Report saved successfully to: ${reportPath}`);
        return Promise.resolve({ reportPath, success: true });
    } catch (error: any) {
        log('[Report] Error saving report: ' + error.message, true);
        return Promise.resolve({ 
            reportPath: '', 
            success: false 
        });
    }
}
// Register the report generation command
export const createReportCommand = vscode.commands.registerCommand('cursor-stats.createReport', async () => {
    log('[Command] Creating usage report...');
    
    // Show progress notification
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: t('commands.createReportProgress'),
            cancellable: false
        },
        async (progress) => {
            progress.report({ increment: 0, message: t('commands.gatheringData') });
            
            try {
                const result = await generateReport();
                progress.report({ increment: 100, message: t('commands.completed') });
                
                if (result.success) {
                    const folderPath = vscode.Uri.file(result.reportPath).with({ fragment: 'report' });
                    const fileName = result.reportPath.split(/[/\\]/).pop() || 'report.json';
                    const directoryPath = result.reportPath.substring(0, result.reportPath.length - fileName.length);
                    
                    const openOption = await vscode.window.showInformationMessage(
                        t('commands.reportCreatedSuccessfully', { fileName }),
                        t('commands.openFile'),
                        t('commands.openFolder'),
                        t('commands.openGitHubIssues')
                    );
                    
                    if (openOption === t('commands.openFile')) {
                        const fileUri = vscode.Uri.file(result.reportPath);
                        await vscode.commands.executeCommand('vscode.open', fileUri);
                    } else if (openOption === t('commands.openFolder')) {
                        const folderUri = vscode.Uri.file(directoryPath);
                        await vscode.commands.executeCommand('revealFileInOS', folderUri);
                    } else if (openOption === t('commands.openGitHubIssues')) {
                        await vscode.env.openExternal(vscode.Uri.parse('https://github.com/Dwtexe/cursor-stats/issues/new'));
                    }
                } else {
                    vscode.window.showErrorMessage(t('errors.failedToCreateReport'));
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(t('errors.errorCreatingReport', { error: error.message }));
                log('[Report] Error: ' + error.message, true);
            }
        }
    );
});