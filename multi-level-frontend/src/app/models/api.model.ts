export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export interface CaptchaResponse {
  sessionId: string;
  captchaImage: string;
  expiresAt: Date;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
}

export interface BalanceSummary {
  summary: {
    totalBalance: number;
    totalUsers: number;
    avgBalance: number;
    maxBalance: number;
    minBalance: number;
  };
  byLevel: Array<{
    _id: number;
    totalBalance: number;
    userCount: number;
    avgBalance: number;
  }>;
  byRole: Array<{
    _id: string;
    totalBalance: number;
    userCount: number;
    avgBalance: number;
  }>;
  recentTransactions: any[];
  topUsers: any[];
}