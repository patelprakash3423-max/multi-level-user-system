import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-create-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-user.html',
  styleUrl: './create-user.scss',
})
export class CreateUser implements OnInit {
  createUserForm: FormGroup;
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;
  currentUser: User | null = null;

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

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {
    this.createUserForm = this.fb.group({
      username: ['', [
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
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')
      ]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validator: this.passwordMatchValidator
    });

    // Watch password changes for strength meter
    this.createUserForm.get('password')?.valueChanges.subscribe(password => {
      this.checkPasswordStrength(password);
    });
  }

  ngOnInit(): void {
    // Get current user
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Check if user can create next level users
    this.checkCreatePermission();
  }

  // Custom validator to check if passwords match
  passwordMatchValidator(form: FormGroup): ValidationErrors | null {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ ...form.get('confirmPassword')?.errors, passwordMismatch: true });
      return { passwordMismatch: true };
    }

    // Clear passwordMismatch error if passwords match
    if (form.get('confirmPassword')?.errors?.['passwordMismatch']) {
      const errors = { ...form.get('confirmPassword')?.errors };
      delete errors['passwordMismatch'];
      form.get('confirmPassword')?.setErrors(Object.keys(errors).length ? errors : null);
    }

    return null;
  }

  // Check password strength
  checkPasswordStrength(password: string): void {
    this.passwordStrength = {
      hasLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[@$!%*?&]/.test(password),
      score: 0
    };

    // Calculate score
    let score = 0;
    if (this.passwordStrength.hasLength) score += 1;
    if (this.passwordStrength.hasUpperCase) score += 1;
    if (this.passwordStrength.hasLowerCase) score += 1;
    if (this.passwordStrength.hasNumber) score += 1;
    if (this.passwordStrength.hasSpecialChar) score += 1;

    this.passwordStrength.score = score;
  }

  // Get password strength label
  getPasswordStrengthLabel(): string {
    const score = this.passwordStrength.score;
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Fair';
    if (score <= 4) return 'Good';
    return 'Strong';
  }

  // Get password strength color
  getPasswordStrengthColor(): string {
    const score = this.passwordStrength.score;
    if (score <= 2) return 'bg-danger';
    if (score <= 3) return 'bg-warning';
    if (score <= 4) return 'bg-info';
    return 'bg-success';
  }

  // Check if user can create next level users
  checkCreatePermission(): void {
    if (!this.currentUser) {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You must be logged in to create users',
        timer: 3000
      }).then(() => {
        this.router.navigate(['/login']);
      });
      return;
    }

    // Check role-based permissions
    if (this.currentUser.role === 'user') {
      // Regular users can create next level users
      return;
    } else if (this.currentUser.role === 'admin') {
      // Admins can create level 1 users
      return;
    } else if (this.currentUser.role === 'owner') {
      // Owner can create admins and users
      return;
    }
  }

  // Generate username suggestion from email
  suggestUsername(): void {
    const email = this.createUserForm.get('email')?.value;
    const currentUsername = this.createUserForm.get('username')?.value;

    if (email && !currentUsername) {
      const suggestedName = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      if (suggestedName) {
        this.createUserForm.patchValue({ username: suggestedName });
      }
    }
  }

  onSubmit(): void {
    if (this.createUserForm.invalid) {
      this.markFormGroupTouched(this.createUserForm);

      // Show specific error messages
      if (this.createUserForm.get('password')?.errors?.['pattern']) {
        Swal.fire({
          icon: 'warning',
          title: 'Password Requirements',
          html: `
            <div class="text-left">
              <p>Password must contain:</p>
              <ul class="text-left">
                <li>At least 8 characters</li>
                <li>One uppercase letter</li>
                <li>One lowercase letter</li>
                <li>One number</li>
                <li>One special character (@$!%*?&)</li>
              </ul>
            </div>
          `,
          confirmButtonText: 'Got it'
        });
      }
      return;
    }

    this.isLoading = true;

    const userData = {
      username: this.createUserForm.value.username,
      email: this.createUserForm.value.email,
      password: this.createUserForm.value.password
    };

    console.log('Creating user:', userData.email);

    this.userService.createUser(userData).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Create user response:', response);

        if (response.success) {
          Swal.fire({
            icon: 'success',
            title: 'User Created Successfully!',
            html: `
              <div class="text-center">
                <i class="bi bi-person-check-fill text-success display-4"></i>
                <p class="mt-3 mb-2"><strong>${this.createUserForm.value.username}</strong> has been added to your downline.</p>
                <p class="small text-muted">They are now at Level ${(this.currentUser?.level || 0) + 1}</p>
              </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'Continue',
            confirmButtonColor: '#28a745',
            showCancelButton: true,
            cancelButtonText: 'Create Another',
            cancelButtonColor: '#6c757d'
          }).then((result) => {
            if (result.isConfirmed) {
              this.router.navigate(['/downline']);
            } else if (result.dismiss === Swal.DismissReason.cancel) {
              // Reset form for another user
              this.createUserForm.reset();
              // Clear password strength
              this.passwordStrength = {
                score: 0,
                hasLength: false,
                hasUpperCase: false,
                hasLowerCase: false,
                hasNumber: false,
                hasSpecialChar: false
              };
            }
          });
        } else {
          Swal.fire('Error', response.message || 'Failed to create user', 'error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Create user error:', error);

        let errorMessage = 'Failed to create user. Please try again.';

        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 400) {
          errorMessage = 'Invalid user data. Please check your input.';
        } else if (error.status === 409) {
          errorMessage = 'User with this email or username already exists.';
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to create users.';
        } else if (error.status === 0) {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        }

        Swal.fire({
          icon: 'error',
          title: 'Creation Failed',
          text: errorMessage,
          footer: '<a href="/downline" class="text-decoration-none">View your downline</a>'
        });
      }
    });
  }

  // Toggle password visibility
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Mark all form controls as touched
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  // Get field error message
  getErrorMessage(controlName: string): string {
    const control = this.createUserForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';

    const errors = control.errors;

    if (errors['required']) return `${this.formatFieldName(controlName)} is required`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['minlength']) {
      const requiredLength = errors['minlength'].requiredLength;
      return `${this.formatFieldName(controlName)} must be at least ${requiredLength} characters`;
    }
    if (errors['maxlength']) {
      const requiredLength = errors['maxlength'].requiredLength;
      return `${this.formatFieldName(controlName)} cannot exceed ${requiredLength} characters`;
    }
    if (errors['pattern']) {
      if (controlName === 'username') {
        return 'Username can only contain letters, numbers, and underscores';
      }
      if (controlName === 'password') {
        return 'Password must contain uppercase, lowercase, number, and special character';
      }
    }
    if (errors['passwordMismatch']) return 'Passwords do not match';

    return 'Invalid input';
  }

  // Format field name for display
  formatFieldName(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1');
  }

  // Get user's next level
  getNextLevel(): number {
    return (this.currentUser?.level || 0) + 1;
  }

  // Get remaining balance for display
  getCurrentBalance(): number {
    return this.currentUser?.balance || 0;
  }

  // Format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}