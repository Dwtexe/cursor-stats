import * as vscode from 'vscode';
import { DatabaseService } from '../services/database';
import { log } from '../utils/logger';

export class NotificationHandler {
    private static instance: NotificationHandler;
    private dbService: DatabaseService;
    private notifiedThresholds: Set<number> = new Set();

    constructor() {
        this.dbService = DatabaseService.getInstance();
    }

    public static getInstance(): NotificationHandler {
        if (!NotificationHandler.instance) {
            NotificationHandler.instance = new NotificationHandler();
        }
        return NotificationHandler.instance;
    }

    public async checkAndNotifyUsage(limit: number): Promise<void> {
        const usage = this.dbService.getTotalUsage();
        const percentage = Math.round((usage / Number(limit)) * 100);

        const config = vscode.workspace.getConfiguration('cursorStats');
        const enableAlerts = config.get<boolean>('enableAlerts', true);
        const thresholds = config.get<number[]>('usageAlertThresholds', [75, 90, 100]);

        if (!enableAlerts) {
            return;
        }

        for (const threshold of thresholds) {
            if (percentage >= threshold && !this.notifiedThresholds.has(threshold)) {
                this.notifiedThresholds.add(threshold);
                const message = `You have used ${percentage}% of your Cursor token limit (${usage}/${limit} tokens)`;
                
                if (threshold === 100) {
                    vscode.window.showErrorMessage(message);
                } else if (threshold >= 90) {
                    vscode.window.showWarningMessage(message);
                } else {
                    vscode.window.showInformationMessage(message);
                }
            }
        }
    }

    public resetNotifications(): void {
        this.notifiedThresholds.clear();
    }
} 