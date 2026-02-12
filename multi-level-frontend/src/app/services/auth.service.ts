import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../environments/environment';
import { ApiResponse, CaptchaResponse } from '../models/api.model';
import { User, LoginRequest, CreateUserRequest } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private cookieService: CookieService
  ) {
    this.checkLoginStatus();
  }

  private checkLoginStatus(): void {
    const token = this.cookieService.get('accessToken');

    if (token) {
      this.getCurrentUser().subscribe();
    } else {
      // cleanup old data
      this.currentUserSubject.next(null);
      localStorage.removeItem('currentUser');
    }
  }


  register(userData: CreateUserRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/auth/register`, userData);
  }

  login(credentials: LoginRequest): Observable<ApiResponse<{ user: any }>> {
    return this.http.post<ApiResponse<{ user: any }>>(
      `${this.apiUrl}/auth/login`,
      credentials,
      { withCredentials: true }
    ).pipe(
      tap(response => {
        if (response.success && response.data?.user) {
          const userData = response.data.user;
          const transformedUser: User = {
            _id: userData.id || userData._id,
            username: userData.username,
            email: userData.email,
            role: userData.role,
            parentId: userData.parentId,
            level: userData.level,
            balance: userData.balance || 0,
            downlineCount: userData.downlineCount || 0,
            isActive: userData.isActive !== undefined ? userData.isActive : true,
            createdAt: userData.createdAt || new Date(),
            lastLogin: userData.lastLogin || new Date()
          };

          console.log('Transformed user:', transformedUser);
          this.currentUserSubject.next(transformedUser);
          localStorage.setItem('currentUser', JSON.stringify(transformedUser));
        }
      })
    );
  }

  logout(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.cookieService.delete('accessToken');
        this.cookieService.delete('refreshToken');
        this.currentUserSubject.next(null);
        localStorage.removeItem('currentUser');
      })
    );
  }

  getCurrentUser(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.apiUrl}/auth/me`, { withCredentials: true }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.currentUserSubject.next(response.data);
          localStorage.setItem('currentUser', JSON.stringify(response.data));
        }
      })
    );
  }

  refreshToken(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/auth/refresh-token`, {}, { withCredentials: true });
  }

  getCaptcha(): Observable<ApiResponse<CaptchaResponse>> {
    return this.http.get<ApiResponse<CaptchaResponse>>(`${this.apiUrl}/auth/captcha`);
  }

isLoggedIn(): boolean {
  return !!this.getCurrentUserValue();
}



  getCurrentUserValue(): User | null {
    const user = this.currentUserSubject.value;
    if (user) return user;
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        this.currentUserSubject.next(parsedUser);
        return parsedUser;
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }

    return null;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUserValue();
    return user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUserValue();
    return roles.includes(user?.role || '');
  }
}