import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PaginationParams } from '../models/api.model';
import { User, DownlineUser, CreateUserRequest, DownlineStats } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDownline(level?: number): Observable<ApiResponse<{ downline: DownlineUser[], stats: DownlineStats }>> {
    const params: any = {};
    if (level) params.level = level;
    return this.http.get<ApiResponse<{ downline: DownlineUser[], stats: DownlineStats }>>(
      `${this.apiUrl}/users/downline`,
      { params }
    );
  }

  getDirectDownline(): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/users/downline/direct`);
  }

  getProfile(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.apiUrl}/users/profile`);
  }

  createUser(userData: CreateUserRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/users/create`, userData);
  }

  changeUserPassword(userId: string, newPassword: string): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/users/change-password`, {
      userId,
      newPassword
    });
  }

  searchInDownline(search: string): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/users/search`, {
      params: { search }
    });
  }
}