import axios from 'axios';
import { CursorStats, UsageLimitResponse, ExtendedAxiosError, UsageItem, CursorUsageResponse } from '../interfaces/types';
import { log } from '../utils/logger';
import { checkTeamMembership, getTeamUsage, extractUserUsage } from './team';
import { getExtensionContext } from '../extension';

export async function getCurrentUsageLimit(token: string): Promise<UsageLimitResponse> {
    try {
        const response = await axios.post('https://www.cursor.com/api/dashboard/get-hard-limit',
            {}, // empty JSON body
            {
                headers: {
                    Cookie: `WorkosCursorSessionToken=${token}`
                }
            }
        );
        return response.data;
    } catch (error: any) {
        log('[API] Error fetching usage limit: ' + error.message, true);
        throw error;
    }
}

export async function setUsageLimit(token: string, hardLimit: number, noUsageBasedAllowed: boolean): Promise<void> {
    try {
        await axios.post('https://www.cursor.com/api/dashboard/set-hard-limit',
            {
                hardLimit,
                noUsageBasedAllowed
            },
            {
                headers: {
                    Cookie: `WorkosCursorSessionToken=${token}`
                }
            }
        );
        log(`[API] Successfully ${noUsageBasedAllowed ? 'disabled' : 'enabled'} usage-based pricing with limit: $${hardLimit}`);
    } catch (error: any) {
        log('[API] Error setting usage limit: ' + error.message, true);
        throw error;
    }
}

export async function checkUsageBasedStatus(token: string): Promise<{ isEnabled: boolean, limit?: number }> {
    try {
        const response = await getCurrentUsageLimit(token);
        return {
            isEnabled: !response.noUsageBasedAllowed,
            limit: response.hardLimit
        };
    } catch (error: any) {
        log(`[API] Error checking usage-based status: ${error.message}`, true);
        return {
            isEnabled: false
        };
    }
}

async function fetchMonthData(token: string, month: number, year: number): Promise<{ items: UsageItem[], hasUnpaidMidMonthInvoice: boolean, midMonthPayment: number }> {
    log(`[API] Fetching data for ${month}/${year}`);
    try {
        const response = await axios.post('https://www.cursor.com/api/dashboard/get-monthly-invoice', {
            month,
            year,
            includeUsageEvents: true
        }, {
            headers: {
                Cookie: `WorkosCursorSessionToken=${token}`
            }
        });

        const usageItems: UsageItem[] = [];
        let midMonthPayment = 0;
        if (response.data.items) {
            // First pass: find the maximum request count among valid items
            let maxRequestCount = 0;
            for (const item of response.data.items) {
                // Skip items without cents value
                if (!item.hasOwnProperty('cents')) {
                    log('[API] Skipping item without cents value: ' + item.description);
                    continue;
                }

                // Skip mid-month payment items
                if (item.description.includes('Mid-month usage paid')) {
                    continue;
                }

                // Try to extract request count from description
                const requestMatch = item.description.match(/^(\d+)/);
                if (requestMatch && requestMatch[1]) {
                    const requestCount = parseInt(requestMatch[1]);
                    maxRequestCount = Math.max(maxRequestCount, requestCount);
                }
            }

            // Calculate the padding width based on the maximum request count
            const paddingWidth = maxRequestCount.toString().length;

            for (const item of response.data.items) {
                // Skip items without cents value
                if (!item.hasOwnProperty('cents')) {
                    log('[API] Skipping item without cents value: ' + item.description);
                    continue;
                }

                // Check if this is a mid-month payment
                if (item.description.includes('Mid-month usage paid')) {
                    // Skip if cents is undefined
                    if (typeof item.cents === 'undefined') {
                        continue;
                    }
                    // Add to the total mid-month payment amount (convert from cents to dollars)
                    midMonthPayment += Math.abs(item.cents) / 100;
                    log(`[API] Added mid-month payment of $${(Math.abs(item.cents) / 100).toFixed(2)}, total now: $${midMonthPayment.toFixed(2)}`);
                    // Add a special line for mid-month payment that statusBar.ts can parse
                    usageItems.push({
                        calculation: `Mid-month payment: $${midMonthPayment.toFixed(2)}`,
                        totalDollars: `-$${midMonthPayment.toFixed(2)}`,
                        description: item.description
                    });
                    continue; // Skip adding this to regular usage items
                }

                const dollars = item.cents / 100;

                const requestMatch = item.description.match(/^(\d+)/);

                if (item.description.includes('extra fast premium requests')) {
                    const requestCount = parseInt(requestMatch?.[1] || '0');
                    // Ensure requestCount is not zero to avoid division by zero
                    const costPerRequest = requestCount > 0 ? item.cents / requestCount : 0;
                    const paddedRequestCount = requestCount.toString().padStart(paddingWidth, '0');
                    const costPerRequestDollars = (costPerRequest / 100).toFixed(2);

                    usageItems.push({
                        calculation: `${paddedRequestCount}*$${costPerRequestDollars} (Fast Requests)`,
                        totalDollars: `$${dollars.toFixed(2)}`,
                        description: item.description
                    });
                    continue;
                } else {
                    // Handle other types of requests (model-based, potentially MAX mode)
                    const modelMatch = item.description.match(/call(?:s)? to ([^,]+)/);
                    const modelNameFromDesc = modelMatch?.[1]; // Actual model name or undefined

                    const count = parseInt(requestMatch?.[1] || '1');
                    const paddedCount = count.toString().padStart(paddingWidth, '0');
                    const costPerRequestStr = (count > 0 ? (dollars / count) : dollars).toFixed(2);

                    let isMaxMode = false;
                    let displayStringPart = '';

                    if (modelNameFromDesc) {
                        displayStringPart = ` ${modelNameFromDesc}`;
                        // Check for MAX mode only if we have a model name from description
                        if (response.data.usageEvents) {
                            const eventsForThisModelAndCost = response.data.usageEvents.filter((e: any) => {
                                const composer = e.details?.toolCallComposer || e.details?.composer;
                                return composer?.modelIntent === modelNameFromDesc &&
                                    Math.abs(e.priceCents - (item.cents / count)) < 0.01; // Match price per request
                            });
                            if (eventsForThisModelAndCost.length > 0) {
                                isMaxMode = eventsForThisModelAndCost.some((e: any) => {
                                    const composer = e.details?.toolCallComposer || e.details?.composer;
                                    return composer?.maxMode;
                                });
                            }
                        }
                        if (isMaxMode) {
                            displayStringPart += ' (MAX)';
                        }
                    } else {
                        // No model name found in description, default to (Requests)
                        displayStringPart = ' (Requests)';
                    }

                    usageItems.push({
                        calculation: `${paddedCount}*$${costPerRequestStr}${displayStringPart}`,
                        totalDollars: `$${dollars.toFixed(2)}`,
                        description: item.description
                    });
                }
            }
        }

        return {
            items: usageItems,
            hasUnpaidMidMonthInvoice: false,
            midMonthPayment
        };
    } catch (error: any) {
        const axiosError = error as ExtendedAxiosError;
        log(`[API] Error fetching monthly data for ${month}/${year}: ${axiosError.message}`, true);
        log('[API] API error details: ' + JSON.stringify({
            status: axiosError.response?.status,
            data: axiosError.response?.data,
            message: axiosError.message
        }), true);
        throw error;
    }
}

export async function fetchCursorStats(token: string): Promise<CursorStats> {
    // Extract user ID from token
    const userId = token.split('%3A%3A')[0];

    try {
        // Check if user is a team member
        const context = getExtensionContext();
        const teamInfo = await checkTeamMembership(token, context);

        let premiumRequests;
        if (teamInfo.isTeamMember && teamInfo.teamId && teamInfo.userId) {
            // Fetch team usage for team members
            log('[API] Fetching team usage data...');
            const teamUsage = await getTeamUsage(token, teamInfo.teamId);
            const userUsage = extractUserUsage(teamUsage, teamInfo.userId);

            premiumRequests = {
                current: userUsage.numRequests,
                limit: userUsage.maxRequestUsage,
                startOfMonth: teamInfo.startOfMonth
            };
            log('[API] Successfully extracted team member usage data');
        } else {
            const premiumResponse = await axios.get<CursorUsageResponse>('https://www.cursor.com/api/usage', {
                params: { user: userId },
                headers: {
                    Cookie: `WorkosCursorSessionToken=${token}`
                }
            });

            premiumRequests = {
                current: premiumResponse.data['gpt-4'].numRequests,
                limit: premiumResponse.data['gpt-4'].maxRequestUsage,
                startOfMonth: premiumResponse.data.startOfMonth
            };
        }

        // Get current date for usage-based pricing (which renews on 2nd/3rd of each month)
        const currentDate = new Date();
        const usageBasedBillingDay = 3; // Assuming it's the 3rd day of the month
        let usageBasedCurrentMonth = currentDate.getMonth() + 1;
        let usageBasedCurrentYear = currentDate.getFullYear();

        // If we're in the first few days of the month (before billing date),
        // consider the previous month as the current billing period
        if (currentDate.getDate() < usageBasedBillingDay) {
            usageBasedCurrentMonth = usageBasedCurrentMonth === 1 ? 12 : usageBasedCurrentMonth - 1;
            if (usageBasedCurrentMonth === 12) {
                usageBasedCurrentYear--;
            }
        }

        // Calculate previous month for usage-based pricing
        const usageBasedLastMonth = usageBasedCurrentMonth === 1 ? 12 : usageBasedCurrentMonth - 1;
        const usageBasedLastYear = usageBasedCurrentMonth === 1 ? usageBasedCurrentYear - 1 : usageBasedCurrentYear;

        const currentMonthData = await fetchMonthData(token, usageBasedCurrentMonth, usageBasedCurrentYear);
        const lastMonthData = await fetchMonthData(token, usageBasedLastMonth, usageBasedLastYear);

        return {
            currentMonth: {
                month: usageBasedCurrentMonth,
                year: usageBasedCurrentYear,
                usageBasedPricing: currentMonthData
            },
            lastMonth: {
                month: usageBasedLastMonth,
                year: usageBasedLastYear,
                usageBasedPricing: lastMonthData
            },
            premiumRequests
        };
    } catch (error: any) {
        log('[API] Error fetching premium requests: ' + error, true);
        log('[API] API error details: ' + JSON.stringify({
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        }), true);
        throw error;
    }
}

export async function getStripeSessionUrl(token: string): Promise<string> {
    try {
        const response = await axios.get('https://www.cursor.com/api/stripeSession', {
            headers: {
                Cookie: `WorkosCursorSessionToken=${token}`
            }
        });
        // Remove quotes from the response string
        return response.data.replace(/"/g, '');
    } catch (error: any) {
        log('[API] Error getting Stripe session URL: ' + error.message, true);
        throw error;
    }
} 