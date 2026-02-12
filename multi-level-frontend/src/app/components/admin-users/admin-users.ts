import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
})
export class AdminUsers implements OnInit {
  // Data
  users: User[] = [];
  filteredUsers: User[] = [];
  selectedUser: User | null = null;

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  totalPages: number = 1;

  // Filters
  searchTerm: string = '';
  selectedRole: string = 'all';
  selectedStatus: string = 'all';
  selectedLevel: string = 'all';
  sortBy: string = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom' = 'all';
  startDate: string = '';
  endDate: string = '';

  // UI States
  isExporting = false;
  showFilters = false;
  showBulkActions = false;
  showUserDetails = false;
  showEditModal = false;
  showCreateModal = false;
  showPasswordModal = false;

  // Bulk Actions
  selectedUsers: Set<string> = new Set();
  selectAll: boolean = false;

  // Statistics
  totalBalance: number = 0;
  avgBalance: number = 0;
  activeUsersCount: number = 0;
  inactiveUsersCount: number = 0;
  adminCount: number = 0;
  userCount: number = 0;
  ownerCount: number = 0;

  // Edit Form
  editForm: {
    userId: string;
    email: string;
    role: string;
    isActive: boolean;
    balance?: number;
  } = {
      userId: '',
      email: '',
      role: 'user',
      isActive: true
    };

  // Create Form
  createForm: {
    username: string;
    email: string;
    password: string;
    role: string;
    parentId?: string;
  } = {
      username: '',
      email: '',
      password: '',
      role: 'user'
    };

  // Password Form
  passwordForm: {
    userId: string;
    newPassword: string;
    confirmPassword: string;
  } = {
      userId: '',
      newPassword: '',
      confirmPassword: ''
    };

  // Available roles
  roles: string[] = ['user', 'admin', 'owner'];

  // Level options
  levelOptions: number[] = [0, 1, 2, 3, 4, 5];

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.checkAdminAccess();
    this.loadUsers();
  }

  checkAdminAccess(): void {
    const user = this.authService.getCurrentUserValue();
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      this.router.navigate(['/dashboard']);
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to access user management',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  loadUsers(): void {
    this.adminService.getAllUsers({
      page: this.currentPage,
      limit: this.itemsPerPage,
      search: this.searchTerm
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.users = response.data.users;
          this.totalItems = response.data.pagination.total;
          this.totalPages = response.data.pagination.pages;

          this.applyFilters();
          this.calculateStatistics();
        }
      },
      error: (error) => {
        console.error('Users load error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Users',
          text: 'Unable to load user list. Please try again.',
          confirmButtonColor: '#6f42c1'
        });
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.users];

    // Filter by role
    if (this.selectedRole !== 'all') {
      filtered = filtered.filter(u => u.role === this.selectedRole);
    }

    // Filter by status
    if (this.selectedStatus !== 'all') {
      const isActive = this.selectedStatus === 'active';
      filtered = filtered.filter(u => u.isActive === isActive);
    }

    // Filter by level
    if (this.selectedLevel !== 'all') {
      const level = parseInt(this.selectedLevel);
      filtered = filtered.filter(u => u.level === level);
    }

    // Filter by date range
    filtered = this.filterByDateRange(filtered);

    // Apply sorting
    filtered = this.sortUsers(filtered);

    this.filteredUsers = filtered;
    this.totalItems = filtered.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.currentPage = 1;
  }

  filterByDateRange(users: User[]): User[] {
    if (this.dateRange === 'all' || !this.dateRange) {
      return users;
    }

    const now = new Date();
    let startDate: Date;

    switch (this.dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'custom':
        if (this.startDate && this.endDate) {
          const start = new Date(this.startDate);
          const end = new Date(this.endDate);
          end.setHours(23, 59, 59, 999);
          return users.filter(u => {
            const createdAt = new Date(u.createdAt);
            return createdAt >= start && createdAt <= end;
          });
        }
        return users;
      default:
        return users;
    }

    return users.filter(u => new Date(u.createdAt) >= startDate);
  }

  sortUsers(users: User[]): User[] {
    return users.sort((a, b) => {
      let comparison = 0;

      switch (this.sortBy) {
        case 'username':
          comparison = a.username.localeCompare(b.username);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
        case 'level':
          comparison = a.level - b.level;
          break;
        case 'balance':
          comparison = a.balance - b.balance;
          break;
        case 'downlineCount':
          comparison = (a.downlineCount || 0) - (b.downlineCount || 0);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'lastLogin':
          comparison = (a.lastLogin ? new Date(a.lastLogin).getTime() : 0) -
            (b.lastLogin ? new Date(b.lastLogin).getTime() : 0);
          break;
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  calculateStatistics(): void {
    this.totalBalance = this.users.reduce((sum, u) => sum + u.balance, 0);
    this.avgBalance = this.users.length > 0 ? this.totalBalance / this.users.length : 0;
    this.activeUsersCount = this.users.filter(u => u.isActive !== false).length;
    this.inactiveUsersCount = this.users.filter(u => u.isActive === false).length;
    this.adminCount = this.users.filter(u => u.role === 'admin').length;
    this.userCount = this.users.filter(u => u.role === 'user').length;
    this.ownerCount = this.users.filter(u => u.role === 'owner').length;
  }

  // Search
  onSearch(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadUsers();
  }

  // Filter Methods
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  clearFilters(): void {
    this.selectedRole = 'all';
    this.selectedStatus = 'all';
    this.selectedLevel = 'all';
    this.dateRange = 'all';
    this.sortBy = 'createdAt';
    this.sortOrder = 'desc';
    this.startDate = '';
    this.endDate = '';
    this.applyFilters();
  }

  setDateRange(range: 'all' | 'today' | 'week' | 'month' | 'custom'): void {
    this.dateRange = range;
    if (range !== 'custom') {
      this.startDate = '';
      this.endDate = '';
    }
    this.applyFilters();
  }

  applyCustomDateRange(): void {
    if (this.startDate && this.endDate) {
      this.dateRange = 'custom';
      this.applyFilters();
    }
  }

  // Sort Methods
  setSortBy(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'desc';
    }
    this.applyFilters();
  }

  getSortIcon(field: string): string {
    if (this.sortBy !== field) return 'bi-arrow-down-up';
    return this.sortOrder === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
  }

  // Pagination
  changePage(page: number): void {
    this.currentPage = page;
    this.loadUsers();
  }

  // User Actions
  viewUserDetails(user: User): void {
    this.selectedUser = user;
    this.showUserDetails = true;
  }

  closeUserDetails(): void {
    this.showUserDetails = false;
    this.selectedUser = null;
  }

  editUser(user: User): void {
    this.editForm = {
      userId: user._id,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
      balance: user.balance
    };
    this.showEditModal = true;
  }

  saveUserEdit(): void {
    // TODO: Implement edit user endpoint
    Swal.fire({
      title: 'Update User',
      text: 'Are you sure you want to update this user?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, update'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: 'success',
          title: 'User Updated',
          text: 'User information has been updated successfully',
          timer: 2000,
          showConfirmButton: false
        });
        this.showEditModal = false;
        this.loadUsers();
      }
    });
  }

  toggleUserStatus(user: User): void {
    const action = user.isActive ? 'deactivate' : 'activate';

    Swal.fire({
      title: `${action} User?`,
      text: `Are you sure you want to ${action} ${user.username}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: user.isActive ? '#dc3545' : '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Yes, ${action}`,
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.toggleUserStatus(user._id).subscribe({
          next: (response) => {
            if (response.success) {
              Swal.fire({
                icon: 'success',
                title: `User ${action}d`,
                text: `${user.username} has been ${action}d successfully`,
                timer: 2000,
                showConfirmButton: false
              });
              this.loadUsers();
            }
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: `Failed to ${action} user`,
              confirmButtonColor: '#dc3545'
            });
          }
        });
      }
    });
  }

  changeUserPassword(user: User): void {
    this.passwordForm = {
      userId: user._id,
      newPassword: '',
      confirmPassword: ''
    };
    this.showPasswordModal = true;
  }

  savePassword(): void {
    if (this.passwordForm.newPassword.length < 6) {
      Swal.fire('Error', 'Password must be at least 6 characters', 'error');
      return;
    }

    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      Swal.fire('Error', 'Passwords do not match', 'error');
      return;
    }

    this.userService.changeUserPassword(
      this.passwordForm.userId,
      this.passwordForm.newPassword
    ).subscribe({
      next: (response) => {
        if (response.success) {
          Swal.fire({
            icon: 'success',
            title: 'Password Updated',
            text: 'User password has been changed successfully',
            timer: 2000,
            showConfirmButton: false
          });
          this.showPasswordModal = false;
        }
      },
      error: (error) => {
        Swal.fire('Error', 'Failed to change password', 'error');
      }
    });
  }

  viewUserHierarchy(userId: string): void {
    this.router.navigate(['/admin/hierarchy'], { queryParams: { userId } });
  }

  creditUserBalance(user: User): void {
    this.router.navigate(['/admin/credit'], {
      queryParams: { userId: user._id, username: user.username }
    });
  }

  deleteUser(user: User): void {
    if (user.role === 'owner') {
      Swal.fire('Error', 'Cannot delete owner account', 'error');
      return;
    }

    Swal.fire({
      title: 'Delete User?',
      text: `Are you sure you want to delete ${user.username}? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // TODO: Implement delete user endpoint
        Swal.fire(
          'Deleted!',
          'User has been deleted successfully.',
          'success'
        );
        this.loadUsers();
      }
    });
  }

  // Bulk Actions
  toggleSelectAll(): void {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.getCurrentPageUsers().forEach(user => {
        this.selectedUsers.add(user._id);
      });
    } else {
      this.selectedUsers.clear();
    }
  }

  toggleUserSelection(userId: string): void {
    if (this.selectedUsers.has(userId)) {
      this.selectedUsers.delete(userId);
      this.selectAll = false;
    } else {
      this.selectedUsers.add(userId);
      this.selectAll = this.getCurrentPageUsers().every(u =>
        this.selectedUsers.has(u._id)
      );
    }
  }

  getCurrentPageUsers(): User[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredUsers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  clearSelection(): void {
    this.selectedUsers.clear();
    this.selectAll = false;
  }

  bulkActivate(): void {
    if (this.selectedUsers.size === 0) {
      Swal.fire('Error', 'No users selected', 'error');
      return;
    }

    Swal.fire({
      title: 'Activate Users',
      text: `Are you sure you want to activate ${this.selectedUsers.size} user(s)?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, activate'
    }).then((result) => {
      if (result.isConfirmed) {
        // TODO: Implement bulk activate
        Swal.fire('Success', `${this.selectedUsers.size} user(s) activated`, 'success');
        this.clearSelection();
        this.loadUsers();
      }
    });
  }

  bulkDeactivate(): void {
    if (this.selectedUsers.size === 0) {
      Swal.fire('Error', 'No users selected', 'error');
      return;
    }

    Swal.fire({
      title: 'Deactivate Users',
      text: `Are you sure you want to deactivate ${this.selectedUsers.size} user(s)?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, deactivate'
    }).then((result) => {
      if (result.isConfirmed) {
        // TODO: Implement bulk deactivate
        Swal.fire('Success', `${this.selectedUsers.size} user(s) deactivated`, 'success');
        this.clearSelection();
        this.loadUsers();
      }
    });
  }

  bulkChangeRole(): void {
    if (this.selectedUsers.size === 0) {
      Swal.fire('Error', 'No users selected', 'error');
      return;
    }

    Swal.fire({
      title: 'Change Role',
      input: 'select',
      inputOptions: {
        user: 'User',
        admin: 'Admin'
      },
      inputPlaceholder: 'Select a role',
      showCancelButton: true,
      confirmButtonColor: '#667eea',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Update',
      preConfirm: (role) => {
        if (!role) {
          Swal.showValidationMessage('Please select a role');
          return false;
        }
        return role;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // TODO: Implement bulk role change
        Swal.fire(
          'Success',
          `${this.selectedUsers.size} user(s) role updated to ${result.value}`,
          'success'
        );
        this.clearSelection();
        this.loadUsers();
      }
    });
  }

  // Export Functions
  exportUsers(format: 'csv' | 'pdf'): void {
    this.isExporting = true;

    if (format === 'csv') {
      this.exportAsCSV();
    } else {
      this.exportAsPDF();
    }
  }

  exportAsCSV(): void {
    const data = this.filteredUsers;
    const headers = ['Username', 'Email', 'Role', 'Level', 'Balance', 'Downline', 'Status', 'Joined', 'Last Login'];
    const csvData = data.map(u => [
      u.username,
      u.email,
      u.role,
      u.level,
      u.balance,
      u.downlineCount || 0,
      u.isActive ? 'Active' : 'Inactive',
      new Date(u.createdAt).toLocaleDateString(),
      u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'
    ]);

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    this.isExporting = false;
    Swal.fire('Success', `${data.length} users exported to CSV`, 'success');
  }

  exportAsPDF(): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Users Export</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #667eea; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background: #667eea; color: white; padding: 12px; text-align: left; }
              td { padding: 10px; border-bottom: 1px solid #ddd; }
              .active { color: green; }
              .inactive { color: red; }
              .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            </style>
          </head>
          <body>
            <h1>System Users Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            
            <div class="summary">
              <h3>Summary</h3>
              <p>Total Users: ${this.totalItems}</p>
              <p>Active Users: ${this.activeUsersCount}</p>
              <p>Inactive Users: ${this.inactiveUsersCount}</p>
              <p>Total Balance: $${this.totalBalance.toLocaleString()}</p>
              <p>Average Balance: $${this.avgBalance.toLocaleString()}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Level</th>
                  <th>Balance</th>
                  <th>Downline</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredUsers.map(u => `
                  <tr>
                    <td>${u.username}</td>
                    <td>${u.email}</td>
                    <td>${u.role.toUpperCase()}</td>
                    <td>${u.level}</td>
                    <td>$${u.balance.toLocaleString()}</td>
                    <td>${u.downlineCount || 0}</td>
                    <td class="${u.isActive ? 'active' : 'inactive'}">${u.isActive ? 'Active' : 'Inactive'}</td>
                    <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }

    this.isExporting = false;
  }

  // Navigation
  createNewUser(): void {
    this.router.navigate(['/create-user']);
  }

  // Utility Methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  formatDate(date?: Date | string): string {
    if (!date) return 'Never';

    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }


formatDateTime(date?: Date | string): string {
  if (!date) return 'Never';

  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'owner': return 'bg-danger';
      case 'admin': return 'bg-warning text-dark';
      case 'user': return 'bg-info';
      default: return 'bg-secondary';
    }
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'bg-success' : 'bg-secondary';
  }

  getInitials(username: string): string {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(username: string): string {
    const colors = ['primary', 'success', 'info', 'warning', 'danger', 'secondary'];
    const index = username.length % colors.length;
    return colors[index];
  }

  // Pagination helper
  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  // Close modals
  closeModals(): void {
    this.showUserDetails = false;
    this.showEditModal = false;
    this.showPasswordModal = false;
    this.selectedUser = null;
  }
}