import { log } from './logger';
import { getCursorTokenFromDB } from '../services/database';
import { checkUsageBasedStatus, fetchCursorStats, getStripeSessionUrl } from '../services/api';
import { checkAndNotifyUsage, checkAndNotifySpending } from '../handlers/notifications';
import { 
    startRefreshInterval, 
    startCountdownDisplay, 
    formatCountdown, 
    COOLDOWN_DURATION_MS,
    getRefreshInterval,
    getCooldownStartTime,
    getConsecutiveErrorCount,
    incrementConsecutiveErrorCount,
    setCooldownStartTime,
    resetConsecutiveErrorCount
} from './cooldown';
import { createMarkdownTooltip, formatTooltipLine, getMaxLineWidth, getStatusBarColor, createSeparator } from '../handlers/statusBar';
import * as vscode from 'vscode';
import { convertAndFormatCurrency, getCurrentCurrency } from './currency';
import { i18n } from '../services/i18n';

// Track unknown models to avoid repeated notifications
let unknownModelNotificationShown = false;
let detectedUnknownModels: Set<string> = new Set();

export async function updateStats(statusBarItem: vscode.StatusBarItem) {
    try {
        log('[Stats] ' +"=".repeat(100));
        log('[Stats] Starting stats update...');
        const token = await getCursorTokenFromDB();
       
        if (!token) {
            log('[Critical] No valid token found', true);
            statusBarItem.text = i18n.t('statusBar.noToken');
            statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorBackground');
            const tooltipLines = [
                i18n.t('tooltips.errorFetching')
            ];
            statusBarItem.tooltip = await createMarkdownTooltip(tooltipLines, true);
            log('[Status Bar] Updated status bar with no token message');
            statusBarItem.show();
            log('[Status Bar] Status bar visibility updated after no token');
            return;
        }

        // Check usage-based status first
        const usageStatus = await checkUsageBasedStatus(token);
        log(`[Stats] Usage-based pricing status: ${JSON.stringify(usageStatus)}`);

        // Show status bar early to ensure visibility
        statusBarItem.show();

        const stats = await fetchCursorStats(token).catch(async (error: any) => {
            if (error.response?.status === 401 || error.response?.status === 403) {
                log('[Auth] Token expired or invalid, attempting to refresh...', true);
                const newToken = await getCursorTokenFromDB();
                if (newToken) {
                    log('[Auth] Successfully retrieved new token, retrying stats fetch...');
                    return await fetchCursorStats(newToken);
                }
            }
            log(`[Critical] API error: ${error.message}`, true);
            throw error; // Re-throw to be caught by outer catch
        });

        // Reset error count on successful fetch
        if (getConsecutiveErrorCount() > 0 || getCooldownStartTime()) {
            log('[Stats] API connection restored, resetting error state');
            resetConsecutiveErrorCount();
            if (getCooldownStartTime()) {
                setCooldownStartTime(null);
                startRefreshInterval();
            }
        }
        
        let costText = '';
        
        // Calculate usage percentages
        const premiumPercent = Math.round((stats.premiumRequests.current / stats.premiumRequests.limit) * 100);
        let usageBasedPercent = 0;
        let totalUsageText = '';
        let totalRequests = stats.premiumRequests.current;

        if (stats.lastMonth.usageBasedPricing.items.length > 0) {
            const items = stats.lastMonth.usageBasedPricing.items;
            
            // Calculate actual total cost (sum of positive items only)
            const actualTotalCost = items.reduce((sum, item) => {
                const cost = parseFloat(item.totalDollars.replace('$', ''));
                // Only add positive costs (ignore mid-month payment credits)
                return cost > 0 ? sum + cost : sum;
            }, 0);

            // Calculate total requests from usage-based pricing (needed for status bar text)
            const usageBasedRequests = items.reduce((sum, item) => {
                // Only count requests from positive cost items
                if (parseFloat(item.totalDollars.replace('$', '')) > 0) {
                    const match = item.calculation.match(/^(\d+)\s*\*/);
                    return sum + (match ? parseInt(match[1]) : 0);
                }
                return sum;
            }, 0);
            totalRequests += usageBasedRequests;
            
            // Calculate usage percentage based on actual total cost (always in USD)
            if (usageStatus.isEnabled && usageStatus.limit) {
                usageBasedPercent = (actualTotalCost / usageStatus.limit) * 100;
            }
            
            // Convert actual cost currency for status bar display
            const formattedActualCost = await convertAndFormatCurrency(actualTotalCost);
            costText = ` $(credit-card) ${formattedActualCost}`;

            // Calculate total usage text if enabled
            const config = vscode.workspace.getConfiguration('cursorStats');
            const showTotalRequests = config.get<boolean>('showTotalRequests', false);
            
            if (showTotalRequests) {
                totalUsageText = ` ${totalRequests}/${stats.premiumRequests.limit}${costText}`;
            } else {
                totalUsageText = ` ${stats.premiumRequests.current}/${stats.premiumRequests.limit}${costText}`;
            }
        } else {
            totalUsageText = ` ${stats.premiumRequests.current}/${stats.premiumRequests.limit}`;
        }

        // Set status bar color based on usage type
        const usagePercent = premiumPercent < 100 ? premiumPercent : 
                            (usageStatus.isEnabled ? usageBasedPercent : premiumPercent);
        statusBarItem.color = getStatusBarColor(usagePercent);

        // Build content first to determine width
        const title = '⚡ Cursor Usage Statistics ⚡';
        const contentLines = [
            title,
            '',
            '🚀 Premium Fast Requests'
        ];
        
        // Format premium requests progress with fixed decimal places
        const premiumPercentFormatted = Math.round(premiumPercent);
        const startDate = new Date(stats.premiumRequests.startOfMonth);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const formatDateWithMonthName = (date: Date) => {
            const day = date.getDate();
            const monthName = date.toLocaleString('en-US', { month: 'long' });
            return `${day} ${monthName}`;
        };

        contentLines.push(
            formatTooltipLine(`   • ${stats.premiumRequests.current}/${stats.premiumRequests.limit} requests used`),
            formatTooltipLine(`   📊 ${premiumPercentFormatted}% utilized`),
            formatTooltipLine(`   Fast Requests Period: ${formatDateWithMonthName(startDate)} - ${formatDateWithMonthName(endDate)}`),
            '',
            '📈 Usage-Based Pricing'
        );
        
        if (stats.lastMonth.usageBasedPricing.items.length > 0) {
            const items = stats.lastMonth.usageBasedPricing.items;

            // Calculate actual total cost (sum of positive items only)
            const actualTotalCost = items.reduce((sum, item) => {
                const cost = parseFloat(item.totalDollars.replace('$', ''));
                return cost > 0 ? sum + cost : sum;
            }, 0);
            
            // Calculate usage-based pricing period
            const billingDay = 3;
            const currentDate = new Date();
            let periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), billingDay);
            let periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, billingDay - 1);
            
            if (currentDate.getDate() < billingDay) {
                periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, billingDay);
                periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), billingDay - 1);
            }
            
            contentLines.push(
                formatTooltipLine(i18n.t('tooltips.period', {
                    type: i18n.t('tooltips.usageBasedPricing'),
                    start: formatDateWithMonthName(periodStart),
                    end: formatDateWithMonthName(periodEnd)
                }))
            );
            
            // Calculate unpaid amount correctly
            const unpaidAmount = Math.max(0, actualTotalCost - stats.lastMonth.usageBasedPricing.midMonthPayment);
            
            // Calculate usage percentage based on actual total cost (always in USD)
            const usagePercentage = usageStatus.limit ? ((actualTotalCost / usageStatus.limit) * 100).toFixed(1) : '0.0';
            
            // Convert currency for tooltip
            const formattedActualTotalCost = await convertAndFormatCurrency(actualTotalCost);
            const formattedUnpaidAmount = await convertAndFormatCurrency(unpaidAmount);
            
            if (stats.lastMonth.usageBasedPricing.midMonthPayment > 0) {
                contentLines.push(
                    formatTooltipLine(i18n.t('tooltips.currentUsage', {
                        total: formattedActualTotalCost,
                        unpaid: formattedUnpaidAmount
                    }))
                );
            } else {
                contentLines.push(
                    formatTooltipLine(i18n.t('tooltips.total', {
                        amount: formattedActualTotalCost
                    }))
                );
            }
            
            for (const item of items) {
                // Skip mid-month payment line item from the detailed list
                if (item.description?.includes('Mid-month usage paid')) {
                    continue;
                }

                // If the item has a description, use it to provide better context
                if (item.description) {
                    // Extract the item type from description for better display
                    let displayType = '';
                    let isKnownModel = true;
                    
                    if (item.description.includes("tool calls")) {
                        displayType = "Tool Calls";
                    } else if (item.description.match(/o3-mini/i)) {
                        displayType = "o3-mini";
                    } else if (item.description.match(/o1\s+requests/i)) {
                        displayType = i18n.t('tooltips.requests');
                    } else if (item.description.match(/claude-3\.7-sonnet-thinking-max/i)) {
                        displayType = "claude-3.7-sonnet-thinking-max";
                    } else if (item.description.match(/claude-3\.7-sonnet-max/i)) {
                        displayType = "claude-3.7-sonnet-max";
                    } else if (item.description.match(/extra fast premium/i)) {
                        displayType = i18n.t('tooltips.fastRequests');
                    } else if (item.description.match(/gpt-4\.5-preview/i)) {
                        displayType = "gpt-4.5-preview";
                    } else if (item.description.match(/gemini-2-5-pro-exp-max/i)) {
                        displayType = "gemini-2-5-pro-exp-max";
                    } else if (item.description.match(/^\d+\s+o3\s+request/i)) {
                        displayType = "o3";
                    } else {
                        // Try to extract a potential model name using a broader pattern
                        // Matches "NUMBER MODEL_NAME requests *"
                        const modelMatch = item.description.match(/^\d+\s+([a-zA-Z0-9\-\.]+)\s+requests?\b/i);
                        if (modelMatch && modelMatch[1]) {
                            const potentialModelName = modelMatch[1];
                            // Check if it's not one we already handle explicitly (avoids double counting)
                            const knownModels = ['o3-mini', 'o1', 'claude-3.7-sonnet-thinking-max', 'claude-3.7-sonnet-max', 'gpt-4.5-preview', 'gemini-2-5-pro-exp-max'];
                            if (!knownModels.some(known => potentialModelName.toLowerCase().includes(known.toLowerCase()))) {
                                displayType = potentialModelName; // Display the extracted name
                                isKnownModel = false;
                                // Add the extracted model name to our set
                                detectedUnknownModels.add(potentialModelName);
                                log(`[Stats] Detected potentially unknown model: ${potentialModelName} in description: "${item.description}"`, true);
                            } else {
                                // It matched a known model structure but wasn't caught by specific checks? Log for debugging.
                                log(`[Debug] Model matched generic pattern but might be known: ${potentialModelName}`);
                                displayType = potentialModelName; // Still display it
                            }
                        } else {
                            displayType = "Requests"; // Fallback display type

                            // If it contains 'requests' and isn't 'Mid-month', flag it as potentially unknown for notification
                            if (item.description.match(/requests/i) && !item.description.includes("Mid-month")) {
                                isKnownModel = false;
                                // Add the whole description as a fallback identifier if extraction failed
                                detectedUnknownModels.add(`Unknown format: ${item.description}`);
                                log(`[Stats] Potentially unknown model format (extraction failed): "${item.description}"`, true);
                            }
                        }
                    }
                    
                    // Show notification if an unknown model was found and we haven't shown it yet
                    if (!isKnownModel && !unknownModelNotificationShown && detectedUnknownModels.size > 0) {
                        unknownModelNotificationShown = true;
                        
                        const unknownModels = Array.from(detectedUnknownModels).join(", ");
                        log(`[Stats] Showing notification for unknown models: ${unknownModels}`);
                        
                        vscode.window.showInformationMessage(
                            `New Cursor model detected on api response: "${unknownModels}". Please create a report and submit it on GitHub so we can add support for this model.`,
                            'Create Report',
                            'Open GitHub Issues'
                        ).then(selection => {
                            if (selection === 'Create Report') {
                                vscode.commands.executeCommand('cursor-stats.createReport');
                            } else if (selection === 'Open GitHub Issues') {
                                vscode.env.openExternal(vscode.Uri.parse('https://github.com/Dwtexe/cursor-stats/issues/new'));
                            }
                        });
                    }
                    
                    // Convert item cost for display
                    const itemCost = parseFloat(item.totalDollars.replace('$', ''));
                    const formattedItemCost = await convertAndFormatCurrency(itemCost);
                    const calculation = item.calculation.split('*')[0].trim();
                    const rate = item.calculation.split('*')[1]?.trim() || '';
                    
                    // If rate exists, convert its currency too
                    let formattedCalculation = calculation;
                    if (rate) {
                        const rateValue = parseFloat(rate.replace('$', ''));
                        const formattedRate = await convertAndFormatCurrency(rateValue);
                        formattedCalculation = `${calculation}*${formattedRate}`;
                    } else {
                        formattedCalculation = item.calculation;
                    }
                    
                    contentLines.push(formatTooltipLine(`   • ${formattedCalculation} (${displayType}) ➜ **${formattedItemCost}**`));
                } else {
                    // Convert item cost for display
                    const itemCost = parseFloat(item.totalDollars.replace('$', ''));
                    const formattedItemCost = await convertAndFormatCurrency(itemCost);
                    const calculation = item.calculation.split('*')[0].trim();
                    const rate = item.calculation.split('*')[1]?.trim() || '';
                    
                    // If rate exists, convert its currency too
                    let formattedCalculation = calculation;
                    if (rate) {
                        const rateValue = parseFloat(rate.replace('$', ''));
                        const formattedRate = await convertAndFormatCurrency(rateValue);
                        formattedCalculation = `${calculation}*${formattedRate}`;
                    } else {
                        formattedCalculation = item.calculation;
                    }
                    
                    contentLines.push(formatTooltipLine(`   • ${formattedCalculation} ➜ **${formattedItemCost}**`));
                }
            }

            if (stats.lastMonth.usageBasedPricing.midMonthPayment > 0) {
                const formattedMidMonthPayment = await convertAndFormatCurrency(stats.lastMonth.usageBasedPricing.midMonthPayment);
                contentLines.push(
                    '',
                    formatTooltipLine(`ℹ️ You have paid ${formattedMidMonthPayment} of this cost already`)
                );
            }

            const formattedFinalCost = await convertAndFormatCurrency(actualTotalCost);
            contentLines.push(
                '',
                formatTooltipLine(`💳 Total Cost: ${formattedFinalCost}`)
            );

            // Update costText for status bar here, using actual total cost
            costText = ` $(credit-card) ${formattedFinalCost}`;

            // Add spending notification check
            if (usageStatus.isEnabled) {
                setTimeout(() => {
                    checkAndNotifySpending(actualTotalCost); // Check spending based on actual total cost
                }, 1000);
            }
        } else {
            contentLines.push('   ℹ️ No usage data for last month');
        }

        // Calculate separator width based on content
        const maxWidth = getMaxLineWidth(contentLines);
        const separator = createSeparator(maxWidth);

        // Create final tooltip content with Last Updated at the bottom
        // Filter out the metadata line before creating the final tooltip
        const visibleContentLines = contentLines.filter(line => !line.includes('__USD_USAGE_DATA__'));
        
        const tooltipLines = [
            title,
            separator,
            ...visibleContentLines.slice(1),
            '',
            formatTooltipLine(`🕒 Last Updated: ${new Date().toLocaleString()}`),
        ];

        // Update usage based percent for notifications
        usageBasedPercent = usageStatus.isEnabled ? usageBasedPercent : 0;
        
        log('[Status Bar] Updating status bar with new stats...');
        statusBarItem.text = `$(graph)${totalUsageText}`;
        statusBarItem.tooltip = await createMarkdownTooltip(tooltipLines, false, contentLines);
        statusBarItem.show();
        log('[Stats] Stats update completed successfully');

        // Show notifications after ensuring status bar is visible
        if (usageStatus.isEnabled) {
            setTimeout(() => {
                // First check premium usage
                const premiumPercent = Math.round((stats.premiumRequests.current / stats.premiumRequests.limit) * 100);
                checkAndNotifyUsage({
                    percentage: premiumPercent,
                    type: 'premium'
                });

                // Only check usage-based if premium is over limit
                if (premiumPercent >= 100) {
                    checkAndNotifyUsage({
                        percentage: usageBasedPercent,
                        type: 'usage-based',
                        limit: usageStatus.limit,
                        premiumPercentage: premiumPercent
                    });
                }

                if (stats.lastMonth.usageBasedPricing.hasUnpaidMidMonthInvoice) {
                    vscode.window.showWarningMessage('⚠️ You have an unpaid mid-month invoice. Please pay it to continue using usage-based pricing.', 'Open Billing Page')
                        .then(async selection => {
                            if (selection === 'Open Billing Page') {
                                try {
                                    const stripeUrl = await getStripeSessionUrl(token);
                                    vscode.env.openExternal(vscode.Uri.parse(stripeUrl));
                                } catch (error) {
                                    // Fallback to settings page if stripe URL fails
                                    vscode.env.openExternal(vscode.Uri.parse('https://www.cursor.com/settings'));
                                }
                            }
                        });
                }
            }, 1000);
        } else {
            setTimeout(() => {
                checkAndNotifyUsage({
                    percentage: premiumPercent,
                    type: 'premium'
                });
            }, 1000);
        }
    } catch (error: any) {
        const errorCount = incrementConsecutiveErrorCount();
        log(`[Critical] Error updating stats (Error count: ${errorCount}): ${error.message}`, true);

        if (errorCount >= 2) {
            // Always reset cooldown timer on errors after 2 consecutive failures
            setCooldownStartTime(Date.now());
            const refreshInterval = getRefreshInterval();
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
            startCountdownDisplay();
            log('[Critical] Starting/Resetting cooldown period due to consecutive errors');
        }

        const cooldownStartTime = getCooldownStartTime();
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorBackground');
        
        if (cooldownStartTime) {
            const now = Date.now();
            const elapsed = now - cooldownStartTime;
            const remaining = COOLDOWN_DURATION_MS - elapsed;
            statusBarItem.text = i18n.t('statusBar.apiUnavailable') + ' (' + 
                i18n.t('statusBar.retryingIn', { time: formatCountdown(remaining) }) + ')';
        } else {
            statusBarItem.text = i18n.t('statusBar.error');
        }

        const errorLines = [
            i18n.t('tooltips.errorFetching'),
            i18n.t('tooltips.apiUnavailable'),
            cooldownStartTime ? '\n' + i18n.t('tooltips.autoRefreshPaused') : '',
            '',
            i18n.t('tooltips.lastAttempt', { time: new Date().toLocaleString() })
        ].filter(line => line !== '');
        
        statusBarItem.tooltip = await createMarkdownTooltip(errorLines, true);
        statusBarItem.show();
        log('[Status Bar] Status bar visibility updated after error');
    }
}
