import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { convertAndFormatCurrency } from '../utils/currency';
import { UsageInfo } from '../interfaces/types';
import { i18n } from '../services/i18n';

// Track which thresholds have been notified in the current session
const notifiedPremiumThresholds = new Set<number>();
const notifiedUsageBasedThresholds = new Set<number>();
const notifiedSpendingThresholds = new Set<number>();
let isNotificationInProgress = false;

// Reset notification tracking
export function resetNotifications() {
    notifiedPremiumThresholds.clear();
    notifiedUsageBasedThresholds.clear();
    notifiedSpendingThresholds.clear();
    isNotificationInProgress = false;
    log('[Notifications] Reset notification tracking');
}

export async function checkAndNotifySpending(totalSpent: number) {
    if (isNotificationInProgress) {
        return;
    }

    const config = vscode.workspace.getConfiguration('cursorStats');
    const spendingThreshold = config.get<number>('spendingAlertThreshold', 1);
    
    // If threshold is 0, spending notifications are disabled
    if (spendingThreshold <= 0) {
        return;
    }

    try {
        isNotificationInProgress = true;
        
        // Calculate the next threshold to notify about (starting from 1, not 0)
        const currentThresholdMultiple = Math.floor(totalSpent / spendingThreshold);
        const nextNotificationAmount = (currentThresholdMultiple + 1) * spendingThreshold;
        
        // Only notify if we've passed the next notification amount and haven't notified about it
        if (totalSpent >= nextNotificationAmount && !notifiedSpendingThresholds.has(currentThresholdMultiple + 1)) {
            log(`[Notifications] Spending threshold reached (Total spent: $${totalSpent.toFixed(2)}, Next notification at: $${nextNotificationAmount.toFixed(2)})`);
            
            // Convert the amounts to the user's preferred currency
            const formattedTotalSpent = await convertAndFormatCurrency(totalSpent);
            const formattedNextThreshold = await convertAndFormatCurrency(nextNotificationAmount + spendingThreshold);
            
            const message = i18n.t('notifications.spendingThreshold.message', { amount: formattedTotalSpent });
            const detail = i18n.t('notifications.spendingThreshold.detail', { nextAmount: formattedNextThreshold });

            // Show the notification
            const notification = await vscode.window.showInformationMessage(
                message,
                { modal: false, detail },
                i18n.t('notifications.spendingThreshold.manageLimit'),
                i18n.t('notifications.spendingThreshold.dismiss')
            );

            if (notification === i18n.t('notifications.spendingThreshold.manageLimit')) {
                await vscode.commands.executeCommand('cursor-stats.setLimit');
            }

            // Mark this threshold as notified
            notifiedSpendingThresholds.add(currentThresholdMultiple + 1);
        }
    } finally {
        isNotificationInProgress = false;
    }
}

export async function checkAndNotifyUsage(usageInfo: UsageInfo) {
    // Prevent concurrent notifications
    if (isNotificationInProgress) {
        return;
    }

    const config = vscode.workspace.getConfiguration('cursorStats');
    const enableAlerts = config.get<boolean>('enableAlerts', true);
    
    if (!enableAlerts) {
        return;
    }

    try {
        isNotificationInProgress = true;
        const thresholds = config.get<number[]>('usageAlertThresholds', [10, 30, 50, 75, 90, 100])
            .sort((a, b) => b - a); // Sort in descending order to get highest threshold first

        const { percentage, type, limit } = usageInfo;

        // If this is a usage-based notification and premium is not over limit, skip it
        if (type === 'usage-based' && usageInfo.premiumPercentage && usageInfo.premiumPercentage < 100) {
            log('[Notifications] Skipping usage-based notification as premium requests are not exhausted');
            return;
        }

        // Find the highest threshold that has been exceeded
        const highestExceededThreshold = thresholds.find(threshold => percentage >= threshold);
        
        // Only notify if we haven't notified this threshold yet
        const relevantThresholds = type === 'premium' ? notifiedPremiumThresholds : notifiedUsageBasedThresholds;
        if (highestExceededThreshold && !relevantThresholds.has(highestExceededThreshold)) {
            log(`[Notifications] Highest usage threshold ${highestExceededThreshold}% exceeded for ${type} usage`);
            
            let message, detail, actionLabel;
            if (type === 'premium') {
                if (percentage > 100) {
                    message = i18n.t('notifications.usageThreshold.premium.messageExceeded', { percent: percentage.toFixed(1) });
                    detail = i18n.t('notifications.usageThreshold.premium.detailExceeded');
                    actionLabel = i18n.t('notifications.usageThreshold.premium.enableUsageBased');
                } else {
                    message = i18n.t('notifications.usageThreshold.premium.message', { percent: percentage.toFixed(1) });
                    detail = i18n.t('notifications.usageThreshold.premium.detail');
                    actionLabel = i18n.t('notifications.usageThreshold.premium.viewSettings');
                }
            } else {
                message = i18n.t('notifications.usageThreshold.usageBased.message', { percent: percentage.toFixed(1), limit: limit || 0 }); 
                detail = i18n.t('notifications.usageThreshold.usageBased.detail');
                actionLabel = i18n.t('notifications.usageThreshold.usageBased.manageLimit');
            }

            // Show the notification
            const notification = await vscode.window.showWarningMessage(
                message,
                { modal: false, detail },
                actionLabel,
                i18n.t('notifications.spendingThreshold.dismiss')
            );

            if (notification === i18n.t('notifications.usageThreshold.premium.viewSettings')) {
                try {
                    await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Dwtexe.cursor-stats');
                } catch (error) {
                    log('[Notifications] Failed to open settings directly, trying alternative method...', true);
                    try {
                        await vscode.commands.executeCommand('workbench.action.openSettings');
                        await vscode.commands.executeCommand('workbench.action.search.toggleQueryDetails');
                        await vscode.commands.executeCommand('workbench.action.search.action.replaceAll', '@ext:Dwtexe.cursor-stats');
                    } catch (fallbackError) {
                        log(i18n.t('notifications.settingsError.fallback'), true);
                        vscode.window.showErrorMessage(i18n.t('notifications.settingsError.message'));
                    }
                }
            } else if (notification === i18n.t('notifications.usageThreshold.usageBased.manageLimit') || 
                       notification === i18n.t('notifications.usageThreshold.premium.enableUsageBased')) {
                await vscode.commands.executeCommand('cursor-stats.setLimit');
            }

            // Mark all thresholds up to and including the current one as notified
            thresholds.forEach(threshold => {
                if (threshold <= highestExceededThreshold) {
                    relevantThresholds.add(threshold);
                }
            });
        }

        // Clear notifications for thresholds that are no longer exceeded
        for (const threshold of relevantThresholds) {
            if (percentage < threshold) {
                relevantThresholds.delete(threshold);
                log(`[Notifications] Cleared notification for threshold ${threshold}% as ${type} usage dropped below it`);
            }
        }
    } finally {
        isNotificationInProgress = false;
    }
} 