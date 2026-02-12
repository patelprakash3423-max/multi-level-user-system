import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PaginationParams } from '../models/api.model';
import { Transaction, TransferRequest, BalanceStatement } from '../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class BalanceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getBalance(): Observable<ApiResponse<{ balance: number }>> {
    return this.http.get<ApiResponse<{ balance: number }>>(`${this.apiUrl}/balance/balance`);
  }

  getStatement(params: PaginationParams): Observable<ApiResponse<BalanceStatement>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.type) httpParams = httpParams.set('type', params.type);

    return this.http.get<ApiResponse<BalanceStatement>>(
      `${this.apiUrl}/balance/statement`,
      { params: httpParams }
    );
  }

  transfer(transferData: TransferRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/balance/transfer`, transferData);
  }

  // recharge(amount: number): Observable<ApiResponse> {
  //   return this.http.post<ApiResponse>(`${this.apiUrl}/balance/recharge`, { amount });
  // }

  getTransferHistory(type: string = 'all'): Observable<ApiResponse<{ transactions: Transaction[], totals: any[] }>> {
    return this.http.get<ApiResponse<{ transactions: Transaction[], totals: any[] }>>(
      `${this.apiUrl}/balance/history`,
      { params: { type } }
    );
  }

   recharge(amount: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/balance/recharge`, 
      { amount },
      { withCredentials: true }
    );
  }
}