import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { TeamInfo, TeamMemberInfo, TeamSpendResponse, TeamMemberSpend, UserCache, CursorUsageResponse } from '../interfaces/types';
import { log } from '../utils/logger';

const CACHE_FILE_NAME = 'user-cache.json';

export async function getUserCachePath(context: vscode.ExtensionContext): Promise<string> {
    const cachePath = path.join(context.extensionPath, CACHE_FILE_NAME);
    return cachePath;
}

export async function loadUserCache(context: vscode.ExtensionContext): Promise<UserCache | null> {
    try {
        const cachePath = await getUserCachePath(context);        
        if (fs.existsSync(cachePath)) {
            const cacheData = fs.readFileSync(cachePath, 'utf8');
            const cache = JSON.parse(cacheData);
            return cache;
        } else {
            log('[Team] No cache file found');
        }
    } catch (error: any) {
        log('[Team] Error loading user cache', error.message, true);
        log('[Team] Cache error details', {
            name: error.name,
            stack: error.stack,
            code: error.code
        }, true);
    }
    return null;
}

export async function saveUserCache(context: vscode.ExtensionContext, cache: UserCache): Promise<void> {
    try {
        const cachePath = await getUserCachePath(context);
        log('[Team] Saving cache with data', {
            userId: cache.userId,
            isTeamMember: cache.isTeamMember,
            teamId: cache.teamId,
            lastChecked: new Date(cache.lastChecked).toISOString(),
            hasStartOfMonth: !!cache.startOfMonth
        });
        
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
        log('[Team] Cache saved successfully');
    } catch (error: any) {
        log('[Team] Error saving user cache', error.message, true);
        log('[Team] Save error details', {
            name: error.name,
            stack: error.stack,
            code: error.code
        }, true);
    }
}

export async function checkTeamMembership(token: string, context: vscode.ExtensionContext): Promise<{ isTeamMember: boolean; teamId?: number; userId?: number; startOfMonth: string }> {
    try {
        // Extract JWT sub from token
        const jwtToken = token.split('%3A%3A')[1];
        const decoded = jwt.decode(jwtToken, { complete: true });
        const jwtSub = decoded?.payload?.sub as string;

        // Check cache first
        const cache = await loadUserCache(context);
        if (cache && cache.jwtSub === jwtSub && cache.startOfMonth) {
            return {
                isTeamMember: cache.isTeamMember,
                teamId: cache.teamId,
                userId: cache.userId,
                startOfMonth: cache.startOfMonth
            };
        }

        // Get start of month from usage API
        log('[Team] Cache miss or invalid, fetching fresh usage data');
        const tokenUserId = token.split('%3A%3A')[0];
        log('[Team] Making request to /api/usage endpoint');
        const usageResponse = await axios.get<CursorUsageResponse>('https://cursor.com/api/usage', {
            params: { user: tokenUserId },
            headers: {
                Cookie: `WorkosCursorSessionToken=${token}`
            }
        });
        const startOfMonth = usageResponse.data.startOfMonth;
        log('[Team] Usage API response', {
            startOfMonth,
            hasGPT4Data: !!usageResponse.data['gpt-4'],
            status: usageResponse.status
        });

        // Fetch team membership data
        log('[Team] Making request to /api/dashboard/teams endpoint');
        const response = await axios.post<TeamInfo>('https://cursor.com/api/dashboard/teams', 
            {}, // empty JSON body
            {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `WorkosCursorSessionToken=${token}`
                }
            }
        );
        
        const isTeamMember = response.data.teams && response.data.teams.length > 0;
        const teamId = isTeamMember ? response.data.teams[0].id : undefined;
        log('[Team] Teams API response', {
            isTeamMember,
            teamId,
            teamCount: response.data.teams?.length || 0,
            status: response.status
        });

        let teamUserId: number | undefined;

        if (isTeamMember && teamId) {
            // Fetch team details to get userId
            log('[Team] Making request to /api/dashboard/team endpoint');
            const teamResponse = await axios.post<TeamMemberInfo>('https://cursor.com/api/dashboard/team', 
                { teamId },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `WorkosCursorSessionToken=${token}`
                    }
                }
            );
            teamUserId = teamResponse.data.userId;
            log('[Team] Team details response', {
                userId: teamUserId,
                memberCount: teamResponse.data.teamMembers.length,
                status: teamResponse.status
            });
        }

        // Save to cache
        const cacheData = {
            userId: teamUserId || 0,
            jwtSub,
            isTeamMember,
            teamId,
            lastChecked: Date.now(),
            startOfMonth
        };
        log('[Team] Saving new cache data');
        await saveUserCache(context, cacheData);

        return { isTeamMember, teamId, userId: teamUserId, startOfMonth };
    } catch (error: any) {
        log('[Team] Error checking team membership', error.message, true);
        log('[Team] API error details', {
            status: error.response?.status,
            data: error.response?.data,
            headers: error.response?.headers,
            config: {
                url: error.config?.url,
                method: error.config?.method
            }
        }, true);
        throw error;
    }
}

export async function getTeamSpend(token: string, teamId: number): Promise<TeamSpendResponse> {
    try {
        log('[Team] Making request to get team spend');
        const response = await axios.post<TeamSpendResponse>('https://cursor.com/api/dashboard/get-team-spend', 
            { teamId }, // Include teamId in request body
            {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `WorkosCursorSessionToken=${token}`
                }
            }
        );
        log('[Team] Team spend response', {
            memberCount: response.data.teamMemberSpend.length,
            totalMembers: response.data.totalMembers,
            status: response.status
        });
        return response.data;
    } catch (error: any) {
        log('[Team] Error fetching team spend', error.message, true);
        log('[Team] Team spend error details', {
            status: error.response?.status,
            data: error.response?.data,
            headers: error.response?.headers,
            config: {
                url: error.config?.url,
                method: error.config?.method
            }
        }, true);
        throw error;
    }
}

export function extractUserSpend(teamSpend: TeamSpendResponse, userId: number) {
    log('[Team] Extracting spend data for user', { userId });
    
    const userSpend = teamSpend.teamMemberSpend.find(member => member.userId === userId);
    if (!userSpend) {
        log('[Team] User spend data not found in team response', {
            availableUserIds: teamSpend.teamMemberSpend.map(m => m.userId),
            searchedUserId: userId
        }, true);
        throw new Error('User spend data not found in team spend response');
    }

    log('[Team] Successfully extracted user spend data', {
        userId,
        name: userSpend.name,
        email: userSpend.email,
        role: userSpend.role,
        hardLimitOverrideDollars: userSpend.hardLimitOverrideDollars,
        fastPremiumRequests: userSpend.fastPremiumRequests || 0
    });

    return {
        userId: userSpend.userId,
        name: userSpend.name,
        email: userSpend.email,
        role: userSpend.role,
        hardLimitOverrideDollars: userSpend.hardLimitOverrideDollars,
        fastPremiumRequests: userSpend.fastPremiumRequests || 0
    };
} 