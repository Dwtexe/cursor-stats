import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import {
  TeamInfo,
  TeamMemberInfo,
  TeamUsageResponse,
  UserCache,
  CursorUsageResponse,
} from '../interfaces/types';
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
    log(
      '[Team] Cache error details',
      {
        name: error.name,
        stack: error.stack,
        code: error.code,
      },
      true,
    );
  }
  return null;
}

export async function saveUserCache(
  context: vscode.ExtensionContext,
  cache: UserCache,
): Promise<void> {
  try {
    const cachePath = await getUserCachePath(context);
    log('[Team] Saving cache with data', {
      userId: cache.userId,
      isTeamMember: cache.isTeamMember,
      teamId: cache.teamId,
      lastChecked: new Date(cache.lastChecked).toISOString(),
      hasStartOfMonth: !!cache.startOfMonth,
    });

    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    log('[Team] Cache saved successfully');
  } catch (error: any) {
    log('[Team] Error saving user cache', error.message, true);
    log(
      '[Team] Save error details',
      {
        name: error.name,
        stack: error.stack,
        code: error.code,
      },
      true,
    );
  }
}

export async function checkTeamMembership(
  token: string,
  context: vscode.ExtensionContext,
): Promise<{ isTeamMember: boolean; teamId?: number; userId?: number; startOfMonth: string }> {
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
        startOfMonth: cache.startOfMonth,
      };
    }

    // Get start of month from usage API
    log('[Team] Cache miss or invalid, fetching fresh usage data');
    const tokenUserId = token.split('%3A%3A')[0];
    log('[Team] Making request to /api/usage endpoint');
    const usageResponse = await axios.get<CursorUsageResponse>('https://www.cursor.com/api/usage', {
      params: { user: tokenUserId },
      headers: {
        Cookie: `WorkosCursorSessionToken=${token}`,
      },
    });
    const startOfMonth = usageResponse.data.startOfMonth;
    log('[Team] Usage API response', {
      startOfMonth,
      hasGPT4Data: !!usageResponse.data['gpt-4'],
      status: usageResponse.status,
    });

    // Fetch team membership data
    log('[Team] Making request to /api/dashboard/teams endpoint');
    const response = await axios.post<TeamInfo>(
      'https://www.cursor.com/api/dashboard/teams',
      {}, // empty JSON body
      {
        headers: {
          Cookie: `WorkosCursorSessionToken=${token}`,
        },
      },
    );

    const isTeamMember = response.data.teams && response.data.teams.length > 0;
    const teamId = isTeamMember ? response.data.teams[0].id : undefined;
    log('[Team] Teams API response', {
      isTeamMember,
      teamId,
      teamCount: response.data.teams?.length || 0,
      status: response.status,
    });

    let teamUserId: number | undefined;

    if (isTeamMember && teamId) {
      // Fetch team details to get userId
      log('[Team] Making request to /api/dashboard/team endpoint');
      const teamResponse = await axios.post<TeamMemberInfo>(
        'https://www.cursor.com/api/dashboard/team',
        { teamId },
        {
          headers: {
            Cookie: `WorkosCursorSessionToken=${token}`,
          },
        },
      );
      teamUserId = teamResponse.data.userId;
      log('[Team] Team details response', {
        userId: teamUserId,
        memberCount: teamResponse.data.teamMembers.length,
        status: teamResponse.status,
      });
    }

    // Save to cache
    const cacheData = {
      userId: teamUserId || 0,
      jwtSub,
      isTeamMember,
      teamId,
      lastChecked: Date.now(),
      startOfMonth,
    };
    log('[Team] Saving new cache data');
    await saveUserCache(context, cacheData);

    return { isTeamMember, teamId, userId: teamUserId, startOfMonth };
  } catch (error: any) {
    log('[Team] Error checking team membership', error.message, true);
    log(
      '[Team] API error details',
      {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      },
      true,
    );
    throw error;
  }
}

export async function getTeamUsage(token: string, teamId: number): Promise<TeamUsageResponse> {
  try {
    log('[Team] Making request to get team usage');
    const response = await axios.post<TeamUsageResponse>(
      'https://www.cursor.com/api/dashboard/get-team-usage',
      { teamId }, // Include teamId in request body
      {
        headers: {
          Cookie: `WorkosCursorSessionToken=${token}`,
        },
      },
    );
    log('[Team] Team usage response', {
      memberCount: response.data.teamMemberUsage.length,
      status: response.status,
    });
    return response.data;
  } catch (error: any) {
    log('[Team] Error fetching team usage', error.message, true);
    log(
      '[Team] Team usage error details',
      {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      },
      true,
    );
    throw error;
  }
}

export function extractUserUsage(teamUsage: TeamUsageResponse, userId: number) {
  log('[Team] Extracting usage data for user', { userId });

  const userUsage = teamUsage.teamMemberUsage.find((member) => member.id === userId);
  if (!userUsage) {
    log(
      '[Team] User usage data not found in team response',
      {
        availableUserIds: teamUsage.teamMemberUsage.map((m) => m.id),
        searchedUserId: userId,
      },
      true,
    );
    throw new Error('User usage data not found in team usage response');
  }

  const gpt4Usage = userUsage.usageData.find((data) => data.modelType === 'gpt-4');
  if (!gpt4Usage) {
    log(
      '[Team] GPT-4 usage data not found for user',
      {
        userId,
        availableModels: userUsage.usageData.map((d) => d.modelType),
      },
      true,
    );
    throw new Error('GPT-4 usage data not found for user');
  }

  log('[Team] Successfully extracted user usage data', {
    userId,
    numRequests: gpt4Usage.numRequests,
    maxRequestUsage: gpt4Usage.maxRequestUsage,
    lastUsage: gpt4Usage.lastUsage,
  });

  return {
    numRequests: gpt4Usage.numRequests ?? 0,
    maxRequestUsage: gpt4Usage.maxRequestUsage,
  };
}
