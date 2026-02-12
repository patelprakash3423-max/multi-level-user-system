import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { User, DownlineUser } from '../../models/user.model';
import Swal from 'sweetalert2';
import { HierarchyNode } from "../hierarchy-node/hierarchy-node";

@Component({
  selector: 'app-admin-hierarchy',
  standalone: true,
  imports: [CommonModule, FormsModule, HierarchyNode],
  templateUrl: './admin-hierarchy.html',
  styleUrl: './admin-hierarchy.scss',
})
export class AdminHierarchy implements OnInit {
  // Data
  rootUser: User | null = null;
  hierarchyTree: DownlineUser[] = [];
  filteredTree: DownlineUser[] = [];

  // Search
  searchUserId: string = '';
  searchUsername: string = '';
  searchResults: User[] = [];
  showSearchResults = false;
  isSearching = false;

  // UI States
  isLoading = true;
  isLoadingHierarchy = false;
  viewMode: 'tree' | 'org' | 'list' = 'tree';
  expandedNodes: Set<string> = new Set();

  // Statistics
  totalNodes: number = 0;
  totalLevels: number = 0;
  totalBalance: number = 0;
  activeUsers: number = 0;
  inactiveUsers: number = 0;
  levelDistribution: { [key: number]: number } = {};

  // Display Options
  showBalances: boolean = true;
  showEmails: boolean = true;
  showInactive: boolean = true;
  maxDepth: number = 10;

  // Export
  isExporting = false;

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private userService: UserService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.checkAdminAccess();
    this.checkForUserId();
  }

  checkAdminAccess(): void {
    const user = this.authService.getCurrentUserValue();
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      this.router.navigate(['/dashboard']);
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to access hierarchy view',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  checkForUserId(): void {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    if (userId) {
      this.searchUserId = userId;
      this.loadUserHierarchy(userId);
    } else {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // User Search
  searchUser(): void {
    if (!this.searchUsername.trim()) {
      return;
    }

    this.isSearching = true;
    this.showSearchResults = true;
    this.searchResults = [];
    this.cdr.detectChanges();

    console.log('Searching for:', this.searchUsername);

    this.userService.searchInDownline(this.searchUsername).subscribe({
      next: (response) => {
        console.log('Search response:', response);
        
        this.isSearching = false;
        
        if (response.success && response.data) {
          this.searchResults = response.data;
        } else {
          this.searchResults = [];
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('User search error:', error);
        
        this.isSearching = false;
        this.searchResults = [];
        this.cdr.detectChanges();
      }
    });
  }

  selectUser(user: User): void {
    this.searchUserId = user._id;
    this.searchUsername = user.username;
    this.showSearchResults = false;
    this.cdr.detectChanges();
    this.loadUserHierarchy(user._id);
  }

  clearSearch(): void {
    this.searchUserId = '';
    this.searchUsername = '';
    this.searchResults = [];
    this.showSearchResults = false;
    this.hierarchyTree = [];
    this.filteredTree = [];
    this.rootUser = null;
    this.resetStatistics();
    this.cdr.detectChanges();
  }

  // Load Hierarchy
  loadUserHierarchy(userId: string): void {
    this.isLoadingHierarchy = true;
    this.cdr.detectChanges();

    console.log('Loading hierarchy for userId:', userId);

    this.adminService.getUserDownlineHierarchy(userId).subscribe({
      next: (response) => {
        console.log('Hierarchy response:', response);
        
        this.isLoadingHierarchy = false;
        this.isLoading = false;

        if (response.success && response.data) {
          this.rootUser = response.data.user;
          this.hierarchyTree = response.data.downline || [];
          this.filteredTree = [...this.hierarchyTree];

          this.calculateStatistics();
          this.autoExpandFirstLevels();

          Swal.fire({
            icon: 'success',
            title: 'Hierarchy Loaded',
            text: `Showing network for ${this.rootUser.username}`,
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          });
        } else {
          this.rootUser = null;
          this.hierarchyTree = [];
          this.filteredTree = [];
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Hierarchy load error:', error);
        
        this.isLoadingHierarchy = false;
        this.isLoading = false;
        this.cdr.detectChanges();

        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Hierarchy',
          text: 'Unable to load user hierarchy. Please try again.',
          confirmButtonColor: '#6f42c1'
        });
      }
    });
  }

  // Statistics
  calculateStatistics(): void {
    this.totalNodes = 0;
    this.totalLevels = 0;
    this.totalBalance = 0;
    this.activeUsers = 0;
    this.inactiveUsers = 0;
    this.levelDistribution = {};

    const calculateNodeStats = (nodes: DownlineUser[], currentLevel: number = 1) => {
      nodes.forEach(node => {
        this.totalNodes++;
        this.totalBalance += node.balance || 0;

        if (node.isActive !== false) {
          this.activeUsers++;
        } else {
          this.inactiveUsers++;
        }

        // Level distribution
        this.levelDistribution[currentLevel] = (this.levelDistribution[currentLevel] || 0) + 1;
        this.totalLevels = Math.max(this.totalLevels, currentLevel);

        if (node.children && node.children.length > 0) {
          calculateNodeStats(node.children, currentLevel + 1);
        }
      });
    };

    calculateNodeStats(this.hierarchyTree);
    this.cdr.detectChanges();
  }

  resetStatistics(): void {
    this.totalNodes = 0;
    this.totalLevels = 0;
    this.totalBalance = 0;
    this.activeUsers = 0;
    this.inactiveUsers = 0;
    this.levelDistribution = {};
    this.cdr.detectChanges();
  }

  // Tree View Methods
  toggleNode(node: DownlineUser): void {
    if (this.expandedNodes.has(node._id)) {
      this.expandedNodes.delete(node._id);
    } else {
      this.expandedNodes.add(node._id);
    }
    this.cdr.detectChanges();
  }

  isNodeExpanded(nodeId: string): boolean {
    return this.expandedNodes.has(nodeId);
  }

  expandAll(): void {
    const addAllNodes = (nodes: DownlineUser[]) => {
      nodes.forEach(node => {
        this.expandedNodes.add(node._id);
        if (node.children && node.children.length > 0) {
          addAllNodes(node.children);
        }
      });
    };
    addAllNodes(this.filteredTree);
    this.cdr.detectChanges();
  }

  collapseAll(): void {
    this.expandedNodes.clear();
    this.cdr.detectChanges();
  }

  expandLevel(level: number): void {
    const expandNodesAtLevel = (nodes: DownlineUser[], currentLevel: number = 1) => {
      nodes.forEach(node => {
        if (currentLevel <= level) {
          this.expandedNodes.add(node._id);
          if (node.children && node.children.length > 0) {
            expandNodesAtLevel(node.children, currentLevel + 1);
          }
        }
      });
    };
    expandNodesAtLevel(this.filteredTree);
    this.cdr.detectChanges();
  }

  autoExpandFirstLevels(): void {
    // Auto expand first 2 levels
    this.expandLevel(2);
  }

  // Filter Methods
  toggleInactiveUsers(): void {
    this.showInactive = !this.showInactive;
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.hierarchyTree];

    // Filter inactive users if disabled
    if (!this.showInactive) {
      filtered = this.filterInactiveUsers(filtered);
    }

    this.filteredTree = filtered;
    this.cdr.detectChanges();
  }

  filterInactiveUsers(nodes: DownlineUser[]): DownlineUser[] {
    return nodes.filter(node => {
      if (node.isActive !== false) {
        if (node.children && node.children.length > 0) {
          node.children = this.filterInactiveUsers(node.children);
        }
        return true;
      }
      return false;
    });
  }

  // Search in Hierarchy
  searchInHierarchy(event: any): void {
    const searchTerm = event.target.value.toLowerCase();

    if (!searchTerm) {
      this.filteredTree = [...this.hierarchyTree];
      this.expandAll();
      return;
    }

    const searchInNode = (nodes: DownlineUser[]): DownlineUser[] => {
      return nodes.filter(node => {
        const matches =
          node.username.toLowerCase().includes(searchTerm) ||
          node.email.toLowerCase().includes(searchTerm) ||
          node.role.toLowerCase().includes(searchTerm) ||
          node._id.toLowerCase().includes(searchTerm);

        if (node.children && node.children.length > 0) {
          node.children = searchInNode(node.children);
          return matches || node.children.length > 0;
        }

        return matches;
      });
    };

    this.filteredTree = searchInNode([...this.hierarchyTree]);
    this.expandAll();
  }

  // User Actions
  viewUserDetails(userId: string): void {
    this.router.navigate(['/profile', userId]);
  }

  editUser(userId: string): void {
    this.router.navigate(['/profile', userId]);
  }

  creditUser(userId: string, username: string): void {
    this.router.navigate(['/admin/credit'], {
      queryParams: { userId, username }
    });
  }

  toggleUserStatus(user: DownlineUser): void {
    if (user.role === 'owner') {
      Swal.fire('Error', 'Cannot modify owner account', 'error');
      return;
    }

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
              // Reload hierarchy
              this.loadUserHierarchy(this.searchUserId);
            }
          },
          error: (error) => {
            Swal.fire('Error', `Failed to ${action} user`, 'error');
          }
        });
      }
    });
  }

  changeUserPassword(user: DownlineUser): void {
    Swal.fire({
      title: `Change Password for ${user.username}`,
      html: `
        <input type="password" id="newPassword" class="swal2-input" placeholder="New Password">
        <input type="password" id="confirmPassword" class="swal2-input" placeholder="Confirm Password">
      `,
      confirmButtonText: 'Update Password',
      confirmButtonColor: '#28a745',
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const newPassword = (document.getElementById('newPassword') as HTMLInputElement).value;
        const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement).value;

        if (!newPassword || !confirmPassword) {
          Swal.showValidationMessage('Both fields are required');
          return false;
        }

        if (newPassword.length < 6) {
          Swal.showValidationMessage('Password must be at least 6 characters');
          return false;
        }

        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage('Passwords do not match');
          return false;
        }

        return { newPassword };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.userService.changeUserPassword(user._id, result.value.newPassword).subscribe({
          next: (response) => {
            if (response.success) {
              Swal.fire('Success', 'Password updated successfully', 'success');
            } else {
              Swal.fire('Error', response.message || 'Failed to update password', 'error');
            }
          },
          error: (error) => {
            Swal.fire('Error', 'Failed to update password', 'error');
          }
        });
      }
    });
  }

  // Export Functions
  exportHierarchy(): void {
    this.isExporting = true;

    Swal.fire({
      title: 'Export Hierarchy',
      text: 'Select export format',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'JSON',
      cancelButtonText: 'CSV',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#17a2b8'
    }).then((result) => {
      if (result.isConfirmed) {
        this.exportAsJSON();
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.exportAsCSV();
      }
      this.isExporting = false;
    });
  }

  exportAsJSON(): void {
    const exportData = {
      rootUser: this.rootUser,
      hierarchy: this.hierarchyTree,
      statistics: {
        totalNodes: this.totalNodes,
        totalLevels: this.totalLevels,
        totalBalance: this.totalBalance,
        activeUsers: this.activeUsers,
        inactiveUsers: this.inactiveUsers,
        levelDistribution: this.levelDistribution
      },
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const fileName = `hierarchy-${this.rootUser?.username}-${new Date().getTime()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    linkElement.click();

    Swal.fire('Success', 'Hierarchy exported as JSON', 'success');
  }

  exportAsCSV(): void {
    const flattenNode = (node: DownlineUser, level: number, parent: string): any[] => {
      const rows = [{
        Username: node.username,
        Email: node.email,
        Role: node.role,
        Level: level,
        Balance: node.balance || 0,
        Downline: node.downlineCount || 0,
        Status: node.isActive !== false ? 'Active' : 'Inactive',
        Parent: parent,
        'User ID': node._id
      }];

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          rows.push(...flattenNode(child, level + 1, node.username));
        });
      }

      return rows;
    };

    const rows: any[] = [];
    this.hierarchyTree.forEach(node => {
      rows.push(...flattenNode(node, 1, this.rootUser?.username || ''));
    });

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hierarchy-${this.rootUser?.username}-${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    Swal.fire('Success', 'Hierarchy exported as CSV', 'success');
  }

  // Print View
  printHierarchy(): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>User Hierarchy - ${this.rootUser?.username}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #667eea; }
              .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
              .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
              .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
              .stat-value { font-size: 24px; font-weight: bold; color: #667eea; }
              .tree { margin-top: 30px; }
              .level { margin-left: 20px; padding-left: 20px; border-left: 2px solid #667eea; }
              .user { padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 4px; }
              .active { border-left: 4px solid #28a745; }
              .inactive { border-left: 4px solid #dc3545; opacity: 0.7; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background: #667eea; color: white; padding: 12px; text-align: left; }
              td { padding: 10px; border-bottom: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>User Hierarchy: ${this.rootUser?.username}</h1>
              <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="stats">
              <div class="stat-card">
                <h3>Total Users</h3>
                <div class="stat-value">${this.totalNodes}</div>
              </div>
              <div class="stat-card">
                <h3>Network Depth</h3>
                <div class="stat-value">${this.totalLevels}</div>
              </div>
              <div class="stat-card">
                <h3>Total Balance</h3>
                <div class="stat-value">$${this.totalBalance.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <h3>Active Users</h3>
                <div class="stat-value">${this.activeUsers}</div>
              </div>
            </div>
            
            <h2>Network Structure</h2>
            <div class="tree">
              ${this.renderPrintableTree(this.hierarchyTree, 1)}
            </div>
            
            <h2>Level Distribution</h2>
            <table>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>User Count</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(this.levelDistribution).map(([level, count]) => `
                  <tr>
                    <td>Level ${level}</td>
                    <td>${count}</td>
                    <td>${((count / this.totalNodes) * 100).toFixed(1)}%</td>
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
  }

  renderPrintableTree(nodes: DownlineUser[], level: number): string {
    let html = '<div class="level">';
    nodes.forEach(node => {
      const statusClass = node.isActive !== false ? 'active' : 'inactive';
      html += `
        <div class="user ${statusClass}">
          <strong>${node.username}</strong> (${node.role}) - Level ${level}<br>
          <small>Email: ${node.email} | Balance: $${(node.balance || 0).toLocaleString()}</small>
          <br><small>Downline: ${node.downlineCount || 0} users</small>
        </div>
      `;
      if (node.children && node.children.length > 0) {
        html += this.renderPrintableTree(node.children, level + 1);
      }
    });
    html += '</div>';
    return html;
  }

  // View Navigation
  setViewMode(mode: 'tree' | 'org' | 'list'): void {
    this.viewMode = mode;
    this.cdr.detectChanges();
  }

  // Helper Methods
  getLevelClass(level: number): string {
    const classes = ['level-badge'];
    switch (level) {
      case 1: classes.push('level-1'); break;
      case 2: classes.push('level-2'); break;
      case 3: classes.push('level-3'); break;
      case 4: classes.push('level-4'); break;
      case 5: classes.push('level-5'); break;
      default: classes.push('level-deep');
    }
    return classes.join(' ');
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'owner': return 'bg-danger';
      case 'admin': return 'bg-warning text-dark';
      case 'user': return 'bg-info';
      default: return 'bg-secondary';
    }
  }

  getStatusBadgeClass(isActive: boolean | undefined): string {
    return isActive !== false ? 'bg-success' : 'bg-secondary';
  }

  getStatusText(isActive: boolean | undefined): string {
    return isActive !== false ? 'Active' : 'Inactive';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num || 0);
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

  getNodeIcon(node: DownlineUser): string {
    if (!node.children || node.children.length === 0) {
      return 'bi-person-circle';
    }
    return this.isNodeExpanded(node._id) ? 'bi-folder2-open' : 'bi-folder2';
  }

  getNodeIconClass(node: DownlineUser): string {
    if (!node.children || node.children.length === 0) {
      return 'text-muted';
    }
    return this.isNodeExpanded(node._id) ? 'text-warning' : 'text-primary';
  }

  getProgressPercentage(level: number): number {
    const count = this.levelDistribution[level] || 0;
    return (count / this.totalNodes) * 100;
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/admin']);
  }

  loadAnotherUser(): void {
    this.clearSearch();
  }

  // Flatten tree for list view
  flattenHierarchy(nodes: DownlineUser[]): DownlineUser[] {
    const result: DownlineUser[] = [];

    const traverse = (items: DownlineUser[]) => {
      items.forEach(node => {
        result.push(node);

        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };

    traverse(nodes);
    return result;
  }
}