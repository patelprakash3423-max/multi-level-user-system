import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  canActivate(): boolean {
    const isAuth = this.authService.getCurrentUserValue();

    console.log('AuthGuard check:', isAuth);

    if (isAuth) return true;

    this.router.navigate(['/login']);
    return false;
  }

}