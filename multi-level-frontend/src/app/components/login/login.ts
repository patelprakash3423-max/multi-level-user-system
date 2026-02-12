import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true, 
  imports: [CommonModule, ReactiveFormsModule,RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit { // Fixed class name
  loginForm: FormGroup;
  captchaData: any = null;
  captchaImage: string = '';
  isLoading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      captchaText: ['', Validators.required],
      sessionId: ['']
    });
  }

  ngOnInit(): void {
    // Check if already logged in
    if (this.authService.isLoggedIn()) {
      console.log('User already logged in, redirecting to dashboard');
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadCaptcha();
  }

  loadCaptcha(): void {
    this.authService.getCaptcha().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.captchaData = response.data;
          this.captchaImage = response.data.captchaImage;
          this.loginForm.patchValue({ sessionId: response.data.sessionId });
        }
      },
      error: (error) => {
        console.error('CAPTCHA error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load CAPTCHA',
          timer: 3000,
          showConfirmButton: false
        });
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading = true;
    
    console.log('Login attempt with:', this.loginForm.value.email);
    
    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        // IMPORTANT: Set isLoading to false for BOTH success and failure cases
        this.isLoading = false;
        console.log('Login response:', response);
        
        if (response.success) {
          Swal.fire({
            icon: 'success',
            title: 'Login Successful!',
            text: 'Welcome back!',
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            console.log('Navigating to dashboard...');
            
            // Force navigation with multiple attempts
            this.router.navigate(['/dashboard']).then(success => {
              if (success) {
                console.log('Navigation successful');
              } else {
                console.log('Navigation failed, trying alternative...');
                window.location.href = '/dashboard';
              }
            });
          });
        } else {
          // Handle unsuccessful login (like invalid CAPTCHA)
          let errorMessage = response.message || 'Login failed';
          
          // Show specific message for invalid CAPTCHA
          if (errorMessage.includes('CAPTCHA')) {
            Swal.fire({
              icon: 'warning',
              title: 'Invalid CAPTCHA',
              text: errorMessage,
              timer: 2000,
              showConfirmButton: false
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Login Failed',
              text: errorMessage,
              timer: 2000,
              showConfirmButton: false
            });
          }
          
          // Refresh CAPTCHA on failure
          this.refreshCaptcha();
        }
      },
      error: (error) => {
        // Handle HTTP errors
        this.isLoading = false;
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed. Please try again.';
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 401) {
          errorMessage = 'Invalid email or password';
        } else if (error.status === 403) {
          errorMessage = 'Your account is deactivated';
        } else if (error.status === 0) {
          errorMessage = 'Cannot connect to server. Please check if backend is running.';
        }
        
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage,
          timer: 3000,
          showConfirmButton: false
        });
        
        this.refreshCaptcha();
      },
      // Add complete callback to ensure isLoading is always set to false
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  refreshCaptcha(): void {
    // Clear the captcha field and load new one
    this.loginForm.patchValue({ 
      captchaText: '', 
      sessionId: '' 
    });
    this.loadCaptcha();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  // Helper method to get error message
  getErrorMessage(fieldName: string): string {
    const control = this.loginForm.get(fieldName);
    if (!control || !control.errors || !control.touched) return '';
    
    const errors = control.errors;
    
    if (errors['required']) return `${fieldName} is required`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['minlength']) {
      const requiredLength = errors['minlength'].requiredLength;
      return `Password must be at least ${requiredLength} characters`;
    }
    
    return 'Invalid input';
  }
}