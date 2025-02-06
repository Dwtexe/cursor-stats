import * as vscode from 'vscode';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as jwt from 'jsonwebtoken';
import { SQLiteRow, SQLiteError, TimingInfo, ComposerData } from '../interfaces/types';
import { log } from '../utils/logger';

export class DatabaseService {
    private db: Database.Database;
    private static instance: DatabaseService;

    private constructor() {
        const dbPath = path.join(process.cwd(), '.cursor-stats.db');
        this.db = new Database(dbPath);
        this.initializeDatabase();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    private initializeDatabase(): void {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS usage_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    tokens_used INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            `);
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    public addUsage(tokensUsed: number): void {
        const date = new Date().toISOString().split('T')[0];
        try {
            const stmt = this.db.prepare('INSERT INTO usage_stats (date, tokens_used) VALUES (?, ?)');
            stmt.run(date, tokensUsed);
        } catch (error) {
            console.error('Failed to add usage:', error);
            throw error;
        }
    }

    public getUsageForDate(date: string): number {
        try {
            const stmt = this.db.prepare('SELECT SUM(tokens_used) as total FROM usage_stats WHERE date = ?');
            const result = stmt.get(date) as { total: number };
            return result.total || 0;
        } catch (error) {
            console.error('Failed to get usage for date:', error);
            return 0;
        }
    }

    public getTotalUsage(): number {
        try {
            const stmt = this.db.prepare('SELECT SUM(tokens_used) as total FROM usage_stats');
            const result = stmt.get() as { total: number };
            return result.total || 0;
        } catch (error) {
            console.error('Failed to get total usage:', error);
            return 0;
        }
    }

    public getUsageHistory(days: number = 30): Array<{ date: string; tokens: number }> {
        try {
            const stmt = this.db.prepare(`
                SELECT date, SUM(tokens_used) as tokens
                FROM usage_stats
                WHERE date >= date('now', ?)
                GROUP BY date
                ORDER BY date DESC
            `);
            return stmt.all(`-${days} days`) as Array<{ date: string; tokens: number }>;
        } catch (error) {
            console.error('Failed to get usage history:', error);
            return [];
        }
    }

    public setSetting(key: string, value: string): void {
        try {
            const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            stmt.run(key, value);
        } catch (error) {
            console.error('Failed to set setting:', error);
            throw error;
        }
    }

    public getSetting(key: string): string | null {
        try {
            const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
            const result = stmt.get(key) as { value: string } | undefined;
            return result ? result.value : null;
        } catch (error) {
            console.error('Failed to get setting:', error);
            return null;
        }
    }

    public close(): void {
        try {
            this.db.close();
        } catch (error) {
            console.error('Failed to close database:', error);
        }
    }
}

export function getCursorDBPath(): string {
    const platform = process.platform;
    let appDataPath;

    switch (platform) {
        case 'win32':
            appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
            return path.join(appDataPath, 'Cursor', 'Session Storage', 'cursor.db');
        case 'darwin':
            appDataPath = path.join(os.homedir(), 'Library', 'Application Support');
            return path.join(appDataPath, 'Cursor', 'Session Storage', 'cursor.db');
        case 'linux':
            appDataPath = path.join(os.homedir(), '.config');
            return path.join(appDataPath, 'Cursor', 'Session Storage', 'cursor.db');
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

export async function getSessionToken(): Promise<string | undefined> {
    return new Promise((resolve) => {
        const dbPath = getCursorDBPath();

        log(`Attempting to read token from database at: ${dbPath}`);
        log(`Database path exists: ${require('fs').existsSync(dbPath)}`);

        try {
            const db = new Database(dbPath, { readonly: true, fileMustExist: true });
            const stmt = db.prepare("SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'");
            const row = stmt.get() as { value: string } | undefined;

            if (row) {
                log('Query completed. Row found: true');
                const token = row.value;
                log(`Token length: ${token.length}`);
                log(`Token starts with: ${token.substring(0, 20)}...`);

                const decoded = jwt.decode(token, { complete: true });
                log(`JWT decoded successfully: ${!!decoded}`);
                log(`JWT payload exists: ${!!(decoded && decoded.payload)}`);
                log(`JWT sub exists: ${!!(decoded && decoded.payload && (decoded as any).payload.sub)}`);

                if (!decoded || !decoded.payload || !(decoded as any).payload.sub) {
                    log('Invalid JWT structure: ' + JSON.stringify({ decoded }), true);
                    resolve(undefined);
                    return;
                }

                const sub = (decoded as any).payload.sub.toString();
                log(`Sub value: ${sub}`);
                const userId = sub.split('|')[1];
                log(`Extracted userId: ${userId}`);
                const sessionToken = `${userId}%3A%3A${token}`;
                log(`Created session token, length: ${sessionToken.length}`);
                resolve(sessionToken);
            } else {
                log('No token found in database');
                resolve(undefined);
            }

            db.close();
        } catch (error) {
            log(`Error accessing database: ${error}`, true);
            resolve(undefined);
        }
    });
}

export async function readComposerEntries(): Promise<Array<[string, string]>> {
    const dbPath = getCursorDBPath();

    try {
        const db = new Database(dbPath, { readonly: true, fileMustExist: true });
        const stmt = db.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'");
        const rows = stmt.all() as Array<{ key: string; value: string }>;
        db.close();

        return rows.map(row => [row.key, row.value]);
    } catch (error) {
        log(`Error querying database: ${error}`, true);
        return [];
    }
}

export function extractTimingInfo(value: string): TimingInfo | null {
    try {
        const parsed = JSON.parse(value) as ComposerData;
        let newestTiming: TimingInfo | null = null;

        for (const item of parsed.conversation) {
            if (item.timingInfo?.clientStartTime) {
                const timing = {
                    key: '',
                    timestamp: item.timingInfo.clientStartTime,
                    timingInfo: item.timingInfo
                };

                if (!newestTiming || timing.timestamp > newestTiming.timestamp) {
                    newestTiming = timing;
                }
            }
        }

        return newestTiming;
    } catch (error) {
        log(`Error parsing composer data: ${error}`, true);
        return null;
    }
}

export async function findNewestTimingInfo(): Promise<TimingInfo | null> {
    const entries = await readComposerEntries();
    let newestTiming: TimingInfo | null = null;

    for (const [key, value] of entries) {
        const timing = extractTimingInfo(value);
        if (timing) {
            timing.key = key;
            if (!newestTiming || timing.timestamp > newestTiming.timestamp) {
                newestTiming = timing;
            }
        }
    }

    return newestTiming;
} 