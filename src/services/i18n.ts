import * as vscode from 'vscode';
import { Translation, LocaleConfig } from '../interfaces/i18n';
import { log } from '../utils/logger';
import enLocale from '../locales/en.json';
import svLocale from '../locales/sv.json';

class I18nService {
    private static instance: I18nService;
    private currentLocale: string = 'en';
    private translations: Map<string, Translation> = new Map();
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        this.loadTranslations();
        this.setLocaleFromConfig();
        this.watchConfigChanges();
    }

    public static getInstance(): I18nService {
        if (!I18nService.instance) {
            I18nService.instance = new I18nService();
        }
        return I18nService.instance;
    }

    private loadTranslations() {
        try {
            // Load all translation files
            const locales: LocaleConfig[] = [
                enLocale,
                svLocale
                // Add more locales here
            ];

            locales.forEach(locale => {
                if (!locale.code || !locale.translation) {
                    log(`[i18n] Invalid locale config: ${JSON.stringify(locale)}`, true);
                    return;
                }
                this.translations.set(locale.code, locale.translation);
                log(`[i18n] Loaded translations for: ${locale.code}`);
            });

            if (this.translations.size === 0) {
                throw new Error('No valid translations loaded');
            }

            // Set initial locale from config
            this.setLocaleFromConfig();
        } catch (error: any) {
            log(`[i18n] Failed to load translations: ${error.message}`, true);
            // Ensure we at least have English loaded as fallback
            if (!this.translations.has('en')) {
                this.translations.set('en', enLocale.translation);
            }
        }
    }

    private setLocaleFromConfig() {
        try {
            const config = vscode.workspace.getConfiguration('cursorStats');
            const configLocale = config.get<string>('locale', 'en');
            
            if (this.translations.has(configLocale)) {
                this.currentLocale = configLocale;
                log(`[i18n] Locale set to: ${this.currentLocale}`);
            } else {
                log(`[i18n] Invalid locale ${configLocale}, falling back to en`, true);
                this.currentLocale = 'en';
            }
        } catch (error: any) {
            log(`[i18n] Error setting locale from config: ${error.message}`, true);
            this.currentLocale = 'en';
        }
    }

    private watchConfigChanges() {
        const disposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('cursorStats.locale')) {
                this.setLocaleFromConfig();
            }
        });
        this.disposables.push(disposable);
    }

    public t(key: string, params: Record<string, string | number> = {}): string {
        try {
            const translation = this.translations.get(this.currentLocale);
            if (!translation) {
                throw new Error(`No translations found for locale: ${this.currentLocale}`);
            }

            // Split the key by dots to traverse the translation object
            const keys = key.split('.');
            let result: any = translation;

            for (const k of keys) {
                result = result[k];
                if (result === undefined) {
                    throw new Error(`Translation key not found: ${key}`);
                }
            }

            // Replace parameters in the translation string
            let finalText = result;
            Object.entries(params).forEach(([param, value]) => {
                const regex = new RegExp(`{${param}}`, 'g');
                finalText = finalText.replace(regex, String(value));
            });

            return finalText;
        } catch (error: any) {
            log(`[i18n] Translation error: ${error.message}`, true);
            // Try English as fallback
            if (this.currentLocale !== 'en') {
                const enTranslation = this.translations.get('en');
                if (enTranslation) {
                    try {
                        const keys = key.split('.');
                        let result: any = enTranslation;
                        for (const k of keys) {
                            result = result[k];
                        }
                        return result;
                    } catch {
                        // If English fallback fails, return the key
                        return key;
                    }
                }
            }
            return key; // Return the key as last resort fallback
        }
    }

    public getCurrentLocale(): string {
        return this.currentLocale;
    }

    public getAvailableLocales(): string[] {
        return Array.from(this.translations.keys());
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

export const i18n = I18nService.getInstance(); 