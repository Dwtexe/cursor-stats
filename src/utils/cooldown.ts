import { getRefreshIntervalMs } from '../extension';
import { updateStats } from '../utils/updateStats';
import { log } from './logger';
import * as vscode from 'vscode';
import { t } from './i18n';

// Private state
let _countdownInterval: NodeJS.Timeout | null = null;
let _refreshInterval: NodeJS.Timeout | null = null;
let _cooldownStartTime: number | null = null;
let _consecutiveErrorCount: number = 0;
let _isWindowFocused: boolean = true;
let _statusBarItem: vscode.StatusBarItem | null = null;

export const COOLDOWN_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Getters
export const getCountdownInterval = () => _countdownInterval;
export const getRefreshInterval = () => _refreshInterval;
export const getCooldownStartTime = () => _cooldownStartTime;
export const getConsecutiveErrorCount = () => _consecutiveErrorCount;
export const getIsWindowFocused = () => _isWindowFocused;
export const getStatusBarItem = () => _statusBarItem;

// Setters
export const setCountdownInterval = (interval: NodeJS.Timeout | null) => {
  _countdownInterval = interval;
};

export const setRefreshInterval = (interval: NodeJS.Timeout | null) => {
  _refreshInterval = interval;
};

export const setCooldownStartTime = (time: number | null) => {
  _cooldownStartTime = time;
};

export const setConsecutiveErrorCount = (count: number) => {
  _consecutiveErrorCount = count;
};

export const setIsWindowFocused = (focused: boolean) => {
  _isWindowFocused = focused;
};

export const setStatusBarItem = (item: vscode.StatusBarItem) => {
  _statusBarItem = item;
};

export const incrementConsecutiveErrorCount = () => {
  _consecutiveErrorCount++;
  return _consecutiveErrorCount;
};

export const resetConsecutiveErrorCount = () => {
  _consecutiveErrorCount = 0;
};

export function formatCountdown(remainingMs: number): string {
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function startCountdownDisplay() {
  if (_countdownInterval) {
    clearInterval(_countdownInterval);
    _countdownInterval = null;
  }

  const updateCountdown = () => {
    if (!_cooldownStartTime || !_statusBarItem) {
      return;
    }

    const now = Date.now();
    const elapsed = now - _cooldownStartTime;
    const remaining = COOLDOWN_DURATION_MS - elapsed;

    if (remaining <= 0) {
      // Cooldown finished
      if (_countdownInterval) {
        clearInterval(_countdownInterval);
        _countdownInterval = null;
      }
      _cooldownStartTime = null;
      _consecutiveErrorCount = 0;
      startRefreshInterval(); // Resume normal operation
      if (_statusBarItem) {
        updateStats(_statusBarItem); // Try updating immediately
      }
      return;
    }

    // Update status bar with countdown
    _statusBarItem.text = `$(warning) ${t('statusBar.apiUnavailable', { countdown: formatCountdown(remaining) })}`;
    _statusBarItem.show();
    log(`[Cooldown] Updated countdown: ${formatCountdown(remaining)}`);
  };

  // Start the countdown immediately
  updateCountdown();
  // Then set up the interval
  _countdownInterval = setInterval(updateCountdown, 1000);

  log(`[Cooldown] Started countdown timer at ${new Date().toISOString()}`);
}

export function startRefreshInterval() {
  // Clear any existing interval
  if (_refreshInterval) {
    clearInterval(_refreshInterval);
    _refreshInterval = null;
  }

  // Don't start interval if in cooldown or window not focused
  if (_cooldownStartTime || !_isWindowFocused) {
    log(
      `[Refresh] Refresh interval not started: ${_cooldownStartTime ? 'in cooldown' : 'window not focused'}`,
    );
    return;
  }

  // Start new interval
  const intervalMs = getRefreshIntervalMs();
  log(`[Refresh] Starting refresh interval: ${intervalMs}ms`);
  if (_statusBarItem) {
    _refreshInterval = setInterval(() => {
      if (!_cooldownStartTime) {
        // Double-check we're not in cooldown
        updateStats(_statusBarItem!);
      }
    }, intervalMs);
  }
}

// Cleanup function
export function clearAllIntervals() {
  if (_countdownInterval) {
    clearInterval(_countdownInterval);
    _countdownInterval = null;
  }
  if (_refreshInterval) {
    clearInterval(_refreshInterval);
    _refreshInterval = null;
  }
}
