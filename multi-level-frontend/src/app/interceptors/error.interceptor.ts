import { HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import Swal from 'sweetalert2';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: any) => {
      let errorMessage = 'An error occurred';
      
      if (error.error instanceof ErrorEvent) {
        errorMessage = error.error.message;
      } else {
        errorMessage = error.error?.message || error.statusText;
        
        switch (error.status) {
          case 400:
            errorMessage = error.error?.message || 'Bad request';
            break;
          case 403:
            errorMessage = 'You are not authorized to perform this action';
            break;
          case 404:
            errorMessage = 'Resource not found';
            break;
          case 500:
            errorMessage = 'Internal server error';
            break;
        }
      }

      // Don't show error for 401 (handled by auth interceptor)
      if (error.status !== 401) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage,
          timer: 3000
        });
      }

      return throwError(() => error);
    })
  );
};