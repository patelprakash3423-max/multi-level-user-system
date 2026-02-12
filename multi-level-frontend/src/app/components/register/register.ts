import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { AuthGuard } from '../../guards/auth.guard';
import Swal from 'sweetalert2';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-register',
 imports: [CommonModule, ReactiveFormsModule,RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {

registerForm: FormGroup;
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;
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
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private authGuard: AuthGuard
  ) {
    this.registerForm = this.fb.group({
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
      confirmPassword: ['', [Validators.required]],
      agreeTerms: [false, [Validators.requiredTrue]]
    }, {
      validator: this.passwordMatchValidator
    });

    // Watch password changes for strength meter
    this.registerForm.get('password')?.valueChanges.subscribe(password => {
      this.checkPasswordStrength(password);
    });
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

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.markFormGroupTouched(this.registerForm);
      
      // Show specific error messages
      if (this.registerForm.get('agreeTerms')?.invalid) {
        Swal.fire('Error', 'You must agree to the Terms and Conditions', 'warning');
      }
      return;
    }

    this.isLoading = true;
    
    const userData = {
      username: this.registerForm.value.username,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password
    };

    this.authService.register(userData).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          Swal.fire({
            icon: 'success',
            title: 'Registration Successful!',
            html: `
              <div class="text-center">
                <i class="bi bi-check-circle-fill text-success display-4"></i>
                <p class="mt-3">Your account has been created successfully.</p>
                <p class="small text-muted">Please login with your credentials.</p>
              </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'Proceed to Login',
            confirmButtonColor: '#667eea'
          }).then((result) => {
            if (result.isConfirmed) {
              this.router.navigate(['/login']);
            }
          });
          
          // Reset form
          this.registerForm.reset();
        } else {
          Swal.fire('Registration Failed', response.message || 'Unable to create account', 'error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        let errorMessage = 'Registration failed. Please try again.';
        
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 400) {
          errorMessage = 'Invalid data provided. Please check your information.';
        } else if (error.status === 409) {
          errorMessage = 'User with this email or username already exists.';
        }
        
        Swal.fire({
          icon: 'error',
          title: 'Registration Failed',
          text: errorMessage,
          footer: '<a href="/login" class="text-decoration-none">Already have an account? Login</a>'
        });
      }
    });
  }

  // Check if user is logged in and redirect if necessary
  checkAuthAndRedirect(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  // Toggle password visibility
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Generate username suggestions based on email
  suggestUsername(): void {
    const email = this.registerForm.get('email')?.value;
    const currentUsername = this.registerForm.get('username')?.value;
    
    if (email && !currentUsername) {
      const suggestedName = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      if (suggestedName) {
        this.registerForm.patchValue({ username: suggestedName });
      }
    }
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
    const control = this.registerForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';
    
    const errors = control.errors;
    
    if (errors['required']) return `${controlName} is required`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['minlength']) {
      const requiredLength = errors['minlength'].requiredLength;
      return `${controlName} must be at least ${requiredLength} characters`;
    }
    if (errors['maxlength']) {
      const requiredLength = errors['maxlength'].requiredLength;
      return `${controlName} cannot exceed ${requiredLength} characters`;
    }
    if (errors['pattern']) {
      if (controlName === 'username') {
        return 'Username can only contain letters, numbers, and underscores';
      }
      if (controlName === 'password') {
        return 'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character';
      }
    }
    if (errors['passwordMismatch']) return 'Passwords do not match';
    
    return 'Invalid input';
  }

  // Format field name for display
  formatFieldName(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1');
  }
}