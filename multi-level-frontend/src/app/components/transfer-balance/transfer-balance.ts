import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BalanceService } from '../../services/balance.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { Transaction } from '../../models/transaction.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-transfer-balance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './transfer-balance.html',
  styleUrl: './transfer-balance.scss',
})

export class TransferBalance implements OnInit {
  transferForm: FormGroup;
  directDownline: User[] = [];
  filteredDownline: User[] = [];
  currentBalance: number = 0;
  isLoading = false;
  loadingUsers = false;
  currentUser: User | null = null;
  searchTerm: string = '';
  selectedUser: User | null = null;
  recentTransactions: Transaction[] = [];
  maxAmount: number = 0;

  totalTransferredToday: number = 0;
  transferCountToday: number = 0;
  dailyLimit: number = 10000;
  transactionLimit: number = 5000;

  // ✅ LOADING STATES
  balanceLoaded = false;
  transactionsLoaded = false;
  downlineLoaded = false;

  // ✅ QUICK AMOUNTS
  quickAmounts: number[] = [100, 500, 1000, 5000];

  constructor(
    private fb: FormBuilder,
    private balanceService: BalanceService,
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef // ✅ IMPORTANT
  ) {
    this.transferForm = this.fb.group({
      receiverId: ['', Validators.required],
      amount: ['', [
        Validators.required,
        Validators.min(1),
        Validators.max(this.maxAmount),
        Validators.pattern('^[0-9]*$')
      ]],
      description: ['', [
        Validators.maxLength(100),
        Validators.pattern('^[a-zA-Z0-9 .,!?-]*$')
      ]]
    });
  }

  ngOnInit(): void {
    this.loadInitialData();

    // ✅ WATCH FOR FORM CHANGES
    this.transferForm.get('receiverId')?.valueChanges.subscribe(receiverId => {
      this.selectedUser = this.directDownline.find(u => u._id === receiverId) || null;
      this.updateMaxAmount();
      this.cdr.detectChanges();
    });

    this.transferForm.get('amount')?.valueChanges.subscribe(amount => {
      this.updateMaxAmount();
      this.cdr.detectChanges();
    });
  }

  loadInitialData(): void {
    this.loadCurrentUser();
    this.loadCurrentBalance();
    this.loadDirectDownline();
    this.loadRecentTransactions();
    this.loadTodayStats();
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.cdr.detectChanges();
    });
  }

  // ✅ FIXED - CURRENT BALANCE
  loadCurrentBalance(): void {
    this.balanceService.getBalance().subscribe({
      next: (response) => {
        console.log('💰 Balance API Response:', response);

        if (response.success) {
          // ✅ SAFE DATA ASSIGNMENT
          if (response.data && typeof response.data === 'object') {
            this.currentBalance = response.data.balance || 0;
          } else if (typeof response.data === 'number') {
            this.currentBalance = response.data;
          } else {
            this.currentBalance = 0;
          }

          this.maxAmount = Math.min(this.currentBalance, this.transactionLimit);
          this.updateMaxAmount();
          this.balanceLoaded = true;

          // ✅ FORCE UI UPDATE
          this.cdr.detectChanges();
          console.log('✅ Balance Updated in UI:', this.currentBalance);
        }
      },
      error: (error) => {
        console.error('❌ Balance Error:', error);
        this.currentBalance = 0;
        this.balanceLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ FIXED - DIRECT DOWNLINE
  loadDirectDownline(): void {
    this.loadingUsers = true;
    this.userService.getDirectDownline().subscribe({
      next: (response) => {
        this.loadingUsers = false;
        console.log('👥 Downline API Response:', response);

        if (response.success && response.data) {
          // ✅ SAFE DATA ASSIGNMENT
          this.directDownline = Array.isArray(response.data) ? response.data : [];
          this.filteredDownline = [...this.directDownline];
          this.downlineLoaded = true;

          console.log('✅ Downline Users:', this.directDownline.length);
          console.log('📋 Downline List:', this.directDownline);

          // Auto-select if only one user
          if (this.directDownline.length === 1) {
            this.transferForm.patchValue({ receiverId: this.directDownline[0]._id });
          }

          // ✅ FORCE UI UPDATE
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        this.loadingUsers = false;
        this.downlineLoaded = true;
        console.error('❌ Downline Error:', error);
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ FIXED - RECENT TRANSACTIONS
  loadRecentTransactions(): void {
    this.balanceService.getTransferHistory('sent').subscribe({
      next: (response) => {
        console.log('📊 Transactions API Response:', response);

        // ✅ Correct path: response.data.transactions
        if (response?.success && response.data?.transactions) {
          this.recentTransactions = response.data.transactions.slice(0, 5);
        } else {
          this.recentTransactions = [];
        }

        this.transactionsLoaded = true;

        // ✅ Force UI refresh
        this.cdr.detectChanges();

        console.log('✅ Recent Transactions:', this.recentTransactions.length);
      },
      error: (error) => {
        console.error('❌ Transactions Error:', error);
        this.recentTransactions = [];
        this.transactionsLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }



  loadTodayStats(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.balanceService.getTransferHistory('sent').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          let transactions: Transaction[] = [];

          if (response.data.transactions) {
            transactions = response.data.transactions;
          } else if (Array.isArray(response.data)) {
            transactions = response.data;
          }

          const todayTransactions = transactions.filter(t =>
            new Date(t.createdAt) >= today
          );

          this.totalTransferredToday = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
          this.transferCountToday = todayTransactions.length;

          this.cdr.detectChanges();
          console.log('✅ Today Stats:', {
            total: this.totalTransferredToday,
            count: this.transferCountToday
          });
        }
      },
      error: (error) => {
        console.error('❌ Today Stats Error:', error);
      }
    });
  }

  updateMaxAmount(): void {
    const max = Math.min(this.currentBalance, this.transactionLimit);
    this.transferForm.get('amount')?.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(max),
      Validators.pattern('^[0-9]*$')
    ]);
    this.transferForm.get('amount')?.updateValueAndValidity();
  }

  searchDownline(): void {
    if (!this.searchTerm.trim()) {
      this.filteredDownline = [...this.directDownline];
      this.cdr.detectChanges();
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredDownline = this.directDownline.filter(user =>
      user.username.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
    );
    this.cdr.detectChanges();
  }

  selectUser(user: User): void {
    this.transferForm.patchValue({ receiverId: user._id });
    this.selectedUser = user;
    this.searchTerm = '';
    this.filteredDownline = [...this.directDownline];
    this.cdr.detectChanges();
  }

  setQuickAmount(amount: number): void {
    this.transferForm.patchValue({ amount });
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    // ... (your existing onSubmit code)
  }

  showTransferSuccess(): void {
    // ... (your existing showTransferSuccess code)
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  formatDate(date: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getProgressPercentage(): number {
    return this.dailyLimit > 0 ? (this.totalTransferredToday / this.dailyLimit) * 100 : 0;
  }

  getRemainingDailyLimit(): number {
    return Math.max(0, this.dailyLimit - this.totalTransferredToday);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.transferForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getErrorMessage(fieldName: string): string {
    const field = this.transferForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    const errors = field.errors;
    if (errors['required']) return `${fieldName} is required`;
    if (errors['min']) return `Minimum amount is ${this.formatCurrency(1)}`;
    if (errors['max']) return `Maximum amount is ${this.formatCurrency(this.maxAmount)}`;
    if (errors['pattern']) return 'Please enter a valid number';

    return 'Invalid input';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  get hasDownline(): boolean {
    return this.directDownline.length > 0;
  }

  get hasSufficientBalance(): boolean {
    return this.currentBalance > 0;
  }

  get balanceStatusColor(): string {
    if (this.currentBalance <= 0) return 'danger';
    if (this.currentBalance < 1000) return 'warning';
    return 'success';
  }

  get balanceStatusText(): string {
    if (this.currentBalance <= 0) return 'No Balance';
    if (this.currentBalance < 1000) return 'Low Balance';
    return 'Good Balance';
  }
}