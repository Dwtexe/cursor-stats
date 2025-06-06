import * as vscode from 'vscode';
import { checkForUpdates } from './services/github';
import { createStatusBarItem } from './handlers/statusBar';
import { initializeLogging, log } from './utils/logger';
import { getCursorTokenFromDB } from './services/database';
import { checkUsageBasedStatus, getCurrentUsageLimit, setUsageLimit } from './services/api';
import { resetNotifications } from './handlers/notifications';
import { 
    startRefreshInterval, 
    setStatusBarItem, 
    setIsWindowFocused,
    clearAllIntervals,
    getCooldownStartTime,
    startCountdownDisplay
} from './utils/cooldown';
import { updateStats } from './utils/updateStats';
import { SUPPORTED_CURRENCIES } from './utils/currency';
import { convertAndFormatCurrency } from './utils/currency';
import { createReportCommand } from './utils/report';
import { initializeI18n, t, setOnLanguageChangeCallback } from './utils/i18n';

let statusBarItem: vscode.StatusBarItem;
let extensionContext: vscode.ExtensionContext;
let outputChannel: vscode.OutputChannel | undefined;
let lastReleaseCheck: number = 0;
const RELEASE_CHECK_INTERVAL = 1000 * 60 * 60; // Check every hour

export function getRefreshIntervalMs(): number {
    const config = vscode.workspace.getConfiguration('cursorStats');
    const intervalSeconds = Math.max(config.get('refreshInterval', 30), 5); // Minimum 5 seconds
    return intervalSeconds * 1000;
}

// Add this new function
export function getExtensionContext(): vscode.ExtensionContext {
    if (!extensionContext) {
        throw new Error('Extension context not initialized');
    }
    return extensionContext;
}

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize logging first
        initializeLogging(context);
        
        // Initialize i18n system
        initializeI18n();
        
        // Setting up language change callbacks
        setOnLanguageChangeCallback((_newLanguage: string, languageLabel: string) => {
            const message = t('commands.languageChanged', { language: languageLabel });
            vscode.window.showInformationMessage(message);
        });
        
        log('[Initialization] Extension activation started');
        extensionContext = context;

        // Get package.json for current version
        const packageJson = require('../package.json');
        const currentVersion = packageJson.version;
        
        // Check if we need to show changelog after update
        const lastInstalledVersion = context.globalState.get('lastInstalledVersion');
        log(`[Initialization] Current version: ${currentVersion}, Last installed: ${lastInstalledVersion || 'not set'}`);
        
        if (lastInstalledVersion && lastInstalledVersion !== currentVersion) {
            // Check if changelog should be shown on update
            const showChangelogOnUpdate = vscode.workspace.getConfiguration('cursorStats').get('showChangelogOnUpdate', false);
            
            if (showChangelogOnUpdate) {
                // Show changelog for the current version (we've updated)
                log(`[Update] Extension updated from ${lastInstalledVersion} to ${currentVersion}, showing changelog`);
                setTimeout(() => {
                    checkForUpdates(0, 0, currentVersion);
                }, 3000); // Slight delay to let extension finish activating
            } else {
                log(`[Update] Extension updated from ${lastInstalledVersion} to ${currentVersion}, changelog disabled by user setting`);
            }
        }
        
        // Update the stored version
        context.globalState.update('lastInstalledVersion', currentVersion);

        // Reset notifications on activation
        resetNotifications();

        // Create status bar item with enhanced logging
        statusBarItem = createStatusBarItem();
        setStatusBarItem(statusBarItem);

        // Add window focus event listeners
        const focusListener = vscode.window.onDidChangeWindowState(e => {
            const focused = e.focused;
            setIsWindowFocused(focused);
            log(`[Window] Window focus changed: ${focused ? 'focused' : 'unfocused'}`);
            
            if (focused) {
                // Check if we're in cooldown
                if (getCooldownStartTime()) {
                    log('[Window] Window focused during cooldown, restarting countdown display');
                    startCountdownDisplay();
                } else {
                    // Only update stats and restart refresh if not in cooldown
                    updateStats(statusBarItem);
                    startRefreshInterval();
                }
            } else {
                clearAllIntervals();
            }
        });

        // Check initial usage-based status
        const token = await getCursorTokenFromDB();
        if (token) {
            log('[Initialization] Checking usage-based pricing status...');
            const status = await checkUsageBasedStatus(token);
            log(`[Initialization] Usage-based pricing is ${status.isEnabled ? 'enabled' : 'disabled'}${status.limit ? ` with limit $${status.limit}` : ''}`);
        }
        
        // Register commands
        log('[Initialization] Registering commands...');
        const refreshCommand = vscode.commands.registerCommand('cursor-stats.refreshStats', async () => {
            log('[Command] Manually refreshing stats...');
            await updateStats(statusBarItem);
        });
        const openCursorSettings = vscode.commands.registerCommand('cursor-stats.openSettings', async () => {
            log('[Command] Opening extension settings...');
            // Use a more reliable way to open settings
            const settingsUri = vscode.Uri.parse('vscode://ms-vscode.cursor-stats/settings');
            try {
                // Try to open settings directly first
                await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Dwtexe.cursor-stats');
            } catch (error) {
                log('[Command] Failed to open settings directly, trying alternative method...', true);
                try {
                    // Fallback to opening settings view
                    await vscode.commands.executeCommand('workbench.action.openSettings');
                    // Then search for our extension
                    await vscode.commands.executeCommand('workbench.action.search.toggleQueryDetails');
                    await vscode.commands.executeCommand('workbench.action.search.action.replaceAll', '@ext:Dwtexe.cursor-stats');
                } catch (fallbackError) {
                    log('[Command] Failed to open settings with fallback method', true);
                    // Show error message to user
                    vscode.window.showErrorMessage(t('notifications.failedToOpenSettings'));
                }
            }
        });

    // Add configuration change listener
    const configListener = vscode.workspace.onDidChangeConfiguration(
      async (e) => {
        if (e.affectsConfiguration('cursorStats.enableStatusBarColors')) {
          log(
            '[Settings] Status bar colors setting changed, updating display...'
          );
                await updateStats(statusBarItem);
            }
            if (e.affectsConfiguration('cursorStats.refreshInterval')) {
                log('[Settings] Refresh interval changed, restarting timer...');
                startRefreshInterval();
            }
            if (e.affectsConfiguration('cursorStats.showTotalRequests')) {
          log(
            '[Settings] Show total requests setting changed, updating display...'
          );
                await updateStats(statusBarItem);
            }
            if (e.affectsConfiguration('cursorStats.currency')) {
                log('[Settings] Currency setting changed, updating display...');
                await updateStats(statusBarItem);
            }
        if (e.affectsConfiguration('cursorStats.excludeWeekends')) {
          log(
            '[Settings] Exclude weekends setting changed, updating display...'
          );
          await updateStats(statusBarItem);
        }
        if (e.affectsConfiguration('cursorStats.showDailyRemaining')) {
          log(
            '[Settings] Show daily remaining setting changed, updating display...'
          );
          await updateStats(statusBarItem);
        }
        if (e.affectsConfiguration('cursorStats.spendingAlertThreshold')) {
            log('[Settings] Spending alert threshold changed, resetting notifications and updating stats...');
            resetNotifications(); // This will set isSpendingCheckInitialRun to true
            await updateStats(statusBarItem); // This will trigger checkAndNotifySpending with the new logic
        }
        if (e.affectsConfiguration('cursorStats.language')) {
            log('[Settings] Language setting changed, updating display...');
            await updateStats(statusBarItem);
        }
      }
    );

        const setLimitCommand = vscode.commands.registerCommand('cursor-stats.setLimit', async () => {
            const token = await getCursorTokenFromDB();
            if (!token) {
                vscode.window.showErrorMessage(t('settings.signInRequired'));
                return;
            }

            try {
                const currentLimit = await getCurrentUsageLimit(token);
                const isEnabled = !currentLimit.noUsageBasedAllowed;
               
                const quickPick = await vscode.window.showQuickPick([
                    {
                        label: t('commands.enableUsageBasedOption'),
                        description: t('commands.enableUsageBasedDescription'),
                        value: 'enable'
                    },
                    {
                        label: t('commands.setMonthlyLimitOption'),
                        description: t('commands.setMonthlyLimitDescription'),
                        value: 'set'
                    },
                    {
                        label: t('commands.disableUsageBasedOption'),
                        description: t('commands.disableUsageBasedDescription'),
                        value: 'disable'
                    }
                ], {
                    placeHolder: t('commands.currentStatus', { 
                        status: isEnabled ? t('statusBar.enabled') : t('statusBar.disabled'),
                        limit: isEnabled ? `(${t('statusBar.limit')}: $${currentLimit.hardLimit})` : ''
                    })
                });

                if (!quickPick) {
                    return;
                }

                switch (quickPick.value) {
                    case 'enable':
                        if (!isEnabled) {
                            const limit = await vscode.window.showInputBox({
                                prompt: t('commands.enterMonthlyLimit'),
                                placeHolder: '50',
                                validateInput: (value) => {
                                    const num = Number(value);
                                    return (!isNaN(num) && num > 0) ? null : t('commands.validNumberRequired');
                                }
                            });
                            if (limit) {
                                await setUsageLimit(token, Number(limit), false);
                                const formattedLimit = await convertAndFormatCurrency(Number(limit));
                                vscode.window.showInformationMessage(t('commands.usageBasedEnabledWithLimit', { limit: formattedLimit }));
                                await updateStats(statusBarItem);
                            }
                        } else {
                            vscode.window.showInformationMessage(t('commands.usageBasedAlreadyEnabled'));
                        }
                        break;

                    case 'set':
                        if (isEnabled) {
                            const newLimit = await vscode.window.showInputBox({
                                prompt: t('commands.enterNewMonthlyLimit'),
                                placeHolder: String(currentLimit.hardLimit),
                                validateInput: (value) => {
                                    const num = Number(value);
                                    return (!isNaN(num) && num > 0) ? null : t('commands.validNumberRequired');
                                }
                            });
                            if (newLimit) {
                                await setUsageLimit(token, Number(newLimit), false);
                                const formattedLimit = await convertAndFormatCurrency(Number(newLimit));
                                vscode.window.showInformationMessage(t('commands.limitUpdatedTo', { limit: formattedLimit }));
                                await updateStats(statusBarItem);
                            }
                        } else {
                            vscode.window.showWarningMessage(t('commands.enableUsageBasedFirst'));
                        }
                        break;

                    case 'disable':
                        if (isEnabled) {
                            await setUsageLimit(token, 0, true);
                            vscode.window.showInformationMessage(t('commands.usageBasedDisabled'));
                            await updateStats(statusBarItem);
                        } else {
                            vscode.window.showInformationMessage(t('commands.usageBasedAlreadyDisabled'));
                        }
                        break;
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(t('commands.failedToManageLimit', { error: error.message }));
            }
        });
        
        // Add command to status bar item
        statusBarItem.command = 'cursor-stats.openSettings';
        log('[Status Bar] Command assigned to status bar item');
        
        // Register package.json configuration contribution
        context.subscriptions.push(
            vscode.commands.registerCommand('cursor-stats.selectCurrency', async () => {
                const currencyPicks = SUPPORTED_CURRENCIES.map(code => ({
                    label: `${code} (${t('currency.' + code.toLowerCase())})`,
                    description: code === 'USD' ? 'Default' : '',
                    code
                }));
                
                const selected = await vscode.window.showQuickPick(currencyPicks, {
                    placeHolder: t('commands.selectCurrencyPrompt'),
                });
                
                if (selected) {
                    const config = vscode.workspace.getConfiguration('cursorStats');
                    await config.update('currency', selected.code, vscode.ConfigurationTarget.Global);
                    log(`[Settings] Currency changed to ${selected.code}`);
                    await updateStats(statusBarItem);
                }
            }),
            vscode.commands.registerCommand('cursor-stats.selectLanguage', async () => {
                log('[Command] Opening language selection...');
                const languages = [
                    { label: 'English', value: 'en' },
                    { label: '中文', value: 'zh' },
                    { label: '한국어', value: 'ko' }
                ];
                
                const currentLanguage = vscode.workspace.getConfiguration('cursorStats').get<string>('language', 'en');
                const currentLabel = languages.find(lang => lang.value === currentLanguage)?.label || 'English';
                
                const selectedLanguage = await vscode.window.showQuickPick(
                    languages.map(lang => ({
                        label: lang.label,
                        description: lang.value === currentLanguage ? '(Current)' : '',
                        value: lang.value
                    })),
                    {
                        placeHolder: t('commands.currentLanguagePrompt', { language: currentLabel }),
                        title: t('commands.selectLanguagePrompt')
                    }
                );
                
                if (selectedLanguage && selectedLanguage.value !== currentLanguage) {
                    const config = vscode.workspace.getConfiguration('cursorStats');
                    await config.update('language', selectedLanguage.value, vscode.ConfigurationTarget.Global);
                    log(`[Command] Language changed to: ${selectedLanguage.value}`);
                }
            })
        );
        
        
        // Add to subscriptions
        context.subscriptions.push(
            statusBarItem, 
            openCursorSettings, 
            refreshCommand, 
            setLimitCommand,
            createReportCommand,
            configListener,
            focusListener  // Add focus listener to subscriptions
        );
        log('[Initialization] Subscriptions registered');
        
        // Show status bar item explicitly
        log('[Status Bar] Showing status bar item...');
        statusBarItem.show();
        log('[Status Bar] Initial visibility state set');

        // Start refresh interval
        startRefreshInterval();

        // Initial update and update check
        setTimeout(async () => {
            await updateStats(statusBarItem);
            // Check for updates after initial stats are loaded
            await checkForUpdates(lastReleaseCheck, RELEASE_CHECK_INTERVAL);
        }, 1500);

        // Register configuration for the progress bars
        const config = vscode.workspace.getConfiguration('cursorStats');
        
        // Default settings for progress bars (disabled by default)
        if (config.get('showProgressBars') === undefined) {
            config.update('showProgressBars', false, vscode.ConfigurationTarget.Global);
        }
        
        if (config.get('progressBarLength') === undefined) {
            config.update('progressBarLength', 10, vscode.ConfigurationTarget.Global);
        }
        
        if (config.get('progressBarWarningThreshold') === undefined) {
            config.update('progressBarWarningThreshold', 75, vscode.ConfigurationTarget.Global);
        }
        
        if (config.get('progressBarCriticalThreshold') === undefined) {
            config.update('progressBarCriticalThreshold', 90, vscode.ConfigurationTarget.Global);
        }

        log('[Initialization] Extension activation completed successfully');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        log(`[Critical] Failed to activate extension: ${errorMessage}`, true);
        if (error instanceof Error && error.stack) {
            log(`[Critical] Stack trace: ${error.stack}`, true);
        }
        throw error;
    }
}

export function deactivate() {
    log('[Deactivation] Extension deactivation started');
    try {
        clearAllIntervals();
        log('[Deactivation] All intervals cleared');
        
        if (outputChannel) {
            outputChannel.dispose();
            log('[Deactivation] Output channel disposed');
        }
        
        log('[Deactivation] Extension deactivation completed successfully');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        log(`[Critical] Failed to deactivate extension cleanly: ${errorMessage}`, true);
        if (error instanceof Error && error.stack) {
            log(`[Critical] Stack trace: ${error.stack}`, true);
        }
        throw error;
    }
}
