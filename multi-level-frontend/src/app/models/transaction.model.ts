export interface Transaction {
  _id: string;
  sender: {
    _id: string;
    username: string;
    email: string;
  };
  receiver: {
    _id: string;
    username: string;
    email: string;
  };
  amount: number;
  type: 'credit' | 'debit' | 'recharge' | 'commission';
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  commissionEarned?: number;
  level: number;
  status: 'completed' | 'failed' | 'pending';
  createdAt: Date;
}

export interface TransferRequest {
  receiverId: string;
  amount: number;
  description?: string;
}

export interface BalanceStatement {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  summary: Array<{
    _id: string;
    totalAmount: number;
    count: number;
  }>;
}