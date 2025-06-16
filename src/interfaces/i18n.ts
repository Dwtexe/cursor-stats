// Language pack interface definition
export interface LanguagePack {
  // Status bar related
  statusBar: {
    premiumFastRequests: string;
    usageBasedPricing: string;
    teamUsage: string;
    period: string;
    utilized: string;
    used: string;
    remaining: string;
    limit: string;
    spent: string;
    of: string;
    perDay: string;
    dailyRemaining: string;
    weekdaysOnly: string;
    today: string;
    isWeekend: string;
    cursorUsageStats: string;
    errorState: string;
    enabled: string;
    disabled: string;
    noUsageRecorded: string;
    usageBasedDisabled: string;
    errorCheckingStatus: string;
    unableToCheckStatus: string;
    unpaidAmount: string;
    youHavePaid: string;
    accountSettings: string;
    currency: string;
    extensionSettings: string;
    refresh: string;

    // New keys for updateStats
    noTokenFound: string;
    couldNotRetrieveToken: string;
    requestsUsed: string;
    fastRequestsPeriod: string;
    usageBasedPeriod: string;
    currentUsage: string;
    total: string;
    unpaid: string;
    discounted: string;
    unknownModel: string;
    unknownItem: string;
    totalCost: string;
    noUsageDataAvailable: string;

    // New keys for progressBars
    usage: string;
    weekday: string;
    weekdays: string;

    // Additional status bar keys
    month: string;

    // New keys for cooldown
    apiUnavailable: string;

    months: {
      january: string;
      february: string;
      march: string;
      april: string;
      may: string;
      june: string;
      july: string;
      august: string;
      september: string;
      october: string;
      november: string;
      december: string;
    };
  };

  // Notification related
  notifications: {
    usageThresholdReached: string;
    usageExceededLimit: string;
    spendingThresholdReached: string;
    unpaidInvoice: string;
    enableUsageBasedTitle: string;
    enableUsageBasedDetail: string;
    viewSettingsTitle: string;
    viewSettingsDetail: string;
    manageLimitTitle: string;
    manageLimitDetail: string;
    nextNotificationAt: string;
    currentTotalCost: string;
    payInvoiceToContinue: string;
    openBillingPage: string;
    dismiss: string;
    unknownModelsDetected: string;
    usageBasedSpendingThreshold: string;
    failedToOpenSettings: string;
  };

  // Command related
  commands: {
    refreshStats: string;
    openSettings: string;
    setLimit: string;
    selectCurrency: string;
    createReport: string;
    enableUsageBased: string;
    setMonthlyLimit: string;
    disableUsageBased: string;
    selectLanguage: string;
    languageChanged: string;
    openGitHubIssues: string;

    // Report generation related
    createReportProgress: string;
    gatheringData: string;
    completed: string;
    reportCreatedSuccessfully: string;
    openFile: string;
    openFolder: string;

    // New keys for extension.ts
    enableUsageBasedOption: string;
    enableUsageBasedDescription: string;
    setMonthlyLimitOption: string;
    setMonthlyLimitDescription: string;
    disableUsageBasedOption: string;
    disableUsageBasedDescription: string;
    enterMonthlyLimit: string;
    enterNewMonthlyLimit: string;
    validNumberRequired: string;
    usageBasedEnabledWithLimit: string;
    usageBasedAlreadyEnabled: string;
    limitUpdatedTo: string;
    enableUsageBasedFirst: string;
    usageBasedDisabled: string;
    usageBasedAlreadyDisabled: string;
    failedToManageLimit: string;
    currentStatus: string;
    selectCurrencyPrompt: string;
    currentLanguagePrompt: string;
    selectLanguagePrompt: string;
  };

  // Settings related
  settings: {
    enableUsageBasedPricing: string;
    changeMonthlyLimit: string;
    disableUsageBasedPricing: string;
    enableUsageBasedDescription: string;
    setLimitDescription: string;
    disableUsageBasedDescription: string;
    currentLimit: string;
    enterNewLimit: string;
    invalidLimit: string;
    limitUpdated: string;
    signInRequired: string;
    updateFailed: string;
  };

  // Error messages
  errors: {
    tokenNotFound: string;
    apiError: string;
    databaseError: string;
    networkError: string;
    updateFailed: string;
    unknownError: string;

    // Report generation errors
    failedToCreateReport: string;
    errorCreatingReport: string;
  };

  // Time related
  time: {
    day: string;
    days: string;
    hour: string;
    hours: string;
    minute: string;
    minutes: string;
    second: string;
    seconds: string;
    ago: string;
    refreshing: string;
    lastUpdated: string;
  };

  // Currency related
  currency: {
    usd: string;
    eur: string;
    gbp: string;
    jpy: string;
    cny: string;
  };

  // Progress bar related
  progressBar: {
    errorParsingDates: string;
    dailyRemainingLimitReached: string;
    dailyRemainingWeekend: string;
    dailyRemainingPeriodEnding: string;
    dailyRemainingCalculation: string;
  };

  // API related
  api: {
    midMonthPayment: string;
    toolCalls: string;
    fastPremium: string;
    requestUnit: string;
  };

  // GitHub related
  github: {
    preRelease: string;
    stableRelease: string;
    latest: string;
    updateAvailable: string;
    changesTitle: string;
    sourceCodeZip: string;
    sourceCodeTarGz: string;
    viewFullRelease: string;
    installedMessage: string;
  };
}
