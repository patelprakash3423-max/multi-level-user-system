export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'user';
  parentId?: string;
  level: number;
  balance: number;
  downlineCount: number;
  isActive: boolean;
  createdAt: Date | string;
  lastLogin?: Date | string;
}

// export interface UserProfile {
//   _id: string;
//   username: string;
//   email: string;
//   role: 'owner' | 'admin' | 'user';
//   parentId?: {
//     _id: string;
//     username: string;
//     email: string;
//   };
//   level: number;
//   balance: number;
//   downlineCount: number;
//   isActive: boolean;
//   createdAt: Date | string;
//   lastLogin?: Date | string;

// }

export interface UserProfile {
  _id: string;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'user';

  parentId?: {
    _id: string;
    username: string;
    email: string;
  };

  level: number;
  balance: number;
  downlineCount: number;
  isActive: boolean;
  createdAt: Date | string;
  lastLogin?: any | string;

  // ✅ add these optional profile fields
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  bio?: string;
}


export interface DownlineUser {
  _id: string;
  username: string;
  email: string;
  role: string;
  level: number;
  balance: number;
  parentId?: string;
  downlineCount: number;
  isActive?: boolean;
  createdAt?: any | string;
  children?: DownlineUser[];
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  parentId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  captchaText: string;
  sessionId: string;
}

export interface DownlineStats {
  directChildren: number;
  totalDownline: number;
}



