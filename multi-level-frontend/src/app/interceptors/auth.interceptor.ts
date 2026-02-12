import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const clonedReq = req.clone({
    withCredentials: true
  });

  const skipRefresh = ['/auth/login', '/auth/refresh-token', '/auth/captcha'];

  return next(clonedReq).pipe(
    catchError((error: any) => {
      // Only refresh token for 401s NOT in skip list
      if (error.status === 401 && !skipRefresh.some(url => req.url.includes(url))) {
        return authService.refreshToken().pipe(
          switchMap(() => {
            return next(clonedReq);
          }),
          catchError(refreshError => {
            authService.logout().subscribe();
            router.navigate(['/login']);
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
