import axios from 'axios';
import { log } from '../utils/logger';

export class ApiService {
    private static instance: ApiService;
    private baseUrl = 'https://api.cursor.sh';

    private constructor() { }

    public static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }

    public async getCurrentUsageLimit(token: string): Promise<number | undefined> {
        try {
            const response = await axios.get(`${this.baseUrl}/v1/usage/limit`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data.limit;
        } catch (error) {
            log(`Error fetching usage limit: ${error}`, true);
            return undefined;
        }
    }

    public async setUsageLimit(token: string, limit: number): Promise<boolean> {
        try {
            await axios.post(`${this.baseUrl}/v1/usage/limit`, {
                limit
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return true;
        } catch (error) {
            log(`Error setting usage limit: ${error}`, true);
            return false;
        }
    }

    public async checkUsageBasedStatus(token: string): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/v1/usage/status`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data.usageBased || false;
        } catch (error) {
            log(`Error checking usage based status: ${error}`, true);
            return false;
        }
    }

    public async fetchCursorStats(token: string): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/v1/stats`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            log(`Error fetching cursor stats: ${error}`, true);
            return undefined;
        }
    }
}

// Export singleton instance
export const apiService = ApiService.getInstance();

// Export getCurrentUsageLimit as a standalone function
export const getCurrentUsageLimit = async (token: string): Promise<number | undefined> => {
    return apiService.getCurrentUsageLimit(token);
}; 