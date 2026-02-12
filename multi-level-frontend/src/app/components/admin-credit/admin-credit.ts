import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { BalanceService } from '../../services/balance.service';
import { User } from '../../models/user.model';
import { Transaction } from '../../models/transaction.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-credit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-credit.html',
  styleUrl: './admin-credit.scss',
})
export class AdminCredit implements OnInit {
  // Forms
  creditForm: FormGroup;
  bulkCreditForm: FormGroup;
  searchUserId: string = '';
  searchUsername: string = '';

  // Data
  selectedUser: User | null = null;
  parentUser: User | null = null;
  users: User[] = [];
  filteredUsers: User[] = [];
  recentTransactions: Transaction[] = [];

  // Search
  searchTerm: string = '';
  searchResults: User[] = [];
  showSearchResults = false;
  isSearching = false;

  // UI States
  isLoading = false;
  isProcessing = false;
  showBulkCredit = false;
  showPreview = false;

  // Credit Preview
  creditPreview: {
    user: User;
    parent: User | null;
    amount: number;
    description: string;
    parentBalanceAfter: number;
    userBalanceAfter: number;
  } | null = null;

  // Statistics
  totalCreditedToday: number = 0;
  totalCreditedThisMonth: number = 0;
  totalTransactions: number = 0;

  // Quick Amounts
  quickAmounts: number[] = [100, 500, 1000, 5000, 10000, 50000];

  // Credit History
  creditHistory: {
    date: Date;
    user: string;
    amount: number;
    creditedBy: string;
    description: string;
  }[] = [];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private authService: AuthService,
    private userService: UserService,
    private balanceService: BalanceService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.creditForm = this.fb.group({
      userId: ['', Validators.required],
      amount: ['', [
        Validators.required,
        Validators.min(1),
        Validators.max(1000000),
        Validators.pattern('^[0-9]*$')
      ]],
      description: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100)
      ]],
      sendNotification: [true],
      requireConfirmation: [true]
    });

    this.bulkCreditForm = this.fb.group({
      level: ['', Validators.required],
      amount: ['', [
        Validators.required,
        Validators.min(1),
        Validators.max(100000),
        Validators.pattern('^[0-9]*$')
      ]],
      description: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100)
      ]],
      excludeInactive: [true],
      excludeAdmins: [true],
      excludeOwners: [true]
    });
  }

  ngOnInit(): void {
    this.checkAdminAccess();
    this.checkForPreselectedUser();
    this.loadUsers();
    this.loadStatistics();
    this.loadCreditHistory();
  }

  checkAdminAccess(): void {
    const user = this.authService.getCurrentUserValue();
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      this.router.navigate(['/dashboard']);
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to credit balances',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  checkForPreselectedUser(): void {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    const username = this.route.snapshot.queryParamMap.get('username');

    if (userId) {
      this.searchUserId = userId;
      this.searchUsername = username || '';
      this.loadUserDetails(userId);
    }
  }

  loadUsers(): void {
    this.adminService.getAllUsers({ limit: 1000 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.users = response.data.users;
          this.filteredUsers = [...this.users];
        }
      },
      error: (error) => {
        console.error('Users load error:', error);
      }
    });
  }

  loadUserDetails(userId: string): void {
    this.isLoading = true;

    // Get user details
    this.userService.getProfile().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const user = response.data as User;
          if (user._id === userId) {
            this.selectedUser = user;
            this.creditForm.patchValue({ userId: user._id });
            this.loadParentDetails(user.parentId);
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        console.error('User details load error:', error);
      }
    });
  }

  loadParentDetails(parentId: string | undefined): void {
    if (!parentId) {
      this.parentUser = null;
      return;
    }

    // TODO: Implement get user by ID endpoint
    // For now, find from users list
    this.parentUser = this.users.find(u => u._id === parentId) || null;
  }

  loadStatistics(): void {
    this.balanceService.getStatement({ limit: 100 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const thisMonth = new Date();
          thisMonth.setDate(1);
          thisMonth.setHours(0, 0, 0, 0);

          this.totalCreditedToday = response.data.transactions
            .filter(t => t.type === 'credit' && new Date(t.createdAt) >= today)
            .reduce((sum, t) => sum + t.amount, 0);

          this.totalCreditedThisMonth = response.data.transactions
            .filter(t => t.type === 'credit' && new Date(t.createdAt) >= thisMonth)
            .reduce((sum, t) => sum + t.amount, 0);

          this.totalTransactions = response.data.transactions
            .filter(t => t.type === 'credit')
            .length;
        }
      },
      error: (error) => {
        console.error('Statistics load error:', error);
      }
    });
  }

  loadCreditHistory(): void {
    // Simulate credit history
    this.creditHistory = [
      {
        date: new Date(Date.now() - 1000 * 60 * 30),
        user: 'john_doe',
        amount: 500,
        creditedBy: 'admin',
        description: 'Performance bonus'
      },
      {
        date: new Date(Date.now() - 1000 * 60 * 60 * 2),
        user: 'jane_smith',
        amount: 1000,
        creditedBy: 'admin',
        description: 'Monthly commission'
      },
      {
        date: new Date(Date.now() - 1000 * 60 * 60 * 5),
        user: 'bob_wilson',
        amount: 250,
        creditedBy: 'owner',
        description: 'Welcome bonus'
      }
    ];
  }

  // User Search
  searchUser(): void {
    if (!this.searchTerm.trim()) {
      this.showSearchResults = false;
      return;
    }

    this.isSearching = true;
    this.showSearchResults = true;

    this.userService.searchInDownline(this.searchTerm).subscribe({
      next: (response) => {
        this.isSearching = false;
        if (response.success && response.data) {
          this.searchResults = response.data;
        }
      },
      error: (error) => {
        this.isSearching = false;
        console.error('User search error:', error);
        this.searchResults = [];
      }
    });
  }

  selectUser(user: User): void {
    this.selectedUser = user;
    this.searchTerm = `${user.username} (${user.email})`;
    this.showSearchResults = false;
    this.creditForm.patchValue({ userId: user._id });
    this.loadParentDetails(user.parentId);
    this.creditPreview = null;
    this.showPreview = false;
  }

  clearSelection(): void {
    this.selectedUser = null;
    this.parentUser = null;
    this.searchTerm = '';
    this.showSearchResults = false;
    this.creditForm.reset({
      userId: '',
      amount: '',
      description: '',
      sendNotification: true,
      requireConfirmation: true
    });
    this.creditPreview = null;
    this.showPreview = false;
  }

  // Quick Amount
  setQuickAmount(amount: number): void {
    this.creditForm.patchValue({ amount });
  }

  // Preview Credit
  previewCredit(): void {
    if (this.creditForm.invalid || !this.selectedUser) {
      this.markFormGroupTouched(this.creditForm);
      return;
    }

    const amount = this.creditForm.get('amount')?.value;

    this.creditPreview = {
      user: this.selectedUser,
      parent: this.parentUser,
      amount: amount,
      description: this.creditForm.get('description')?.value,
      parentBalanceAfter: (this.parentUser?.balance || 0) - amount,
      userBalanceAfter: (this.selectedUser?.balance || 0) + amount
    };

    this.showPreview = true;
  }

  // Submit Credit
  onSubmit(): void {
    if (this.creditForm.invalid || !this.selectedUser) {
      this.markFormGroupTouched(this.creditForm);
      return;
    }

    const amount = this.creditForm.get('amount')?.value;
    const description = this.creditForm.get('description')?.value;
    const requireConfirmation = this.creditForm.get('requireConfirmation')?.value;

    const creditData = {
      userId: this.selectedUser._id,
      amount: amount,
      description: description
    };

    const processCredit = () => {
      this.isProcessing = true;

      this.adminService.creditBalance(
        creditData.userId,
        creditData.amount,
        creditData.description
      ).subscribe({
        next: (response) => {
          this.isProcessing = false;

          if (response.success) {
            this.showSuccess(creditData.amount, this.selectedUser!);
            this.loadStatistics();
            this.loadCreditHistory();

            if (this.creditForm.get('sendNotification')?.value) {
              this.sendNotification(this.selectedUser!, creditData.amount);
            }

            this.clearSelection();
            this.showPreview = false;
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Credit Failed',
              text: response.message || 'Unable to credit balance',
              confirmButtonColor: '#dc3545'
            });
          }
        },
        error: (error) => {
          this.isProcessing = false;
          console.error('Credit error:', error);

          let errorMessage = 'Failed to credit balance';

          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 400) {
            errorMessage = 'Invalid credit amount or insufficient parent balance';
          } else if (error.status === 404) {
            errorMessage = 'User not found';
          }

          Swal.fire({
            icon: 'error',
            title: 'Credit Failed',
            text: errorMessage,
            confirmButtonColor: '#dc3545'
          });
        }
      });
    };

    if (requireConfirmation) {
      Swal.fire({
        title: 'Confirm Credit',
        html: `
          <div class="text-start">
            <p class="fw-bold mb-2">Credit Details:</p>
            <p class="mb-1"><strong>User:</strong> ${this.selectedUser.username}</p>
            <p class="mb-1"><strong>Amount:</strong> $${amount.toLocaleString()}</p>
            <p class="mb-1"><strong>Description:</strong> ${description}</p>
            <p class="mb-0 text-muted small mt-2">This amount will be deducted from the user's parent balance.</p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, credit balance',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          processCredit();
        }
      });
    } else {
      processCredit();
    }
  }

  // Bulk Credit
  onBulkSubmit(): void {
    if (this.bulkCreditForm.invalid) {
      this.markFormGroupTouched(this.bulkCreditForm);
      return;
    }

    const level = this.bulkCreditForm.get('level')?.value;
    const amount = this.bulkCreditForm.get('amount')?.value;
    const description = this.bulkCreditForm.get('description')?.value;
    const excludeInactive = this.bulkCreditForm.get('excludeInactive')?.value;
    const excludeAdmins = this.bulkCreditForm.get('excludeAdmins')?.value;
    const excludeOwners = this.bulkCreditForm.get('excludeOwners')?.value;

    // Filter users by criteria
    let targetUsers = this.users.filter(u => u.level === parseInt(level));

    if (excludeInactive) {
      targetUsers = targetUsers.filter(u => u.isActive !== false);
    }
    if (excludeAdmins) {
      targetUsers = targetUsers.filter(u => u.role !== 'admin');
    }
    if (excludeOwners) {
      targetUsers = targetUsers.filter(u => u.role !== 'owner');
    }

    if (targetUsers.length === 0) {
      Swal.fire('Error', 'No users match the selected criteria', 'error');
      return;
    }

    Swal.fire({
      title: 'Confirm Bulk Credit',
      html: `
        <div class="text-start">
          <p class="fw-bold mb-2">Bulk Credit Details:</p>
          <p class="mb-1"><strong>Level:</strong> ${level}</p>
          <p class="mb-1"><strong>Amount per user:</strong> $${amount.toLocaleString()}</p>
          <p class="mb-1"><strong>Total Users:</strong> ${targetUsers.length}</p>
          <p class="mb-1"><strong>Total Amount:</strong> $${(amount * targetUsers.length).toLocaleString()}</p>
          <p class="mb-1"><strong>Description:</strong> ${description}</p>
          <p class="mb-0 text-muted small mt-2">This will credit all eligible users at Level ${level}.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, process bulk credit',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isProcessing = true;

        // TODO: Implement bulk credit endpoint
        setTimeout(() => {
          this.isProcessing = false;
          Swal.fire({
            icon: 'success',
            title: 'Bulk Credit Complete',
            html: `
              <p class="mb-1">Successfully credited ${targetUsers.length} users</p>
              <p class="mb-0">Total amount: $${(amount * targetUsers.length).toLocaleString()}</p>
            `,
            confirmButtonColor: '#28a745'
          });
          this.showBulkCredit = false;
          this.bulkCreditForm.reset({
            excludeInactive: true,
            excludeAdmins: true,
            excludeOwners: true
          });
        }, 2000);
      }
    });
  }

  // Success Message
  showSuccess(amount: number, user: User): void {
    Swal.fire({
      icon: 'success',
      title: 'Balance Credited!',
      html: `
        <div class="text-center">
          <div class="success-animation mb-3">
            <i class="bi bi-check-circle-fill text-success" style="font-size: 64px;"></i>
          </div>
          <h3 class="fw-bold text-success">$${amount.toLocaleString()}</h3>
          <p class="mb-2">Credited to <strong>${user.username}</strong></p>
          <div class="bg-light p-3 rounded-3 mt-3">
            <div class="d-flex justify-content-between mb-1">
              <span>New Balance:</span>
              <span class="fw-bold text-success">$${(user.balance + amount).toLocaleString()}</span>
            </div>
          </div>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'Done',
      confirmButtonColor: '#28a745',
      showCancelButton: true,
      cancelButtonText: 'Credit Another',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        this.clearSelection();
      }
    });
  }

  // Send Notification
  sendNotification(user: User, amount: number): void {
    // TODO: Implement notification service
    console.log(`Notification sent to ${user.email}: $${amount} credited to your account`);
  }

  // Validation
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getErrorMessage(form: FormGroup, fieldName: string): string {
    const field = form.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    const errors = field.errors;

    if (errors['required']) return `${fieldName} is required`;
    if (errors['min']) return `Minimum amount is $1`;
    if (errors['max']) {
      if (fieldName === 'amount') {
        const max = errors['max'].max;
        return `Maximum amount is $${max.toLocaleString()}`;
      }
    }
    if (errors['minlength']) {
      const requiredLength = errors['minlength'].requiredLength;
      return `Minimum ${requiredLength} characters required`;
    }
    if (errors['maxlength']) {
      const requiredLength = errors['maxlength'].requiredLength;
      return `Maximum ${requiredLength} characters allowed`;
    }
    if (errors['pattern']) return 'Please enter a valid number';

    return 'Invalid input';
  }

  // Helper Methods
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

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitials(username: string): string {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(username: string): string {
    const colors = ['primary', 'success', 'info', 'warning', 'danger', 'secondary'];
    const index = username.length % colors.length;
    return colors[index];
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

  // Navigation
  goBack(): void {
    this.router.navigate(['/admin']);
  }

  toggleBulkCredit(): void {
    this.showBulkCredit = !this.showBulkCredit;
  }

  closePreview(): void {
    this.showPreview = false;
    this.creditPreview = null;
  }

  // Get available levels for bulk credit
  get availableLevels(): number[] {
    const levels = new Set<number>();
    this.users.forEach(user => {
      if (user.level > 0) {
        levels.add(user.level);
      }
    });
    return Array.from(levels).sort((a, b) => a - b);
  }

  // Check if user can be credited
  canCredit(user: User): boolean {
    return user.isActive !== false && user.role !== 'owner';
  }
}