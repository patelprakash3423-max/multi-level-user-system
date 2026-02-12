import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BalanceService } from '../../services/balance.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-recharge',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './recharge.html',
  styleUrl: './recharge.scss',
})
export class Recharge implements OnInit {
  rechargeForm: FormGroup;
  currentUser: User | null = null;
  isLoading = false;
  currentBalance: number = 0;

  // Quick recharge amounts
  quickAmounts: number[] = [1000, 5000, 10000, 50000, 100000];

  constructor(
    private fb: FormBuilder,
    private balanceService: BalanceService,
    private authService: AuthService,
    private router: Router
  ) {
    this.rechargeForm = this.fb.group({
      amount: ['', [
        Validators.required,
        Validators.min(100),
        Validators.max(1000000),
        Validators.pattern('^[0-9]*$')
      ]]
    });
  }

  ngOnInit(): void {
    this.checkOwnerAccess();
    this.loadCurrentUser();
    this.loadCurrentBalance();
  }

  // ✅ Sirf owner check karo
  checkOwnerAccess(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;

      if (!user || user.role !== 'owner') {
        Swal.fire({
          icon: 'error',
          title: 'Access Denied',
          text: 'Sirf owner hi self recharge kar sakta hai!',
          confirmButtonColor: '#dc3545'
        }).then(() => {
          this.router.navigate(['/dashboard']);
        });
      }
    });
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  loadCurrentBalance(): void {
    this.balanceService.getBalance().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentBalance = response.data.balance;
        }
      },
      error: (error) => {
        console.error('Balance load error:', error);
      }
    });
  }

  // ✅ Quick amount set karo
  setQuickAmount(amount: number): void {
    this.rechargeForm.patchValue({ amount });
  }

  // ✅ Submit recharge
  onSubmit(): void {
    if (this.rechargeForm.invalid) {
      this.markFormGroupTouched(this.rechargeForm);
      return;
    }

    const amount = this.rechargeForm.value.amount;

    Swal.fire({
      title: 'Confirm Recharge',
      html: `
        <div class="text-center">
          <p class="mb-2">Kya aap ₹${amount.toLocaleString()} recharge karna chahte hain?</p>
          <p class="text-muted small">Aapka current balance: ₹${this.currentBalance.toLocaleString()}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Haan, Recharge karo',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processRecharge(amount);
      }
    });
  }

  private processRecharge(amount: number): void {
    this.isLoading = true;

    this.balanceService.recharge(amount).subscribe({
      next: (response) => {
        this.isLoading = false;

        if (response.success) {
          Swal.fire({
            icon: 'success',
            title: 'Recharge Successful!',
            html: `
              <div class="text-center">
                <i class="bi bi-check-circle-fill text-success" style="font-size: 48px;"></i>
                <h3 class="mt-3">₹${amount.toLocaleString()}</h3>
                <p class="mb-0">Aapka balance successfully recharge ho gaya!</p>
              </div>
            `,
            timer: 3000,
            showConfirmButton: false
          }).then(() => {
            this.router.navigate(['/dashboard']);
          });

          this.rechargeForm.reset();
        } else {
          Swal.fire('Error', response.message || 'Recharge failed', 'error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Recharge error:', error);

        let errorMessage = 'Recharge failed. Please try again.';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }

        Swal.fire('Error', errorMessage, 'error');
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getErrorMessage(): string {
    const control = this.rechargeForm.get('amount');
    if (!control || !control.errors || !control.touched) return '';

    if (control.errors['required']) return 'Amount required hai';
    if (control.errors['min']) return 'Minimum ₹100 recharge karo';
    if (control.errors['max']) return 'Maximum ₹10,00,000 recharge karo';
    if (control.errors['pattern']) return 'Sirf numbers enter karo';

    return 'Invalid amount';
  }
}