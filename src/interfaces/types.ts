export interface UsageItem {
  calculation: string;
  totalDollars: string;
  description?: string;
  modelNameForTooltip?: string;
  isDiscounted?: boolean;
}

export interface UsageInfo {
  percentage: number;
  type: 'premium' | 'usage-based';
  limit?: number;
  totalSpent?: number;
  premiumPercentage?: number;
}

export interface UsageBasedPricing {
  items: UsageItem[];
  hasUnpaidMidMonthInvoice: boolean;
  midMonthPayment: number;
}

export interface CursorStats {
    currentMonth: {
        month: number;
        year: number;
        usageBasedPricing: UsageBasedPricing;
    };
    lastMonth: {
        month: number;
        year: number;
        usageBasedPricing: UsageBasedPricing;
    };
    premiumRequests: {
        current: number;
        limit: number;
        startOfMonth: string;
    };
    isTeamSpendData?: boolean;
    teamId?: number;
    teamSpendCents?: number; // Add spendCents from team spend data
}

export interface ProgressBarSettings {
  barLength: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface SQLiteRow {
  value: string;
}

export interface SQLiteError extends Error {
  code?: string;
  errno?: number;
}

export interface AxiosErrorData {
  status?: number;
  data?: any;
  message?: string;
}

export interface ExtendedAxiosError {
  response?: AxiosErrorData;
  message: string;
}

export interface ComposerData {
  conversation: Array<{
    timingInfo?: {
      clientStartTime: number;
      [key: string]: any;
    };
    [key: string]: any;
  }>;
}

export interface TimingInfo {
  key: string;
  timestamp: number;
  timingInfo: {
    clientStartTime: number;
    [key: string]: any;
  };
}

export interface UsageLimitResponse {
    hardLimit?: number;
    hardLimitPerUser?: number;
    noUsageBasedAllowed?: boolean;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  prerelease: boolean;
  html_url: string;
  zipball_url: string;
  tarball_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export interface ReleaseCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  isPrerelease: boolean;
  releaseUrl: string;
  releaseNotes: string;
  releaseName: string;
  zipballUrl: string;
  tarballUrl: string;
  assets: Array<{
    name: string;
    downloadUrl: string;
  }>;
}

export interface CursorUsageResponse {
  'gpt-4': {
    numRequests: number;
    numRequestsTotal: number;
    numTokens: number;
    maxRequestUsage: number;
    maxTokenUsage: number | null;
  };
  'gpt-3.5-turbo': {
    numRequests: number;
    numRequestsTotal: number;
    numTokens: number;
    maxRequestUsage: number | null;
    maxTokenUsage: number | null;
  };
  'gpt-4-32k': {
    numRequests: number;
    numRequestsTotal: number;
    numTokens: number;
    maxRequestUsage: number | null;
    maxTokenUsage: number | null;
  };
  startOfMonth: string;
}

export interface TeamInfo {
  teams: Team[];
}

export interface Team {
  name: string;
  id: number;
  role: string;
  seats: number;
  hasBilling: boolean;
  requestQuotaPerSeat: number;
  privacyModeForced: boolean;
  allowSso: boolean;
}

export interface TeamMemberInfo {
  teamMembers: TeamMember[];
  userId: number;
}

export interface TeamMember {
  name: string;
  email: string;
  id: number;
  role: string;
}


export interface UserCache {
  userId: number;
  jwtSub: string;
  isTeamMember: boolean;
  teamId?: number;
  lastChecked: number;
  startOfMonth?: string;
}

export interface CurrencyRates {
  date: string;
  usd: {
    [key: string]: number;
  };
}

export interface CurrencyCache {
  rates: CurrencyRates;
  timestamp: number;
}

export interface CursorReport {
    timestamp: string;
    extensionVersion: string;
    os: string;
    vsCodeVersion: string;
    cursorStats: CursorStats | null;
    usageLimitResponse: UsageLimitResponse | null;
    premiumUsage: CursorUsageResponse | null;
    teamInfo: {
        isTeamMember: boolean;
        teamId?: number;
        userId?: number;
    } | null;
    teamSpend: TeamSpendResponse | null;
    rawResponses: {
        cursorStats?: any;
        usageLimit?: any;
        premiumUsage?: any;
        teamInfo?: any;
        teamSpend?: any;
        monthlyInvoice?: {
            current?: any;
            last?: any;
        };
    };
    logs: string[];
    errors: {
        [key: string]: string;
    };
}

export interface TeamSpendResponse {
    teamMemberSpend: TeamMemberSpend[];
    subscriptionCycleStart: string;
    totalMembers: number;
    totalPages: number;
}

export interface TeamMemberSpend {
    userId: number;
    name: string;
    email: string;
    role: string;
    hardLimitOverrideDollars: number;
    fastPremiumRequests?: number;
    spendCents?: number;
} 
