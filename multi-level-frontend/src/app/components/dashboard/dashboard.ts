import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BalanceService } from '../../services/balance.service';
import { UserService } from '../../services/user.service';
import { User, DownlineStats } from '../../models/user.model';
import { Transaction } from '../../models/transaction.model';
import Swal from 'sweetalert2';
import { forkJoin, take } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  currentUser: User | null = null;
  balance: number = 0;
  downlineStats: DownlineStats = { directChildren: 0, totalDownline: 0 };
  recentTransactions: Transaction[] = [];

  constructor(
    private authService: AuthService,
    private balanceService: BalanceService,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadDashboardData(); // keep this
  }

  loadDashboardData(): void {
    this.authService.currentUser$
      .pipe(take(1))
      .subscribe(user => this.currentUser = user);

    // load all dashboard data together
    forkJoin({
      balance: this.balanceService.getBalance(),
      downline: this.userService.getDownline(),
      statement: this.balanceService.getStatement({ limit: 5 })
    }).subscribe({
      next: ({ balance, downline, statement }) => {

        this.balance = balance?.data?.balance ?? 0;
        this.downlineStats = downline?.data?.stats ?? { directChildren: 0, totalDownline: 0 };
        this.recentTransactions = statement?.data?.transactions ?? [];

        this.cdr.detectChanges(); // ⭐ THIS FIXES FIRST LOAD UI
      },
      error: (err) => {
        console.error('Dashboard load error:', err);
      }
    });

  }


  getWelcomeMessage(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  getUserRoleBadge(): string {
    switch (this.currentUser?.role) {
      case 'owner': return 'bg-danger';
      case 'admin': return 'bg-warning text-dark';
      case 'user': return 'bg-info';
      default: return 'bg-secondary';
    }
  }

  private isRefreshing = false;

  refreshDashboard(): void {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    this.loadDashboardData();

    setTimeout(() => {
      this.isRefreshing = false;
    }, 3000); // prevents rapid clicking → avoids 429

    Swal.fire('Refreshed', 'Dashboard data has been refreshed', 'success');
  }


  getTransactionTypeClass(type: string): string {
    switch (type) {
      case 'credit': return 'text-success';
      case 'debit': return 'text-danger';
      case 'recharge': return 'text-warning';
      default: return 'text-info';
    }
  }

  getTransactionIcon(type: string): string {
    switch (type) {
      case 'credit': return 'bi-arrow-down-circle';
      case 'debit': return 'bi-arrow-up-circle';
      case 'recharge': return 'bi-cash-stack';
      default: return 'bi-coin';
    }
  }
}