import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { BalanceService } from '../../services/balance.service';
import { User, UserProfile } from '../../models/user.model';
import { Transaction } from '../../models/transaction.model';
import Swal from 'sweetalert2';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss',
})
export class UserProfileComponent implements OnInit {
  // User Data
  user: UserProfile | null = null;
  currentUser: User | null = null;
  isOwnProfile: boolean = true;

  // Profile Statistics
  totalTransactions: number = 0;
  totalCredits: number = 0;
  totalDebits: number = 0;
  totalCommissions: number = 0;
  monthlyGrowth: number = 0;

  // Recent Activity
  recentTransactions: Transaction[] = [];

  // Form States
  profileForm: FormGroup;
  passwordForm: FormGroup;
  settingsForm: FormGroup;

  // UI States
  isLoading = true; // ✅ Added back
  isSaving = false;
  activeTab: 'profile' | 'security' | 'activity' | 'settings' = 'profile';
  showChangePassword = false;

  // Password Visibility
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // Password Strength
  passwordStrength: {
    score: number;
    hasLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  } = {
      score: 0,
      hasLength: false,
      hasUpperCase: false,
      hasLowerCase: false,
      hasNumber: false,
      hasSpecialChar: false
    };

  // Edit Mode
  isEditing = false;

  // Join Date
  memberSince: string = '';
  accountAge: string = '';

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private balanceService: BalanceService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef // ✅ Added
  ) {
    this.profileForm = this.fb.group({
      username: [{ value: '', disabled: true }, [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern('^[a-zA-Z0-9_]+$')
      ]],
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.maxLength(50)
      ]],
      firstName: ['', [
        Validators.maxLength(50),
        Validators.pattern('^[a-zA-Z\\s]*$')
      ]],
      lastName: ['', [
        Validators.maxLength(50),
        Validators.pattern('^[a-zA-Z\\s]*$')
      ]],
      phone: ['', [
        Validators.pattern('^[0-9+\-\s]*$'),
        Validators.maxLength(15)
      ]],
      address: ['', Validators.maxLength(200)],
      city: ['', Validators.maxLength(50)],
      country: ['', Validators.maxLength(50)],
      postalCode: ['', Validators.maxLength(10)],
      bio: ['', Validators.maxLength(500)]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')
      ]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validator: this.passwordMatchValidator
    });

    this.settingsForm = this.fb.group({
      emailNotifications: [true],
      transactionAlerts: [true],
      marketingEmails: [false],
      twoFactorAuth: [false],
      autoLogout: ['30'],
      language: ['en'],
      timezone: ['UTC'],
      currency: ['USD']
    });

    // Watch password changes for strength meter
    this.passwordForm.get('newPassword')?.valueChanges.subscribe(password => {
      this.checkPasswordStrength(password);
    });
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadUserProfile();
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.cdr.detectChanges();
    });
  }

  loadUserProfile(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    const userId = this.route.snapshot.paramMap.get('id');

    if (userId) {
      // Viewing another user's profile
      this.isOwnProfile = this.currentUser?._id === userId;
      this.loadUserById(userId);
    } else {
      // Viewing own profile
      this.isOwnProfile = true;
      this.loadOwnProfile();
    }
  }

  loadOwnProfile(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    console.log('Loading profile data...');

    forkJoin({
      profile: this.userService.getProfile(),
      stats: this.balanceService.getStatement({ limit: 1000 }),
      history: this.balanceService.getTransferHistory('all')
    }).subscribe({
      next: (responses) => {
        console.log('Profile data loaded:', responses);
        
        this.isLoading = false; // ✅ Set to false FIRST

        // Profile
        if (responses.profile.success && responses.profile.data) {
          this.user = responses.profile.data as UserProfile;
          this.updateProfileForm();
          this.calculateMembershipDuration();
        }

        // Statistics
        if (responses.stats.success && responses.stats.data) {
          const transactions = responses.stats.data.transactions || [];

          this.totalTransactions = transactions.length;

          this.totalCredits = transactions
            .filter(t => t.type === 'credit' && t.receiver?._id === this.user?._id)
            .reduce((sum, t) => sum + t.amount, 0);

          this.totalDebits = transactions
            .filter(t => t.type === 'debit' && t.sender?._id === this.user?._id)
            .reduce((sum, t) => sum + t.amount, 0);
        }

        // Recent transactions
        if (responses.history.success && responses.history.data) {
          this.recentTransactions = (responses.history.data.transactions || []).slice(0, 5);
        }
        
        this.cdr.detectChanges(); // ✅ Force change detection
      },

      error: (error) => {
        console.error('Profile load error:', error);
        
        this.isLoading = false;
        this.cdr.detectChanges();

        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Profile',
          text: 'Unable to load profile data. Please try again.',
          confirmButtonColor: '#6f42c1'
        });
      }
    });
  }

  loadUserById(userId: string): void {
    // This would need an admin endpoint or public profile endpoint
    // For now, we'll navigate back if not admin
    if (this.currentUser?.role !== 'admin' && this.currentUser?.role !== 'owner') {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.isLoading = false;
    this.cdr.detectChanges();

    // TODO: Implement admin endpoint to get user by ID
    // this.adminService.getUserById(userId).subscribe(...)
  }

  loadUserStatistics(): void {
    this.balanceService.getStatement({ limit: 1000 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const transactions = response.data.transactions || [];

          this.totalTransactions = transactions.length;
          this.totalCredits = transactions
            .filter(t => t.type === 'credit' && t.receiver?._id === this.user?._id)
            .reduce((sum, t) => sum + t.amount, 0);
          this.totalDebits = transactions
            .filter(t => t.type === 'debit' && t.sender?._id === this.user?._id)
            .reduce((sum, t) => sum + t.amount, 0);
          this.totalCommissions = transactions
            .filter(t => t.type === 'commission' && t.receiver?._id === this.user?._id)
            .reduce((sum, t) => sum + (t.commissionEarned || 0), 0);

          // Calculate monthly growth
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);

          const lastMonthTransactions = transactions.filter(t =>
            new Date(t.createdAt) >= lastMonth
          );

          const previousMonth = new Date();
          previousMonth.setMonth(previousMonth.getMonth() - 2);

          const previousMonthTransactions = transactions.filter(t =>
            new Date(t.createdAt) >= previousMonth &&
            new Date(t.createdAt) < lastMonth
          );

          const lastMonthTotal = lastMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
          const previousMonthTotal = previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

          if (previousMonthTotal > 0) {
            this.monthlyGrowth = ((lastMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
          }
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Statistics load error:', error);
        this.cdr.detectChanges();
      }
    });
  }

  loadRecentTransactions(): void {
    this.balanceService.getTransferHistory('all').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.recentTransactions = (response.data.transactions || [])
            .filter(t =>
              t.sender?._id === this.user?._id ||
              t.receiver?._id === this.user?._id
            )
            .slice(0, 5);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Recent transactions load error:', error);
        this.cdr.detectChanges();
      }
    });
  }

  updateProfileForm(): void {
    if (this.user) {
      this.profileForm.patchValue({
        username: this.user.username,
        email: this.user.email,
        // These fields would come from extended user profile
        firstName: this.user.firstName || '',
        lastName: this.user.lastName || '',
        phone: this.user.phone || '',
        address: this.user.address || '',
        city: this.user.city || '',
        country: this.user.country || '',
        postalCode: this.user.postalCode || '',
        bio: this.user.bio || ''
      });
    }
  }

  calculateMembershipDuration(): void {
    if (this.user?.createdAt) {
      const created = new Date(this.user.createdAt);
      const now = new Date();

      this.memberSince = created.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const diffTime = Math.abs(now.getTime() - created.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffYears = Math.floor(diffDays / 365);
      const diffMonths = Math.floor((diffDays % 365) / 30);

      if (diffYears > 0) {
        this.accountAge = `${diffYears} year${diffYears > 1 ? 's' : ''} ${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
      } else if (diffMonths > 0) {
        this.accountAge = `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
      } else {
        this.accountAge = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      }
    }
  }

  // Profile Edit Methods
  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.profileForm.enable();
      this.profileForm.get('username')?.disable(); // Username cannot be changed
    } else {
      this.profileForm.disable();
      this.updateProfileForm(); // Reset form
    }
    this.cdr.detectChanges();
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    const profileData = {
      email: this.profileForm.get('email')?.value,
      firstName: this.profileForm.get('firstName')?.value,
      lastName: this.profileForm.get('lastName')?.value,
      phone: this.profileForm.get('phone')?.value,
      address: this.profileForm.get('address')?.value,
      city: this.profileForm.get('city')?.value,
      country: this.profileForm.get('country')?.value,
      postalCode: this.profileForm.get('postalCode')?.value,
      bio: this.profileForm.get('bio')?.value
    };

    // Simulate API call
    setTimeout(() => {
      this.isSaving = false;
      this.isEditing = false;
      this.profileForm.disable();
      this.cdr.detectChanges();
      Swal.fire('Success', 'Profile updated successfully', 'success');
    }, 1500);
  }

  // Password Methods
  passwordMatchValidator(form: FormGroup): any {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ ...form.get('confirmPassword')?.errors, passwordMismatch: true });
      return { passwordMismatch: true };
    }

    if (form.get('confirmPassword')?.errors?.['passwordMismatch']) {
      const errors = { ...form.get('confirmPassword')?.errors };
      delete errors['passwordMismatch'];
      form.get('confirmPassword')?.setErrors(Object.keys(errors).length ? errors : null);
    }

    return null;
  }

  checkPasswordStrength(password: string): void {
    this.passwordStrength = {
      hasLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[@$!%*?&]/.test(password),
      score: 0
    };

    let score = 0;
    if (this.passwordStrength.hasLength) score += 1;
    if (this.passwordStrength.hasUpperCase) score += 1;
    if (this.passwordStrength.hasLowerCase) score += 1;
    if (this.passwordStrength.hasNumber) score += 1;
    if (this.passwordStrength.hasSpecialChar) score += 1;

    this.passwordStrength.score = score;
  }

  getPasswordStrengthLabel(): string {
    const score = this.passwordStrength.score;
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Fair';
    if (score <= 4) return 'Good';
    return 'Strong';
  }

  getPasswordStrengthColor(): string {
    const score = this.passwordStrength.score;
    if (score <= 2) return 'bg-danger';
    if (score <= 3) return 'bg-warning';
    if (score <= 4) return 'bg-info';
    return 'bg-success';
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    const passwordData = {
      currentPassword: this.passwordForm.get('currentPassword')?.value,
      newPassword: this.passwordForm.get('newPassword')?.value
    };

    this.userService.changeUserPassword(this.user?._id || '', passwordData.newPassword).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.cdr.detectChanges();
        
        if (response.success) {
          Swal.fire({
            icon: 'success',
            title: 'Password Changed',
            text: 'Your password has been updated successfully',
            timer: 2000,
            showConfirmButton: false
          });
          this.showChangePassword = false;
          this.passwordForm.reset();
        } else {
          Swal.fire('Error', response.message || 'Failed to change password', 'error');
        }
      },
      error: (error) => {
        this.isSaving = false;
        this.cdr.detectChanges();
        
        console.error('Password change error:', error);

        let errorMessage = 'Failed to change password';
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 401) {
          errorMessage = 'Current password is incorrect';
        }

        Swal.fire('Error', errorMessage, 'error');
      }
    });
  }

  // Settings Methods
  saveSettings(): void {
    this.isSaving = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.isSaving = false;
      this.cdr.detectChanges();
      Swal.fire('Success', 'Settings saved successfully', 'success');
    }, 1000);
  }

  // Account Actions
  deactivateAccount(): void {
    Swal.fire({
      title: 'Deactivate Account?',
      text: 'You will not be able to login or perform any transactions',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, deactivate',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire(
          'Deactivated',
          'Your account has been deactivated',
          'success'
        ).then(() => {
          this.authService.logout().subscribe();
          this.router.navigate(['/login']);
        });
      }
    });
  }

  // Helper Methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitials(): string {
    if (this.user?.firstName && this.user?.lastName) {
      return `${this.user.firstName[0]}${this.user.lastName[0]}`.toUpperCase();
    }
    return this.user?.username?.substring(0, 2).toUpperCase() || 'U';
  }

  getAvatarColor(): string {
    const colors = ['primary', 'success', 'info', 'warning', 'danger', 'secondary'];
    const index = (this.user?.username?.length || 0) % colors.length;
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

  getTransactionIcon(type: string): string {
    switch (type) {
      case 'credit': return 'bi-arrow-down-circle';
      case 'debit': return 'bi-arrow-up-circle';
      case 'recharge': return 'bi-cash-stack';
      case 'commission': return 'bi-graph-up-arrow';
      default: return 'bi-arrow-left-right';
    }
  }

  getTransactionClass(type: string): string {
    switch (type) {
      case 'credit': return 'text-success';
      case 'debit': return 'text-danger';
      case 'recharge': return 'text-warning';
      case 'commission': return 'text-info';
      default: return 'text-muted';
    }
  }

  getCounterparty(transaction: Transaction): string {
    if (transaction.type === 'credit') {
      return transaction.sender?.username || 'System';
    } else if (transaction.type === 'debit') {
      return transaction.receiver?.username || 'System';
    } else if (transaction.type === 'recharge') {
      return 'Self Recharge';
    } else if (transaction.type === 'commission') {
      return 'Commission';
    }
    return '-';
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  viewTransactionDetails(transaction: Transaction): void {
    console.log('View transaction:', transaction._id);
  }

  // Utility Methods
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getErrorMessage(form: FormGroup, fieldName: string): string {
    const control = form.get(fieldName);
    if (!control || !control.errors || !control.touched) return '';

    const errors = control.errors;

    if (errors['required']) return `${fieldName} is required`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['minlength']) {
      const requiredLength = errors['minlength'].requiredLength;
      return `Minimum ${requiredLength} characters required`;
    }
    if (errors['maxlength']) {
      const requiredLength = errors['maxlength'].requiredLength;
      return `Maximum ${requiredLength} characters allowed`;
    }
    if (errors['pattern']) {
      if (fieldName === 'username') {
        return 'Username can only contain letters, numbers, and underscores';
      }
      if (fieldName === 'phone') {
        return 'Please enter a valid phone number';
      }
      if (fieldName === 'newPassword') {
        return 'Password must contain uppercase, lowercase, number, and special character';
      }
    }
    if (errors['passwordMismatch']) return 'Passwords do not match';

    return 'Invalid input';
  }

  // Toggle Methods
  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Tab Management
  setActiveTab(tab: 'profile' | 'security' | 'activity' | 'settings'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }
}