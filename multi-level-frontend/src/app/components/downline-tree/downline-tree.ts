import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { BalanceService } from '../../services/balance.service';
import { DownlineUser, User } from '../../models/user.model';
import Swal from 'sweetalert2';
import { TreeNode } from "../tree-node/tree-node";
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-downline-tree',
  standalone: true,
  imports: [CommonModule, FormsModule, TreeNode],
  templateUrl: './downline-tree.html',
  styleUrl: './downline-tree.scss',
})
export class DownlineTree implements OnInit {
  downlineTree: DownlineUser[] = [];
  filteredTree: DownlineUser[] = [];
  isLoading = true;
  currentUser: User | null = null;

  // Search and Filter
  searchTerm: string = '';
  selectedLevel: number | null = null;
  sortBy: string = 'username';
  sortOrder: 'asc' | 'desc' = 'asc';
  viewMode: 'tree' | 'grid' | 'list' = 'tree';

  // Statistics
  totalDownline: number = 0;
  totalLevels: number = 0;
  totalBalance: number = 0;
  activeUsers: number = 0;
  inactiveUsers: number = 0;
  levelDistribution: { [key: number]: number } = {};

  // Expanded nodes
  expandedNodes: Set<string> = new Set<string>();

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private balanceService: BalanceService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadDownline();
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  loadDownline(): void {
    this.isLoading = true;
    this.userService.getDownline().subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success && response.data) {
          this.downlineTree = response.data.downline;
          this.filteredTree = [...this.downlineTree];

          // Calculate statistics
          this.calculateStatistics();

          // Auto-expand first level
          this.autoExpandFirstLevel();

          console.log('Downline loaded:', this.downlineTree);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Downline load error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Network',
          text: 'Unable to load your downline network. Please try again.',
          confirmButtonColor: '#6f42c1'
        });
      }
    });
  }

  calculateStatistics(): void {
    // Reset stats
    this.totalDownline = 0;
    this.totalLevels = 0;
    this.totalBalance = 0;
    this.activeUsers = 0;
    this.inactiveUsers = 0;
    this.levelDistribution = {};

    const calculateNodeStats = (nodes: DownlineUser[], currentLevel: number = 1) => {
      nodes.forEach(node => {
        this.totalDownline++;
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

    calculateNodeStats(this.downlineTree);
    this.totalPages = Math.ceil(this.totalDownline / this.itemsPerPage);
  }

  autoExpandFirstLevel(): void {
    this.downlineTree.forEach(node => {
      this.expandedNodes.add(node._id);
    });
  }

  // Tree View Methods
  toggleNode(node: DownlineUser): void {
    if (this.expandedNodes.has(node._id)) {
      this.expandedNodes.delete(node._id);
    } else {
      this.expandedNodes.add(node._id);
    }
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
  }

  collapseAll(): void {
    this.expandedNodes.clear();
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
  }

  // Search and Filter Methods
  filterByLevel(level: number | null): void {
    this.selectedLevel = level;
    this.applyFilters();
  }

  searchDownline(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.downlineTree];

    // Filter by level
    if (this.selectedLevel !== null) {
      filtered = this.filterNodesByLevel(filtered, this.selectedLevel);
    }

    // Filter by search term
    if (this.searchTerm.trim()) {
      filtered = this.searchNodes(filtered, this.searchTerm.toLowerCase());
    }

    // Apply sorting
    filtered = this.sortNodes(filtered);

    this.filteredTree = filtered;
    this.calculateFilteredStats();
  }

  filterNodesByLevel(nodes: DownlineUser[], targetLevel: number, currentLevel: number = 1): DownlineUser[] {
    return nodes.filter(node => {
      if (currentLevel === targetLevel) {
        return true;
      }
      if (node.children && node.children.length > 0) {
        node.children = this.filterNodesByLevel(node.children, targetLevel, currentLevel + 1);
        return node.children.length > 0;
      }
      return false;
    });
  }

  searchNodes(nodes: DownlineUser[], searchTerm: string): DownlineUser[] {
    return nodes.filter(node => {
      const matches =
        node.username.toLowerCase().includes(searchTerm) ||
        node.email.toLowerCase().includes(searchTerm) ||
        (node.role || '').toLowerCase().includes(searchTerm);

      if (node.children && node.children.length > 0) {
        node.children = this.searchNodes(node.children, searchTerm);
        return matches || node.children.length > 0;
      }

      return matches;
    });
  }

  sortNodes(nodes: DownlineUser[]): DownlineUser[] {
    return nodes.sort((a, b) => {
      let comparison = 0;

      switch (this.sortBy) {
        case 'username':
          comparison = a.username.localeCompare(b.username);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'level':
          comparison = (a.level || 0) - (b.level || 0);
          break;
        case 'balance':
          comparison = (a.balance || 0) - (b.balance || 0);
          break;
        case 'downlineCount':
          comparison = (a.downlineCount || 0) - (b.downlineCount || 0);
          break;
        default:
          comparison = a.username.localeCompare(b.username);
      }

      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedLevel = null;
    this.sortBy = 'username';
    this.sortOrder = 'asc';
    this.filteredTree = [...this.downlineTree];
    this.collapseAll();
    this.autoExpandFirstLevel();
  }

  calculateFilteredStats(): void {
    // Calculate stats for filtered tree
    let total = 0;
    const countNodes = (nodes: DownlineUser[]) => {
      nodes.forEach(node => {
        total++;
        if (node.children && node.children.length > 0) {
          countNodes(node.children);
        }
      });
    };
    countNodes(this.filteredTree);
    this.totalPages = Math.ceil(total / this.itemsPerPage);
  }

  // User Actions
  viewUserDetails(userId: string): void {
    this.router.navigate(['/profile', userId]);
  }

  transferToUser(userId: string): void {
    this.router.navigate(['/transfer'], { queryParams: { receiverId: userId } });
  }

  changePassword(userId: string, username: string): void {
    Swal.fire({
      title: `Change Password for ${username}`,
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
        this.userService.changeUserPassword(userId, result.value.newPassword).subscribe({
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

  // Navigation
  viewFullHierarchy(userId: string): void {
    if (this.currentUser?.role === 'admin' || this.currentUser?.role === 'owner') {
      this.router.navigate(['/admin/hierarchy'], { queryParams: { userId } });
    }
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
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getInitials(username: string): string {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getRandomColor(username: string): string {
    const colors = [
      'primary', 'success', 'info', 'warning', 'danger', 'secondary'
    ];
    const index = username.length % colors.length;
    return colors[index];
  }

  getNodeIcon(hasChildren: boolean, expanded: boolean): string {
    if (!hasChildren) return 'bi-dot';
    return expanded ? 'bi-folder2-open' : 'bi-folder2';
  }

  getNodeIconClass(hasChildren: boolean): string {
    if (!hasChildren) return 'text-muted';
    return 'text-warning';
  }

  // Export functionality
  exportNetwork(): void {
    const dataStr = JSON.stringify(this.downlineTree, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `downline-network-${new Date().getTime()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  // Pagination
  changePage(page: number): void {
    this.currentPage = page;
  }

  get paginatedNodes(): DownlineUser[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.flattenTree(this.filteredTree).slice(startIndex, startIndex + this.itemsPerPage);
  }

  flattenTree(nodes: DownlineUser[]): DownlineUser[] {
    let result: DownlineUser[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result = result.concat(this.flattenTree(node.children));
      }
    });
    return result;
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

}