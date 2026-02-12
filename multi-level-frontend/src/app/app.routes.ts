import { Routes } from '@angular/router';
import { Login } from '../app/components/login/login';
import { Dashboard } from '../app/components/dashboard/dashboard';
import { AuthGuard } from './guards/auth.guard';
import { CreateUser } from './components/create-user/create-user';
import { TransferBalance } from './components/transfer-balance/transfer-balance';
import { DownlineTree } from './components/downline-tree/downline-tree';
import { AdminDashboard } from './components/admin-dashboard/admin-dashboard';
import { AdminUsers } from './components/admin-users/admin-users';
import { AdminHierarchy } from './components/admin-hierarchy/admin-hierarchy';
import { AdminCredit } from './components/admin-credit/admin-credit';
import { Register } from './components/register/register';
import { BalanceStatementComponent } from './components/balance-statement/balance-statement';
import { UserProfileComponent } from './components/user-profile/user-profile';
import { Recharge } from './components/recharge/recharge';
import { RoleGuard } from './guards/role.guard';

export const routes: Routes = [
  // Public routes
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  // Protected routes
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [AuthGuard]
  },
  {
    path: 'create-user',
    component: CreateUser,
    canActivate: [AuthGuard]
  },
  {
    path: 'transfer',
    component: TransferBalance,
    canActivate: [AuthGuard]
  },
  {
    path: 'downline',
    component: DownlineTree,
    canActivate: [AuthGuard]
  },
  {
    path: 'statement',
    component: BalanceStatementComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'profile',
    component: UserProfileComponent,
    canActivate: [AuthGuard]
  },

  // Admin routes
  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'owner'] }
  },
  {
    path: 'admin/users',
    component: AdminUsers,
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'owner'] }
  },
  {
    path: 'admin/hierarchy',
    component: AdminHierarchy,
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'owner'] }
  },
  {
    path: 'admin/credit',
    component: AdminCredit,
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'owner'] }
  },

  // Default redirect
  { path: '', redirectTo: '/login', pathMatch: 'full' },

 { 
    path: 'recharge', 
    component: Recharge,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['owner'] } // SIRF OWNER!
  },

  // Wildcard route
  { path: '**', redirectTo: '/login' }
];