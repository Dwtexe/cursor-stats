import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { convertAndFormatCurrency } from '../utils/currency';
import { UsageInfo } from '../interfaces/types';
import { t } from '../utils/i18n';

// Track which thresholds have been notified in the current session
const notifiedPremiumThresholds = new Set<number>();
const notifiedUsageBasedThresholds = new Set<number>();
const notifiedSpendingThresholds = new Set<number>();
let isNotificationInProgress = false;
let unpaidInvoiceNotifiedThisSession = false;
let isSpendingCheckInitialRun = true; // New state variable for spending checks

// Reset notification tracking
export function resetNotifications() {
  notifiedPremiumThresholds.clear();
  notifiedUsageBasedThresholds.clear();
  notifiedSpendingThresholds.clear();
  isNotificationInProgress = false;
  unpaidInvoiceNotifiedThisSession = false;
  isSpendingCheckInitialRun = true; // Reset this flag as well
  log('[Notifications] Reset notification tracking, including spending check initial run flag.');
}

export async function checkAndNotifySpending(totalSpent: number) {
  if (isNotificationInProgress) {
    return;
  }

  const config = vscode.workspace.getConfiguration('cursorStats');
  const spendingThreshold = config.get<number>('spendingAlertThreshold', 1);

  // If threshold is 0 or less, spending notifications are disabled
  if (spendingThreshold <= 0) {
    log('[Notifications] Spending alerts disabled (threshold <= 0).');
    return;
  }

  try {
    isNotificationInProgress = true;
    if (isSpendingCheckInitialRun) {
      // On the initial run (or after a reset), prime the notifiedSpendingThresholds
      // by adding all multiples of spendingThreshold that are less than or equal to totalSpent.
      const multiplesToPrime = Math.floor(totalSpent / spendingThreshold);
      for (let i = 1; i <= multiplesToPrime; i++) {
        notifiedSpendingThresholds.add(i);
      }
      isSpendingCheckInitialRun = false; // Clear the flag after priming
    }

    let lastNotifiedMultiple = 0;
    if (notifiedSpendingThresholds.size > 0) {
      lastNotifiedMultiple = Math.max(0, ...Array.from(notifiedSpendingThresholds));
    }

    let multipleToConsider = lastNotifiedMultiple + 1;

    while (true) {
      const currentThresholdAmount = multipleToConsider * spendingThreshold;
      if (totalSpent >= currentThresholdAmount) {
        log(
          `[Notifications] Spending threshold $${currentThresholdAmount.toFixed(2)} met or exceeded (Total spent: $${totalSpent.toFixed(2)}). Triggering notification.`,
        );

        const formattedCurrentThreshold = await convertAndFormatCurrency(currentThresholdAmount);
        const formattedTotalSpent = await convertAndFormatCurrency(totalSpent);

        // For the detail message, calculate the *next* threshold after the one we're notifying about
        const nextHigherThresholdAmount = (multipleToConsider + 1) * spendingThreshold;
        const formattedNextHigherThreshold =
          await convertAndFormatCurrency(nextHigherThresholdAmount);

        const message = t('notifications.spendingThresholdReached', {
          amount: formattedCurrentThreshold,
        });
        const detail = `${t('notifications.currentTotalCost', { amount: formattedTotalSpent })} ${t('notifications.nextNotificationAt', { amount: formattedNextHigherThreshold })}`;

        // Show the notification
        const notificationSelection = await vscode.window.showInformationMessage(
          message,
          { modal: false, detail },
          t('notifications.manageLimitTitle'),
          t('notifications.dismiss'),
        );

        if (notificationSelection === t('notifications.manageLimitTitle')) {
          await vscode.commands.executeCommand('cursor-stats.setLimit');
        }

        // Mark this multiple as notified
        notifiedSpendingThresholds.add(multipleToConsider);
        multipleToConsider++;
      } else {
        // totalSpent is less than currentThresholdAmount, so we haven't crossed this one yet. Stop.
        break;
      }
    }
  } catch (error) {
    log(
      `[Notifications] Error during checkAndNotifySpending: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  } finally {
    isNotificationInProgress = false;
  }
}

export async function checkAndNotifyUnpaidInvoice(token: string) {
  if (unpaidInvoiceNotifiedThisSession || isNotificationInProgress) {
    return;
  }

  try {
    isNotificationInProgress = true;
    log('[Notifications] Checking for unpaid mid-month invoice notification.');

    const notification = await vscode.window.showWarningMessage(
      t('notifications.unpaidInvoice'),
      t('notifications.openBillingPage'),
      t('notifications.dismiss'),
    );

    if (notification === t('notifications.openBillingPage')) {
      try {
        const { getStripeSessionUrl } = await import('../services/api'); // Lazy import
        const stripeUrl = await getStripeSessionUrl(token);
        vscode.env.openExternal(vscode.Uri.parse(stripeUrl));
      } catch (error) {
        log('[Notifications] Failed to get Stripe URL, falling back to settings page.', true);
        vscode.env.openExternal(vscode.Uri.parse('https://www.cursor.com/settings'));
      }
    }
    unpaidInvoiceNotifiedThisSession = true;
    log('[Notifications] Unpaid invoice notification shown.');
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
    const thresholds = config
      .get<number[]>('usageAlertThresholds', [10, 30, 50, 75, 90, 100])
      .sort((a, b) => b - a); // Sort in descending order to get highest threshold first

    const { percentage, type, limit } = usageInfo;

    // If this is a usage-based notification and premium is not over limit, skip it
    if (
      type === 'usage-based' &&
      usageInfo.premiumPercentage &&
      usageInfo.premiumPercentage < 100
    ) {
      log(
        '[Notifications] Skipping usage-based notification as premium requests are not exhausted',
      );
      return;
    }

    // Find the highest threshold that has been exceeded
    const highestExceededThreshold = thresholds.find((threshold) => percentage >= threshold);

    // Only notify if we haven't notified this threshold yet
    const relevantThresholds =
      type === 'premium' ? notifiedPremiumThresholds : notifiedUsageBasedThresholds;
    if (highestExceededThreshold && !relevantThresholds.has(highestExceededThreshold)) {
      log(
        `[Notifications] Highest usage threshold ${highestExceededThreshold}% exceeded for ${type} usage`,
      );

      let message, detail;
      if (type === 'premium') {
        if (percentage > 100) {
          message = t('notifications.usageExceededLimit', { percentage: percentage.toFixed(1) });
          detail = t('notifications.enableUsageBasedDetail');
        } else {
          message = t('notifications.usageThresholdReached', { percentage: percentage.toFixed(1) });
          detail = t('notifications.viewSettingsDetail');
        }
      } else {
        // Only show usage-based notifications if premium is exhausted
        message = t('notifications.usageBasedSpendingThreshold', {
          percentage: percentage.toFixed(1),
          limit: limit || 0,
        });
        detail = t('notifications.manageLimitDetail');
      }

      // Show the notification
      const notification = await vscode.window.showWarningMessage(
        message,
        { modal: false, detail },
        type === 'premium' && percentage > 100
          ? t('notifications.enableUsageBasedTitle')
          : type === 'premium'
            ? t('notifications.viewSettingsTitle')
            : t('notifications.manageLimitTitle'),
        t('notifications.dismiss'),
      );

      if (notification === t('notifications.viewSettingsTitle')) {
        try {
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            '@ext:Dwtexe.cursor-stats',
          );
        } catch (error) {
          log(
            '[Notifications] Failed to open settings directly, trying alternative method...',
            true,
          );
          try {
            await vscode.commands.executeCommand('workbench.action.openSettings');
            await vscode.commands.executeCommand('workbench.action.search.toggleQueryDetails');
            await vscode.commands.executeCommand(
              'workbench.action.search.action.replaceAll',
              '@ext:Dwtexe.cursor-stats',
            );
          } catch (fallbackError) {
            log('[Notifications] Failed to open settings with fallback method', true);
            vscode.window.showErrorMessage(t('notifications.failedToOpenSettings'));
          }
        }
      } else if (
        notification === t('notifications.manageLimitTitle') ||
        notification === t('notifications.enableUsageBasedTitle')
      ) {
        await vscode.commands.executeCommand('cursor-stats.setLimit');
      }

      // Mark all thresholds up to and including the current one as notified
      thresholds.forEach((threshold) => {
        if (threshold <= highestExceededThreshold) {
          relevantThresholds.add(threshold);
        }
      });
    }

    // Clear notifications for thresholds that are no longer exceeded
    for (const threshold of relevantThresholds) {
      if (percentage < threshold) {
        relevantThresholds.delete(threshold);
        log(
          `[Notifications] Cleared notification for threshold ${threshold}% as ${type} usage dropped below it`,
        );
      }
    }
  } finally {
    isNotificationInProgress = false;
  }
}
