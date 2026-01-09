import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

/**
 * Profile Cache Management Dropdown Component
 *
 * Shared dropdown component for managing profile cache.
 * Used by both Nictiz and Profiles tabs.
 */

interface CacheStats {
  fileCount: number;
  totalSize: number;
}

@Component({
  selector: 'app-profile-cache-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-cache-dropdown.component.html',
  styleUrls: ['./profile-cache-dropdown.component.scss']
})
export class ProfileCacheDropdownComponent implements OnInit {
  @Input() cacheStats: CacheStats | null = null;
  @Output() refresh = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  isOpen = false;

  ngOnInit() {
    // Close dropdown when clicking outside
    document.addEventListener('click', this.onDocumentClick);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.onDocumentClick);
  }

  private onDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.profile-cache-dropdown');

    if (!dropdown && this.isOpen) {
      this.isOpen = false;
    }
  };

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  onRefresh(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = false;
    this.refresh.emit();
  }

  onClear(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = false;
    this.clear.emit();
  }

  get displayTitle(): string {
    if (this.cacheStats) {
      const sizeKB = (this.cacheStats.totalSize / 1024).toFixed(1);

      return `${this.cacheStats.fileCount} cached profiles (${sizeKB} KB)`;
    }

    return 'Cache management';
  }
}
