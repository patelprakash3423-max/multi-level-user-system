import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DownlineUser } from '../../models/user.model';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tree-node.html',
  styleUrl: './tree-node.scss',
})
export class TreeNode {
  @Input() node!: DownlineUser;
  @Input() level!: number;
  @Input() expanded: boolean = false;

  @Output() toggle = new EventEmitter<DownlineUser>();
  @Output() viewDetails = new EventEmitter<string>();
  @Output() transfer = new EventEmitter<string>();
  @Output() changePassword = new EventEmitter<string>();

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

  hasChildren(): boolean {
    return !!(this.node.children && this.node.children.length > 0);
  }

  getToggleIcon(): string {
    if (!this.hasChildren()) return 'bi-dot';
    return this.expanded ? 'bi-chevron-down' : 'bi-chevron-right';
  }

  getNodeIcon(): string {
    if (!this.hasChildren()) return 'bi-person-circle';
    return this.expanded ? 'bi-folder2-open' : 'bi-folder2';
  }

  getNodeIconClass(): string {
    if (!this.hasChildren()) return 'text-muted';
    return this.expanded ? 'text-warning' : 'text-primary';
  }

  getInitials(username: string): string {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(): string {
    const colors = ['primary', 'success', 'info', 'warning', 'danger', 'secondary'];
    const index = this.node.username.length % colors.length;
    return colors[index];
  }

  onToggle(): void {
    if (this.hasChildren()) {
      this.toggle.emit(this.node);
    }
  }

  onViewDetails(): void {
    this.viewDetails.emit(this.node._id);
  }

  onTransfer(): void {
    this.transfer.emit(this.node._id);
  }

  onChangePassword(): void {
    this.changePassword.emit(this.node._id);
  }

  
}