import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BalanceService } from '../../services/balance.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Transaction, BalanceStatement } from '../../models/transaction.model';
import { User } from '../../models/user.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-balance-statement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './balance-statement.html',
  styleUrl: './balance-statement.scss',
})
export class BalanceStatementComponent implements OnInit {
  // Data
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  currentUser: User | null = null;

  // State
  isLoading = true;
  isExporting = false;

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  totalPages: number = 1;

  // Filters
  dateRange: 'today' | 'week' | 'month' | 'year' | 'custom' | 'all' = 'all';
  transactionType: 'all' | 'credit' | 'debit' | 'recharge' | 'commission' = 'all';
  searchTerm: string = '';
  sortBy: 'date' | 'amount' | 'type' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Custom Date Range
  startDate: string = '';
  endDate: string = '';
  showDatePicker: boolean = false;

  // Summary
  totalCredits: number = 0;
  totalDebits: number = 0;
  totalRecharges: number = 0;
  totalCommissions: number = 0;
  netBalance: number = 0;
  openingBalance: number = 0;
  closingBalance: number = 0;

  // Chart Data
  chartData: any = null;

  // Selected Transaction
  selectedTransaction: Transaction | null = null;
  showTransactionDetails: boolean = false;

    constructor(
    private balanceService: BalanceService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private cdr: ChangeDetectorRef // ✅ Add ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadTransactions();
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  loadTransactions(): void {
    this.isLoading = true;
    this.cdr.detectChanges(); // ✅ Force change detection

    const params = {
      page: this.currentPage,
      limit: this.itemsPerPage,
      type: this.transactionType !== 'all' ? this.transactionType : undefined
    };

    console.log('Loading transactions with params:', params); // ✅ Debug log

    this.balanceService.getStatement(params).subscribe({
      next: (response) => {
        console.log('Statement API response:', response); // ✅ Debug log
        
        this.isLoading = false; // ✅ Set to false FIRST
        
        if (response.success && response.data) {
          this.transactions = response.data.transactions || []; // ✅ Ensure array
          this.totalItems = response.data.pagination?.total || 0;
          this.totalPages = response.data.pagination?.pages || 0;

          // Apply filters
          this.applyFilters();

          // Calculate summaries
          this.calculateSummaries();

          console.log('Transactions loaded:', this.transactions.length);
        } else {
          // Handle unsuccessful response
          this.transactions = [];
          this.filteredTransactions = [];
          this.totalItems = 0;
          this.totalPages = 0;
        }
        
        this.cdr.detectChanges(); // ✅ Force change detection after update
      },
      error: (error) => {
        console.error('Transactions load error:', error); // ✅ Debug log
        
        this.isLoading = false; // ✅ Set to false on error
        this.transactions = [];
        this.filteredTransactions = [];
        this.totalItems = 0;
        this.totalPages = 0;
        
        this.cdr.detectChanges(); // ✅ Force change detection
        
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Transactions',
          text: 'Unable to load your balance statement. Please try again.',
          confirmButtonColor: '#6f42c1'
        });
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.transactions];

    // Filter by type
    if (this.transactionType !== 'all') {
      filtered = filtered.filter(t => t.type === this.transactionType);
    }

    // Filter by date range
    filtered = this.filterByDateRange(filtered);

    // Filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(term) ||
        t.sender?.username?.toLowerCase().includes(term) ||
        t.receiver?.username?.toLowerCase().includes(term) ||
        t.amount.toString().includes(term)
      );
    }

    // Apply sorting
    filtered = this.sortTransactions(filtered);

    this.filteredTransactions = filtered;
    this.totalItems = filtered.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    // ✅ Reset to page 1 only if current page exceeds total pages
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }
  }

  filterByDateRange(transactions: Transaction[]): Transaction[] {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (this.dateRange) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        start = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        start = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case 'custom':
        if (this.startDate && this.endDate) {
          start = new Date(this.startDate);
          end = new Date(this.endDate);
          end.setHours(23, 59, 59, 999);
        } else {
          return transactions;
        }
        break;
      default:
        return transactions;
    }

    return transactions.filter(t => {
      const date = new Date(t.createdAt);
      return date >= start && date <= end;
    });
  }

  sortTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.sort((a, b) => {
      let comparison = 0;

      switch (this.sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  calculateSummaries(): void {
    this.totalCredits = this.transactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalDebits = this.transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalRecharges = this.transactions
      .filter(t => t.type === 'recharge')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalCommissions = this.transactions
      .filter(t => t.type === 'commission')
      .reduce((sum, t) => sum + (t.commissionEarned || 0), 0);

    // Get opening and closing balance
    if (this.transactions.length > 0) {
      const sorted = [...this.transactions].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      this.openingBalance = sorted[0]?.balanceBefore || 0;
      this.closingBalance = sorted[sorted.length - 1]?.balanceAfter || 0;
      this.netBalance = this.closingBalance - this.openingBalance;
    }
  }

  // Pagination
  changePage(page: number): void {
    this.currentPage = page;
    this.loadTransactions();
  }

  // Date Range
  setDateRange(range: 'today' | 'week' | 'month' | 'year' | 'custom' | 'all'): void {
    this.dateRange = range;
    this.showDatePicker = range === 'custom';
    if (range !== 'custom') {
      this.startDate = '';
      this.endDate = '';
    }
    this.applyFilters();
  }

  applyCustomDateRange(): void {
    if (this.startDate && this.endDate) {
      this.applyFilters();
    }
  }

  // Clear Filters
  clearFilters(): void {
    this.transactionType = 'all';
    this.dateRange = 'all';
    this.searchTerm = '';
    this.sortBy = 'date';
    this.sortOrder = 'desc';
    this.startDate = '';
    this.endDate = '';
    this.showDatePicker = false;
    this.applyFilters();
  }

  // View Transaction Details
  viewTransactionDetails(transaction: Transaction): void {
    this.selectedTransaction = transaction;
    this.showTransactionDetails = true;
  }

  closeTransactionDetails(): void {
    this.showTransactionDetails = false;
    this.selectedTransaction = null;
  }

  // Export Functions
  exportAsCSV(): void {
    this.isExporting = true;

    const headers = ['Date', 'Type', 'Amount', 'From/To', 'Description', 'Balance Before', 'Balance After', 'Status'];
    const csvData = this.filteredTransactions.map(t => [
      new Date(t.createdAt).toLocaleString(),
      t.type.toUpperCase(),
      t.amount,
      t.type === 'credit' ? t.sender?.username : t.receiver?.username,
      t.description || '-',
      t.balanceBefore,
      t.balanceAfter,
      t.status
    ]);

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    this.isExporting = false;

    Swal.fire({
      icon: 'success',
      title: 'Export Successful',
      text: `${this.filteredTransactions.length} transactions exported to CSV`,
      timer: 2000,
      showConfirmButton: false
    });
  }

  exportAsPDF(): void {
    this.isExporting = true;

    // Create printable HTML
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Balance Statement</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #333; }
              .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
              table { width: 100%; border-collapse: collapse; }
              th { background: #667eea; color: white; padding: 12px; text-align: left; }
              td { padding: 10px; border-bottom: 1px solid #ddd; }
              .credit { color: #28a745; }
              .debit { color: #dc3545; }
            </style>
          </head>
          <body>
            <h1>Balance Statement</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            
            <div class="summary">
              <h3>Summary</h3>
              <p>Total Credits: $${this.totalCredits.toFixed(2)}</p>
              <p>Total Debits: $${this.totalDebits.toFixed(2)}</p>
              <p>Net Balance: $${this.netBalance.toFixed(2)}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>From/To</th>
                  <th>Description</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredTransactions.map(t => `
                  <tr>
                    <td>${new Date(t.createdAt).toLocaleString()}</td>
                    <td>${t.type.toUpperCase()}</td>
                    <td class="${t.type === 'credit' || t.type === 'recharge' ? 'credit' : 'debit'}">
                      ${t.type === 'credit' || t.type === 'recharge' ? '+' : '-'}$${t.amount.toFixed(2)}
                    </td>
                    <td>${t.type === 'credit' ? t.sender?.username : t.receiver?.username || 'Self'}</td>
                    <td>${t.description || '-'}</td>
                    <td>$${t.balanceAfter.toFixed(2)}</td>
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

    this.isExporting = false;
  }

  // Helper Methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  formatDate(date?: Date | string): string {
    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }


  formatDateTime(date: Date | string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getTransactionIcon(type: string): string {
    switch (type) {
      case 'credit': return 'bi-arrow-down-circle-fill';
      case 'debit': return 'bi-arrow-up-circle-fill';
      case 'recharge': return 'bi-cash-stack';
      case 'commission': return 'bi-graph-up-arrow';
      default: return 'bi-arrow-left-right';
    }
  }

  getTransactionClass(type: string): string {
    switch (type) {
      case 'credit': return 'credit';
      case 'debit': return 'debit';
      case 'recharge': return 'recharge';
      case 'commission': return 'commission';
      default: return '';
    }
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

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'completed': return 'bg-success';
      case 'pending': return 'bg-warning text-dark';
      case 'failed': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  getCounterparty(transaction: Transaction): string {
    if (transaction.type === 'credit') {
      return transaction.sender?.username || 'Unknown';
    } else if (transaction.type === 'debit') {
      return transaction.receiver?.username || 'Unknown';
    } else if (transaction.type === 'recharge') {
      return 'Self Recharge';
    } else if (transaction.type === 'commission') {
      return 'Commission';
    }
    return '-';
  }

  getAmountWithSign(transaction: Transaction): { sign: string, amount: string, class: string } {
    const amount = this.formatCurrency(transaction.amount);

    if (transaction.type === 'credit' || transaction.type === 'recharge' || transaction.type === 'commission') {
      return { sign: '+', amount, class: 'text-success' };
    } else {
      return { sign: '-', amount, class: 'text-danger' };
    }
  }

  getBalanceChange(transaction: Transaction): string {
    const change = transaction.balanceAfter - transaction.balanceBefore;
    return this.formatCurrency(Math.abs(change));
  }

  // Navigation
  viewUserProfile(userId: string): void {
    this.router.navigate(['/profile', userId]);
  }

  viewTransactionReceipt(transaction: Transaction): void {
    // This would open a receipt modal or navigate to receipt page
    console.log('View receipt:', transaction._id);
  }

  // Print Statement
  printStatement(): void {
    window.print();
  }

  // Refresh
  refresh(): void {
    this.loadTransactions();
  }

  // Page change helper
  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  getTransactionCount(type: string): number {
    return this.transactions.filter(t => t.type === type).length;
  }

}