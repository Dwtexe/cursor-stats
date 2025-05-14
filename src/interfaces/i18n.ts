export interface Translation {
    statusBar: {
        noToken: string;
        error: string;
        apiUnavailable: string;
        retryingIn: string;
    };
    tooltips: {
        title: string;
        premiumRequests: string;
        requestsUsed: string;
        utilized: string;
        period: string;
        usageBasedPricing: string;
        currentUsage: string;
        total: string;
        unpaid: string;
        noUsageData: string;
        lastUpdated: string;
        errorFetching: string;
        apiUnavailable: string;
        autoRefreshPaused: string;
        lastAttempt: string;
        midMonthPayment: string;
        totalCost: string;
    };
    notifications: {
        unknownModel: {
            message: string;
            createReport: string;
            openIssues: string;
        };
        unpaidInvoice: {
            message: string;
            openBilling: string;
        };
        spendingThreshold: {
            message: string;
            detail: string;
            manageLimit: string;
            dismiss: string;
        };
        usageThreshold: {
            premium: {
                message: string;
                messageExceeded: string;
                detailExceeded: string;
                detail: string;
                viewSettings: string;
                enableUsageBased: string;
            };
            usageBased: {
                message: string;
                detail: string;
                manageLimit: string;
            };
        };
        settingsError: {
            message: string;
            fallback: string;
        };
    };
    currency: {
        format: string;
    };
    report: {
        generating: {
            title: string;
            progress: string;
        };
        success: {
            message: string;
            openFile: string;
            openFolder: string;
            openIssues: string;
        };
        error: {
            message: string;
            details: string;
        };
    };
    extension: {
        commands: {
            setLimit: {
                title: string;
                placeholder: string;
                enable: {
                    label: string;
                    description: string;
                    prompt: string;
                    success: string;
                };
                set: {
                    label: string;
                    description: string;
                    prompt: string;
                    success: string;
                };
                disable: {
                    label: string;
                    description: string;
                    success: string;
                };
                error: string;
                alreadyEnabled: string;
                alreadyDisabled: string;
                enableFirst: string;
            };
        };
    };
}

export interface LocaleConfig {
    code: string;
    name: string;
    translation: Translation;
} 