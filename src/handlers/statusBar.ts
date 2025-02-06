import * as vscode from 'vscode';
import { DatabaseService } from '../services/database';
import { log } from '../utils/logger';
import { getCurrentUsageLimit, apiService } from '../services/api';
import { getSessionToken } from '../services/database';

export class StatusBarHandler {
    private statusBarItem: vscode.StatusBarItem;
    private dbService: DatabaseService;

    constructor(context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.dbService = DatabaseService.getInstance();
        this.statusBarItem.command = 'cursor-stats.refreshStats';
        context.subscriptions.push(this.statusBarItem);
        this.refresh();
    }

    public async refresh(): Promise<void> {
        try {
            const token = await this.dbService.getSetting('sessionToken');
            if (!token) {
                this.statusBarItem.text = '$(sync) Cursor Stats: No token';
                this.statusBarItem.tooltip = 'Click to refresh';
                this.statusBarItem.show();
                return;
            }

            const limit = await getCurrentUsageLimit(token);
            if (!limit) {
                this.statusBarItem.text = '$(sync) Cursor Stats: No limit set';
                this.statusBarItem.tooltip = 'Click to refresh';
                this.statusBarItem.show();
                return;
            }

            const usage = this.dbService.getTotalUsage();
            const percentage = Math.round((usage / Number(limit)) * 100);

            const config = vscode.workspace.getConfiguration('cursorStats');
            const showExtended = config.get<boolean>('showExtendedUsage', false);
            const enableColors = config.get<boolean>('enableStatusBarColors', true);
            const customColor = config.get<string>('statusBarColor', '#4CAF50');

            let statusText = showExtended ?
                `$(sync) Cursor Stats: ${usage}/${limit} (${percentage}%)` :
                `$(sync) Cursor Stats: ${percentage}%`;

            this.statusBarItem.text = statusText;
            this.statusBarItem.tooltip = `${usage} tokens used out of ${limit} (${percentage}%)`;

            if (enableColors) {
                if (percentage >= 90) {
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                } else if (percentage >= 75) {
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                } else {
                    this.statusBarItem.backgroundColor = undefined;
                    if (customColor) {
                        this.statusBarItem.color = customColor;
                    }
                }
            }

            this.statusBarItem.show();
        } catch (error) {
            log(`Error refreshing status bar: ${error}`, true);
            this.statusBarItem.text = '$(error) Cursor Stats: Error';
            this.statusBarItem.tooltip = 'Error refreshing stats';
            this.statusBarItem.show();
        }
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}

export function formatTooltipLine(text: string, maxWidth: number = 50): string {
    if (text.length <= maxWidth) return text;
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + word).length > maxWidth) {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word;
        } else {
            currentLine += (currentLine ? ' ' : '') + word;
        }
    }
    if (currentLine) lines.push(currentLine.trim());
    return lines.join('\n   ');
}

export function getMaxLineWidth(lines: string[]): number {
    return Math.max(...lines.map(line => line.length));
}

export function createSeparator(width: number): string {
    const separatorWidth = Math.floor(width / 2);
    return '╌'.repeat(separatorWidth + 5);
}

export function getUsageLimitEmoji(currentCost: number, limit: number): string {
    const percentage = (currentCost / limit) * 100;
    if (percentage >= 90) return '🔴';
    if (percentage >= 75) return '🟡';
    if (percentage >= 50) return '🟢';
    return '✅';
}

export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}

export async function createMarkdownTooltip(lines: string[], isError: boolean = false): Promise<vscode.MarkdownString> {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportHtml = true;
    tooltip.supportThemeIcons = true;

    if (isError) {
        tooltip.appendMarkdown('> ⚠️ **Error State**\n\n');
        tooltip.appendMarkdown(lines.join('\n\n'));
        return tooltip;
    }

    const token = await getSessionToken();
    if (!token) {
        tooltip.appendMarkdown('> ⚠️ No session token found\n\n');
        return tooltip;
    }

    try {
        const limit = await getCurrentUsageLimit(token);
        const isEnabled = !!limit;

        tooltip.appendMarkdown('<div align="center">\n\n');
        tooltip.appendMarkdown('## Cursor Usage\n\n');
        tooltip.appendMarkdown('</div>\n\n');

        if (isEnabled && limit) {
            const usage = lines.find(line => line.includes('tokens used'))?.split(' ')[0];
            if (usage) {
                const percentage = Math.round((Number(usage) / limit) * 100);
                const emoji = getUsageEmoji(percentage);
                tooltip.appendMarkdown(`**Usage:** ${usage} / ${limit} tokens (${percentage}%) ${emoji}\n\n`);
            }
        }

        tooltip.appendMarkdown('---\n\n');
        tooltip.appendMarkdown('<div align="center">\n\n');
        tooltip.appendMarkdown('🌐 [Account Settings](https://www.cursor.com/settings) • ');
        tooltip.appendMarkdown('⚙️ [Extension Settings](command:workbench.action.openSettings?%22@ext%3ADwtexe.cursor-stats%22)\n\n');
        tooltip.appendMarkdown('💰 [Usage Based Pricing](command:cursor-stats.setLimit) • ');
        tooltip.appendMarkdown('🔄 [Refresh](command:cursor-stats.refreshStats)\n\n');
        tooltip.appendMarkdown('</div>');

        return tooltip;
    } catch (error) {
        tooltip.appendMarkdown('> ⚠️ Error fetching usage data\n\n');
        return tooltip;
    }
}

export function getStatusBarColor(percentage: number): string | vscode.ThemeColor {
    const config = vscode.workspace.getConfiguration('cursorStats');
    const colorsEnabled = config.get<boolean>('enableStatusBarColors', true);
    const customColor = config.get<string>('statusBarColor', '#4CAF50');

    if (!colorsEnabled) {
        return customColor;
    }

    if (percentage >= 95) return new vscode.ThemeColor('charts.red');
    if (percentage >= 90) return new vscode.ThemeColor('errorForeground');
    if (percentage >= 85) return new vscode.ThemeColor('testing.iconFailed');
    if (percentage >= 80) return new vscode.ThemeColor('notebookStatusErrorIcon.foreground');
    if (percentage >= 75) return new vscode.ThemeColor('charts.yellow');
    if (percentage >= 70) return new vscode.ThemeColor('notebookStatusRunningIcon.foreground');
    if (percentage >= 65) return new vscode.ThemeColor('charts.orange');
    if (percentage >= 60) return new vscode.ThemeColor('charts.blue');
    if (percentage >= 50) return new vscode.ThemeColor('charts.green');
    if (percentage >= 40) return new vscode.ThemeColor('testing.iconPassed');
    if (percentage >= 30) return new vscode.ThemeColor('terminal.ansiGreen');
    if (percentage >= 20) return new vscode.ThemeColor('symbolIcon.classForeground');
    if (percentage >= 10) return new vscode.ThemeColor('debugIcon.startForeground');

    return customColor;
}

export function getUsageEmoji(percentage: number): string {
    if (percentage >= 90) return '🔴';
    if (percentage >= 75) return '🟡';
    if (percentage >= 50) return '🟢';
    return '✅';
}

export function getMonthName(month: number): string {
    const months = [
        'January', 'February', 'March', 'April',
        'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
}

export function formatStatusBarText(usage: number, total: number): string {
    const config = vscode.workspace.getConfiguration('cursorStats');
    const showExtended = config.get<boolean>('showExtendedUsage', false);

    if (showExtended) {
        return `${usage.toFixed(2)} / ${total.toFixed(2)}`;
    }
    return usage.toFixed(2);
}
