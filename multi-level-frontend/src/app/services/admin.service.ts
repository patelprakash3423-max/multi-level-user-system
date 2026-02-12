import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PaginationParams, BalanceSummary } from '../models/api.model';
import { User, DownlineUser } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAllUsers(params: PaginationParams): Observable<ApiResponse<{ users: User[], pagination: any }>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<ApiResponse<{ users: User[], pagination: any }>>(
      `${this.apiUrl}/admin/users`,
      { params: httpParams }
    );
  }

  getNextLevelUsers(): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/admin/next-level`);
  }

  getUserDownlineHierarchy(userId: string): Observable<ApiResponse<{ user: User, downline: DownlineUser[] }>> {
    return this.http.get<ApiResponse<{ user: User, downline: DownlineUser[] }>>(
      `${this.apiUrl}/admin/hierarchy/${userId}`
    );
  }

  getBalanceSummary(): Observable<ApiResponse<BalanceSummary>> {
    return this.http.get<ApiResponse<BalanceSummary>>(`${this.apiUrl}/admin/summary`);
  }

  creditBalance(userId: string, amount: number, description?: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/admin/credit`, {
      userId,
      amount,
      description
    });
  }

  toggleUserStatus(userId: string): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/admin/toggle-status/${userId}`, {});
  }
}