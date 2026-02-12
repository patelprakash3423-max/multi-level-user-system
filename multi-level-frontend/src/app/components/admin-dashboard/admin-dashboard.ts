import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { BalanceService } from '../../services/balance.service';
import { User } from '../../models/user.model';
import { Transaction } from '../../models/transaction.model';
import { BalanceSummary } from '../../models/api.model';
import Swal from 'sweetalert2';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  // Data
  users: User[] = [];
  recentTransactions: Transaction[] = [];
  balanceSummary: BalanceSummary | null = null;
  topUsers: User[] = [];
  currentDate = new Date();

  // Stats
  totalUsers: number = 0;
  totalBalance: number = 0;
  activeUsers: number = 0;
  inactiveUsers: number = 0;
  totalAdmins: number = 0;
  totalOwners: number = 0;
  totalTransactions: number = 0;
  todayTransactions: number = 0;
  pendingTransactions: number = 0;

  // Charts
  userGrowthChart: any;
  transactionVolumeChart: any;
  userDistributionChart: any;
  balanceDistributionChart: any;

  // UI States
  isLoadingCharts = true;
  dateRange: 'today' | 'week' | 'month' | 'year' = 'month';
  selectedPeriod: 'day' | 'week' | 'month' = 'day';

  // System Health
  systemUptime: string = '99.9%';
  apiLatency: string = '45ms';
  activeSessions: number = 0;
  serverLoad: string = '32%';

  // Alerts
  showAlerts: boolean = false;
  alerts: Array<{
    type: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }> = [];

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private userService: UserService,
    private balanceService: BalanceService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.checkAdminAccess();
    this.loadDashboardData();
    this.loadCharts();
    this.loadSystemHealth();
    this.loadAlerts();
  }

  checkAdminAccess(): void {
    const user = this.authService.getCurrentUserValue();
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      this.router.navigate(['/dashboard']);
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to access the admin dashboard',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  loadDashboardData(): void {

    // Load balance summary
    this.adminService.getBalanceSummary().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.balanceSummary = response.data;
          this.calculateStats();
        }
      },
      error: (error) => {
        console.error('Balance summary error:', error);
      }
    });

    // Load all users
    this.adminService.getAllUsers({ limit: 1000 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.users = response.data.users;
          this.calculateUserStats();
        }
      },
      error: (error) => {
        console.error('Users load error:', error);
      }
    });

    // Load recent transactions
    this.balanceService.getStatement({ limit: 100 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.recentTransactions = response.data.transactions;
          this.calculateTransactionStats();
        }
      },
      error: (error) => {
        console.error('Transactions load error:', error);
      }
    });

    // Load top users
    if (this.balanceSummary?.topUsers) {
      this.topUsers = this.balanceSummary.topUsers;
    }
  }

  calculateStats(): void {
    if (this.balanceSummary) {
      this.totalUsers = this.balanceSummary.summary.totalUsers;
      this.totalBalance = this.balanceSummary.summary.totalBalance;

      // Calculate role distribution
      if (this.balanceSummary.byRole) {
        this.totalAdmins = this.balanceSummary.byRole.find(r => r._id === 'admin')?.userCount || 0;
        this.totalOwners = this.balanceSummary.byRole.find(r => r._id === 'owner')?.userCount || 0;
      }
    }
  }

  calculateUserStats(): void {
    this.activeUsers = this.users.filter(u => u.isActive !== false).length;
    this.inactiveUsers = this.users.filter(u => u.isActive === false).length;
  }

  calculateTransactionStats(): void {
    this.totalTransactions = this.recentTransactions.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.todayTransactions = this.recentTransactions.filter(t =>
      new Date(t.createdAt) >= today
    ).length;

    this.pendingTransactions = this.recentTransactions.filter(t =>
      t.status === 'pending'
    ).length;
  }

  loadCharts(): void {
    this.isLoadingCharts = true;

    // Simulate chart data loading
    setTimeout(() => {
      this.createUserGrowthChart();
      this.createTransactionVolumeChart();
      this.createUserDistributionChart();
      this.createBalanceDistributionChart();
      this.isLoadingCharts = false;
    }, 500);
  }

  createUserGrowthChart(): void {
    const ctx = document.getElementById('userGrowthChart') as HTMLCanvasElement;
    if (ctx) {
      // Destroy existing chart if it exists
      if (this.userGrowthChart) {
        this.userGrowthChart.destroy();
      }

      const days = this.getDateLabels();
      const data = this.generateUserGrowthData();

      this.userGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: days,
          datasets: [
            {
              label: 'New Users',
              data: data.newUsers,
              borderColor: '#667eea',
              backgroundColor: 'rgba(102, 126, 234, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Total Users',
              data: data.totalUsers,
              borderColor: '#28a745',
              backgroundColor: 'rgba(40, 167, 69, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                display: true
              }

            }
          }
        }
      });
    }
  }

  createTransactionVolumeChart(): void {
    const ctx = document.getElementById('transactionVolumeChart') as HTMLCanvasElement;
    if (ctx) {
      if (this.transactionVolumeChart) {
        this.transactionVolumeChart.destroy();
      }

      const labels = this.getHourLabels();

      this.transactionVolumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Credits',
              data: this.generateTransactionData('credit'),
              backgroundColor: 'rgba(40, 167, 69, 0.7)',
              borderColor: '#28a745',
              borderWidth: 1
            },
            {
              label: 'Debits',
              data: this.generateTransactionData('debit'),
              backgroundColor: 'rgba(220, 53, 69, 0.7)',
              borderColor: '#dc3545',
              borderWidth: 1
            },
            {
              label: 'Recharges',
              data: this.generateTransactionData('recharge'),
              backgroundColor: 'rgba(255, 193, 7, 0.7)',
              borderColor: '#ffc107',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
  display: true
}

            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }
  }

  createUserDistributionChart(): void {
    const ctx = document.getElementById('userDistributionChart') as HTMLCanvasElement;
    if (ctx && this.balanceSummary) {
      if (this.userDistributionChart) {
        this.userDistributionChart.destroy();
      }

      const levels = this.balanceSummary.byLevel.map(l => `Level ${l._id}`);
      const counts = this.balanceSummary.byLevel.map(l => l.userCount);
      const balances = this.balanceSummary.byLevel.map(l => l.totalBalance);

      this.userDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: levels,
          datasets: [
            {
              data: counts,
              backgroundColor: [
                'rgba(102, 126, 234, 0.7)',
                'rgba(40, 167, 69, 0.7)',
                'rgba(255, 193, 7, 0.7)',
                'rgba(220, 53, 69, 0.7)',
                'rgba(23, 162, 184, 0.7)',
                'rgba(108, 117, 125, 0.7)'
              ],
              borderColor: [
                '#667eea',
                '#28a745',
                '#ffc107',
                '#dc3545',
                '#17a2b8',
                '#6c757d'
              ],
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'right'
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.raw as number;
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: ${value} users (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  createBalanceDistributionChart(): void {
    const ctx = document.getElementById('balanceDistributionChart') as HTMLCanvasElement;
    if (ctx && this.balanceSummary) {
      if (this.balanceDistributionChart) {
        this.balanceDistributionChart.destroy();
      }

      const roles = this.balanceSummary.byRole.map(r => r._id.charAt(0).toUpperCase() + r._id.slice(1));
      const balances = this.balanceSummary.byRole.map(r => r.totalBalance);

      this.balanceDistributionChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: roles,
          datasets: [
            {
              data: balances,
              backgroundColor: [
                'rgba(220, 53, 69, 0.7)',  // owner - red
                'rgba(255, 193, 7, 0.7)',  // admin - yellow
                'rgba(23, 162, 184, 0.7)'  // user - blue
              ],
              borderColor: [
                '#dc3545',
                '#ffc107',
                '#17a2b8'
              ],
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'right'
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.raw as number;
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: $${value.toLocaleString()} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  loadSystemHealth(): void {
    // Simulate system health data
    this.activeSessions = Math.floor(Math.random() * 100) + 50;

    // Update every 30 seconds
    setInterval(() => {
      this.activeSessions = Math.floor(Math.random() * 100) + 50;
      this.serverLoad = `${Math.floor(Math.random() * 30) + 20}%`;
      this.apiLatency = `${Math.floor(Math.random() * 30) + 30}ms`;
    }, 30000);
  }

  loadAlerts(): void {
    // Simulate system alerts
    this.alerts = [
      {
        type: 'success',
        message: 'System backup completed successfully',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        read: false
      },
      {
        type: 'warning',
        message: '5 users have low balance',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        read: false
      },
      {
        type: 'info',
        message: 'New admin user created',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        read: true
      },
      {
        type: 'danger',
        message: 'Failed transaction: Insufficient balance',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        read: true
      }
    ];
  }

  // Helper Methods for Chart Data
  getDateLabels(): string[] {
    const labels = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    return labels;
  }

  getHourLabels(): string[] {
    const labels = [];
    for (let i = 0; i < 24; i += 3) {
      labels.push(`${i}:00`);
    }
    return labels;
  }

  generateUserGrowthData(): { newUsers: number[], totalUsers: number[] } {
    const newUsers = [];
    const totalUsers = [];
    let total = this.totalUsers - Math.floor(Math.random() * 50);

    for (let i = 0; i < 7; i++) {
      const dailyNew = Math.floor(Math.random() * 10) + 5;
      newUsers.push(dailyNew);
      total += dailyNew;
      totalUsers.push(total);
    }

    return { newUsers, totalUsers };
  }

  generateTransactionData(type: string): number[] {
    const data = [];
    for (let i = 0; i < 8; i++) {
      let value = 0;
      switch (type) {
        case 'credit':
          value = Math.floor(Math.random() * 5000) + 1000;
          break;
        case 'debit':
          value = Math.floor(Math.random() * 4000) + 500;
          break;
        case 'recharge':
          value = Math.floor(Math.random() * 2000) + 500;
          break;
      }
      data.push(value);
    }
    return data;
  }

  // Quick Actions
  quickAction(action: string): void {
    switch (action) {
      case 'create-admin':
        this.router.navigate(['/create-user']);
        break;
      case 'credit-balance':
        this.router.navigate(['/admin/credit']);
        break;
      case 'view-reports':
        Swal.fire('Reports', 'Reports feature coming soon', 'info');
        break;
      case 'system-settings':
        Swal.fire('Settings', 'System settings coming soon', 'info');
        break;
    }
  }

  // User Management
  viewAllUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  viewUserHierarchy(userId: string): void {
    this.router.navigate(['/admin/hierarchy'], { queryParams: { userId } });
  }

  editUser(userId: string): void {
    this.router.navigate(['/profile', userId]);
  }

  toggleUserStatus(userId: string, currentStatus: boolean): void {
    const action = currentStatus ? 'deactivate' : 'activate';

    Swal.fire({
      title: `${action} User?`,
      text: `Are you sure you want to ${action} this user?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#dc3545' : '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Yes, ${action}`,
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.toggleUserStatus(userId).subscribe({
          next: (response) => {
            if (response.success) {
              Swal.fire(
                'Success!',
                `User has been ${action}d successfully`,
                'success'
              );
              this.loadDashboardData(); // Reload data
            }
          },
          error: (error) => {
            Swal.fire(
              'Error',
              `Failed to ${action} user`,
              'error'
            );
          }
        });
      }
    });
  }

  // Transaction Management
  viewAllTransactions(): void {
    this.router.navigate(['/statement']);
  }

  viewTransactionDetails(transaction: Transaction): void {
    // Implement transaction details modal
    Swal.fire({
      title: 'Transaction Details',
      html: `
        <div class="text-start">
          <p><strong>ID:</strong> ${transaction._id}</p>
          <p><strong>Amount:</strong> $${transaction.amount}</p>
          <p><strong>Type:</strong> ${transaction.type}</p>
          <p><strong>From:</strong> ${transaction.sender?.username || 'System'}</p>
          <p><strong>To:</strong> ${transaction.receiver?.username || 'System'}</p>
          <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
          <p><strong>Status:</strong> ${transaction.status}</p>
        </div>
      `,
      confirmButtonText: 'Close',
      confirmButtonColor: '#667eea'
    });
  }

  // Date Range Selection
  setDateRange(range: 'today' | 'week' | 'month' | 'year'): void {
    this.dateRange = range;
    this.loadCharts();
  }

  setPeriod(period: 'day' | 'week' | 'month'): void {
    this.selectedPeriod = period;
    this.loadCharts();
  }

  // Export Functions
  exportReport(): void {
    Swal.fire({
      title: 'Export Report',
      text: 'Select report format',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'CSV',
      cancelButtonText: 'PDF',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        this.exportAsCSV();
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.exportAsPDF();
      }
    });
  }

  exportAsCSV(): void {
    const headers = ['Username', 'Email', 'Role', 'Level', 'Balance', 'Status', 'Joined'];
    const csvData = this.users.slice(0, 100).map(u => [
      u.username,
      u.email,
      u.role,
      u.level,
      u.balance,
      u.isActive ? 'Active' : 'Inactive',
      new Date(u.createdAt).toLocaleDateString()
    ]);

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-report-${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    Swal.fire('Success', 'Report exported successfully', 'success');
  }

  exportAsPDF(): void {
    // Create printable version
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Admin Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #667eea; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background: #667eea; color: white; padding: 12px; text-align: left; }
              td { padding: 10px; border-bottom: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <h1>System Administration Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            
            <h3>System Overview</h3>
            <p>Total Users: ${this.totalUsers}</p>
            <p>Total Balance: $${this.totalBalance.toLocaleString()}</p>
            <p>Active Users: ${this.activeUsers}</p>
            <p>Total Transactions: ${this.totalTransactions}</p>
            
            <h3>Recent Users</h3>
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.users.slice(0, 20).map(u => `
                  <tr>
                    <td>${u.username}</td>
                    <td>${u.email}</td>
                    <td>${u.role}</td>
                    <td>$${u.balance.toLocaleString()}</td>
                    <td>${u.isActive ? 'Active' : 'Inactive'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }

  // Utility Methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num || 0);
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'owner': return 'bg-danger';
      case 'admin': return 'bg-warning text-dark';
      case 'user': return 'bg-info';
      default: return 'bg-secondary';
    }
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'bg-success' : 'bg-secondary';
  }

  getTransactionBadgeClass(type: string): string {
    switch (type) {
      case 'credit': return 'bg-success';
      case 'debit': return 'bg-danger';
      case 'recharge': return 'bg-warning text-dark';
      case 'commission': return 'bg-info';
      default: return 'bg-secondary';
    }
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'success': return 'bi-check-circle-fill text-success';
      case 'warning': return 'bi-exclamation-triangle-fill text-warning';
      case 'danger': return 'bi-x-circle-fill text-danger';
      case 'info': return 'bi-info-circle-fill text-info';
      default: return 'bi-bell-fill text-secondary';
    }
  }

  markAlertAsRead(alert: any): void {
    alert.read = true;
  }

  clearAllAlerts(): void {
    this.alerts = [];
    this.showAlerts = false;
  }

  refreshData(): void {
    this.loadDashboardData();
    this.loadCharts();

    setTimeout(() => {
      Swal.fire({
        icon: 'success',
        title: 'Refreshed',
        text: 'Dashboard data has been updated',
        timer: 1500,
        showConfirmButton: false
      });
    }, 1000);
  }
}