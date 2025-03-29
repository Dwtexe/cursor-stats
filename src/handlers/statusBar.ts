import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { getCurrentUsageLimit } from '../services/api';
import { getCursorTokenFromDB } from '../services/database';


let statusBarItem: vscode.StatusBarItem;

export function createStatusBarItem(): vscode.StatusBarItem {
    log('[Status Bar] Creating status bar item...');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    log('[Status Bar] Status bar alignment: Right, Priority: 100');
    return statusBarItem;
}

export function formatTooltipLine(text: string, maxWidth: number = 50): string {
    if (text.length <= maxWidth) {
        return text;
    }
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + word).length > maxWidth) {
            if (currentLine) {
                lines.push(currentLine.trim());
            }
            currentLine = word;
        } else {
            currentLine += (currentLine ? ' ' : '') + word;
        }
    }
    if (currentLine) {
        lines.push(currentLine.trim());
    }
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
    if (percentage >= 90) {
        return '🔴';
    }
    if (percentage >= 75) {
        return '🟡';
    }
    if (percentage >= 50) {
        return '🟢';
    }
    return '✅';
}

export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Generates a progress bar based on the current usage and limit.
 * @param current - The current usage amount.
 * @param max - The maximum allowed usage.
 * @param overrideMax - An optional override for the maximum value.
 * @param size - The size of the progress bar.
 */
export function generateProgressBar(current: number, max: number, overrideMax: number | null = null, size: number = 10): string {
    // Calculate the percentage filled, handling cases where current > max
    const isOverLimit = current > max;
    const effectiveMax = overrideMax !== null && isOverLimit ? overrideMax : max;
    const percentage = Math.min(100, (current / effectiveMax) * 100);
    
    // Calculate filled boxes
    const filledBoxes = Math.round((percentage / 100) * size);
    
    // For over-limit cases, we need to show the limit marker
    let progressBar = '';
    
    if (isOverLimit) {
        // Calculate where the limit marker should be
        const limitMarkerPosition = Math.round((max / effectiveMax) * size);
        
        // Build the bar with different colors
        for (let i = 0; i < size; i++) {
            if (i < limitMarkerPosition) {
                progressBar += i < filledBoxes ? '🟩' : '⬜';
            } else {
                progressBar += i < filledBoxes ? '🟥' : '⬜';
            }
        }
    } else {
        // Normal case - just show filled and empty boxes
        progressBar = '🟩'.repeat(filledBoxes) + '⬜'.repeat(size - filledBoxes);
    }
    
    return progressBar;
}

/**
 * Generates a progress bar for a specific period.
 * @param startDate - The start date of the period.
 * @param endDate - The end date of the period.
 * @param size - The size of the progress bar.
 */
export function generatePeriodProgressBar(startDate: Date, endDate: Date, size: number = 10): string {
    const now = new Date();
    const totalPeriodMs = endDate.getTime() - startDate.getTime();
    const elapsedMs = now.getTime() - startDate.getTime();
    
    // Make sure we don't go below 0 or above 100%
    const percentage = Math.max(0, Math.min(100, (elapsedMs / totalPeriodMs) * 100));
    
    // Calculate filled boxes
    const filledBoxes = Math.round((percentage / 100) * size);
    
    return '🟦'.repeat(filledBoxes) + '⬜'.repeat(size - filledBoxes);
}

export async function createMarkdownTooltip(lines: string[], isError: boolean = false): Promise<vscode.MarkdownString> {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportHtml = true;
    tooltip.supportThemeIcons = true;

    // Header section with centered title
    tooltip.appendMarkdown('<div align="center">\n\n');
    tooltip.appendMarkdown('## ⚡ Cursor Usage\n\n');
    tooltip.appendMarkdown('</div>\n\n');

    if (isError) {
        tooltip.appendMarkdown('> ⚠️ **Error State**\n\n');
        tooltip.appendMarkdown(lines.join('\n\n'));
    } else {
        // Premium Requests Section
        if (lines.some(line => line.includes('Premium Fast Requests'))) {
            tooltip.appendMarkdown('<div align="center">\n\n');
            tooltip.appendMarkdown('### 🚀 Premium Fast Requests\n\n');
            tooltip.appendMarkdown('</div>\n\n');
            
            // Extract and format premium request info
            const requestLine = lines.find(line => line.includes('requests used'));
            const percentLine = lines.find(line => line.includes('utilized'));
            const startOfMonthLine = lines.find(line => line.includes('Fast Requests Period:'));
            
            if (requestLine && startOfMonthLine) {
                // Extract period dates for visualization
                const periodText = startOfMonthLine.split(':')[1].trim();
                const [startDateStr, endDateStr] = periodText.split(' - ');
                
                // Parse dates
                const startParts = startDateStr.trim().split(' ');
                const endParts = endDateStr.trim().split(' ');
                
                if (startParts.length === 2 && endParts.length === 2) {
                    const startDay = parseInt(startParts[0]);
                    const startMonth = startParts[1];
                    const endDay = parseInt(endParts[0]);
                    const endMonth = endParts[1];
                    
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    
                    // Create Date objects, handling month crossover to next year
                    const startDate = new Date(`${startMonth} ${startDay}, ${currentYear}`);
                    let endDate = new Date(`${endMonth} ${endDay}, ${currentYear}`);
                    
                    // If end date is before start date, it's crossing to next year
                    if (endDate < startDate) {
                        endDate = new Date(`${endMonth} ${endDay}, ${currentYear + 1}`);
                    }
                    
                    // Generate period progress bar
                    const periodProgressBar = generatePeriodProgressBar(startDate, endDate);
                    tooltip.appendMarkdown(`**Period:** ${periodText}\n\n${periodProgressBar}\n\n`);
                } else {
                    // Fallback if date parsing fails
                    tooltip.appendMarkdown(`**Period:** ${periodText}\n\n`);
                }
                
                // Extract usage information for visualization
                const usageParts = requestLine.split('•')[1].trim().split('/');
                if (usageParts.length === 2) {
                    const current = parseInt(usageParts[0].trim());
                    const limit = parseInt(usageParts[1].split(' ')[0].trim());
                    
                    // Generate usage progress bar
                    const usageProgressBar = generateProgressBar(current, limit, current > limit ? current : null);
                    tooltip.appendMarkdown(`**Usage:** ${usageParts[0].trim()}/${usageParts[1].trim()}\n\n${usageProgressBar}\n\n`);
                } else {
                    // Fallback if parsing fails
                    tooltip.appendMarkdown(`**Usage:** ${requestLine.split('•')[1].trim()}\n\n`);
                }
                
                if (percentLine) {
                    tooltip.appendMarkdown(`**Progress:** ${percentLine.split('📊')[1].trim()}\n\n`);
                }
            }
        }

        // Usage Based Pricing Section
        const token = await getCursorTokenFromDB();
        let isEnabled = false;

        if (token) {
            try {
                const limitResponse = await getCurrentUsageLimit(token);
                isEnabled = !limitResponse.noUsageBasedAllowed;
                const costLine = lines.find(line => line.includes('Total Cost:'));
                const totalCost = costLine ? parseFloat(costLine.split('$')[1]) : 0;
                const usageBasedPeriodLine = lines.find(line => line.includes('Usage Based Period:'));

                tooltip.appendMarkdown('<div align="center">\n\n');
                tooltip.appendMarkdown(`### 📈 Usage-Based Pricing (${isEnabled ? 'Enabled' : 'Disabled'})\n\n`);
                tooltip.appendMarkdown('</div>\n\n');
                
                if (isEnabled && limitResponse.hardLimit) {
                    if (usageBasedPeriodLine) {
                        tooltip.appendMarkdown(`**Period:** ${usageBasedPeriodLine.split(':')[1].trim()}\n\n`);
                    }
                    const usagePercentage = ((totalCost / limitResponse.hardLimit) * 100).toFixed(1);
                    const usageEmoji = getUsageLimitEmoji(totalCost, limitResponse.hardLimit);
                    tooltip.appendMarkdown(`**Monthly Limit:** $${limitResponse.hardLimit.toFixed(2)} (${usagePercentage}% used) ${usageEmoji}\n\n`);
                } else if (!isEnabled) {
                    tooltip.appendMarkdown('> ℹ️ Usage-based pricing is currently disabled\n\n');
                }
                
                // Show usage details regardless of enabled/disabled status
                const pricingLines = lines.filter(line => line.includes('*') && line.includes('➜'));
                if (pricingLines.length > 0) {
                    const costLine = lines.find(line => line.includes('Total Cost:'));
                    const totalCost = costLine ? costLine.split('Total Cost:')[1].trim() : '';
                    const midMonthPaymentLine = lines.find(line => line.includes('You have paid') && line.includes('of this cost already'));
                    const midMonthPayment = midMonthPaymentLine ? 
                        (midMonthPaymentLine.match(/\$(\d+\.\d+)/) || [])[1] ? 
                        parseFloat((midMonthPaymentLine.match(/\$(\d+\.\d+)/) || [])[1]) : 0 
                        : 0;
                    const unpaidAmount = parseFloat(totalCost.replace('$', '')) - midMonthPayment;
                    
                    if (midMonthPayment > 0) {
                        tooltip.appendMarkdown(`**Current Usage** (Total: $${parseFloat(totalCost.replace('$', '')).toFixed(2)} - Unpaid: $${unpaidAmount.toFixed(2)}):\n\n`);
                    } else {
                        tooltip.appendMarkdown(`**Current Usage** (Total: ${totalCost}):\n\n`);
                    }
                    
                    pricingLines.forEach(line => {
                        const [calc, cost] = line.split('➜').map(part => part.trim());
                        tooltip.appendMarkdown(`• ${calc.replace('•', '').trim()} → ${cost}\n\n`);
                    });

                    // Add mid-month payment message if it exists
                    if (midMonthPaymentLine) {
                        tooltip.appendMarkdown(`> ${midMonthPaymentLine.trim()}\n\n`);
                    }
                } else {
                    tooltip.appendMarkdown('> ℹ️ No usage recorded for this period\n\n');
                }
            } catch (error: any) {
                log('[API] Error fetching limit for tooltip: ' + error.message, true);
                tooltip.appendMarkdown('> ⚠️ Error checking usage-based pricing status\n\n');
            }
        } else {
            tooltip.appendMarkdown('> ⚠️ Unable to check usage-based pricing status\n\n');
        }
    }

    // Action Buttons Section with new compact design
    tooltip.appendMarkdown('---\n\n');
    tooltip.appendMarkdown('<div align="center">\n\n');
    
    // First row: Account and Extension settings
    tooltip.appendMarkdown('🌐 [Account Settings](https://www.cursor.com/settings) • ');
    tooltip.appendMarkdown('⚙️ [Extension Settings](command:workbench.action.openSettings?%22@ext%3ADwtexe.cursor-stats%22)\n\n');
    
    // Second row: Usage Based Pricing, Refresh, and Last Updated
    const updatedLine = lines.find(line => line.includes('Last Updated:'));
    const updatedTime = updatedLine ? formatRelativeTime(updatedLine.split(':').slice(1).join(':').trim()) : new Date().toLocaleTimeString();
    
    tooltip.appendMarkdown('💰 [Usage Based Pricing](command:cursor-stats.setLimit) • ');
    tooltip.appendMarkdown('🔄 [Refresh](command:cursor-stats.refreshStats) • ');
    tooltip.appendMarkdown(`🕒 ${updatedTime}\n\n`);
    
    tooltip.appendMarkdown('</div>');

    return tooltip;
}

export function getStatusBarColor(percentage: number): vscode.ThemeColor {
    // Check if status bar colors are enabled in settings
    const config = vscode.workspace.getConfiguration('cursorStats');
    const colorsEnabled = config.get<boolean>('enableStatusBarColors', true);
    
    if (!colorsEnabled) {
        return new vscode.ThemeColor('statusBarItem.foreground');
    }

    if (percentage >= 95) {
        return new vscode.ThemeColor('charts.red');
    } else if (percentage >= 90) {
        return new vscode.ThemeColor('errorForeground');
    } else if (percentage >= 85) {
        return new vscode.ThemeColor('testing.iconFailed');
    } else if (percentage >= 80) {
        return new vscode.ThemeColor('notebookStatusErrorIcon.foreground');
    } else if (percentage >= 75) {
        return new vscode.ThemeColor('charts.yellow');
    } else if (percentage >= 70) {
        return new vscode.ThemeColor('notificationsWarningIcon.foreground');
    } else if (percentage >= 65) {
        return new vscode.ThemeColor('charts.orange');
    } else if (percentage >= 60) {
        return new vscode.ThemeColor('charts.blue');
    } else if (percentage >= 50) {
        return new vscode.ThemeColor('charts.green');
    } else if (percentage >= 40) {
        return new vscode.ThemeColor('testing.iconPassed');
    } else if (percentage >= 30) {
        return new vscode.ThemeColor('terminal.ansiGreen');
    } else if (percentage >= 20) {
        return new vscode.ThemeColor('symbolIcon.classForeground');
    } else if (percentage >= 10) {
        return new vscode.ThemeColor('debugIcon.startForeground');
    } else {
        return new vscode.ThemeColor('foreground');
    }
}

export function getUsageEmoji(percentage: number): string {
  if (percentage >= 90) {
      return '🔴';
  }
  if (percentage >= 75) {
      return '🟡';
  }
  if (percentage >= 50) {
      return '🟢';
  }
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
