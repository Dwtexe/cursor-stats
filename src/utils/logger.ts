import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;
// Keep a log history in memory for reporting
const logHistory: string[] = [];
const MAX_LOG_HISTORY = 1000; // Maximum number of log entries to keep in memory

export function initializeLogging(context: vscode.ExtensionContext): void {
  try {
    outputChannel = vscode.window.createOutputChannel('Cursor Stats');
    context.subscriptions.push(outputChannel);
    log('[Initialization] Output channel created successfully');
  } catch {
    log('[Critical] Failed to create output channel', true);
    throw new Error('Failed to initialize logging system');
  }
}

export function log(message: string, data?: any, error: boolean = false): void {
  const config = vscode.workspace.getConfiguration('cursorStats');
  const loggingEnabled = config.get<boolean>('enableLogging', false);

  const shouldLog =
    error ||
    (loggingEnabled &&
      (message.includes('[Initialization]') ||
        message.includes('[Status Bar]') ||
        message.includes('[Database]') ||
        message.includes('[Auth]') ||
        message.includes('[Stats]') ||
        message.includes('[API]') ||
        message.includes('[GitHub]') ||
        message.includes('[Panels]') ||
        message.includes('[Command]') ||
        message.includes('[Notifications]') ||
        message.includes('[Refresh]') ||
        message.includes('[Settings]') ||
        message.includes('[Critical]') ||
        message.includes('[Deactivation]') ||
        message.includes('[Team]') ||
        message.includes('[Cooldown]') ||
        message.includes('[Currency]') ||
        message.includes('[Report]')));

  if (shouldLog) {
    safeLog(message, data, error);
  }
}

function safeLog(message: string, data?: any, isError: boolean = false): void {
  const timestamp = new Date().toISOString();
  const logLevel = isError ? 'ERROR' : 'INFO';
  let logMessage = `[${timestamp}] [${logLevel}] ${message}`;

  // Add data if provided
  if (data !== undefined) {
    try {
      const dataString =
        typeof data === 'object' ? '\n' + JSON.stringify(data, null, 2) : ' ' + data.toString();
      logMessage += dataString;
    } catch {
      logMessage += ' [Error stringifying data]';
    }
  }

  // Store in the log history
  addToLogHistory(logMessage);

  // Always log to console
  if (isError) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }

  // Try to log to output channel if it exists
  try {
    outputChannel?.appendLine(logMessage);
  } catch {
    console.error('Failed to write to output channel');
  }

  // Show error messages in the UI for critical issues
  if (isError && message.includes('[Critical]')) {
    try {
      vscode.window.showErrorMessage(`Cursor Stats: ${message}`);
    } catch {
      console.error('Failed to show error message in UI');
    }
  }
}

function addToLogHistory(logMessage: string): void {
  // Add to the beginning for most recent first
  logHistory.unshift(logMessage);

  // Trim if exceeds maximum size
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.length = MAX_LOG_HISTORY;
  }
}

// Get all stored logs for reporting purposes
export function getLogHistory(): string[] {
  return [...logHistory];
}

// Clear the log history
export function clearLogHistory(): void {
  logHistory.length = 0;
}

export function disposeLogger(): void {
  if (outputChannel) {
    outputChannel.dispose();
    outputChannel = undefined;
  }
}
