import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { APP_TABS, Tab } from '../../core/models/tab.model';
import { SettingsService } from '../../core/services/settings.service';

/**
 * Tab Navigation Component - Horizontal tab bar for app navigation
 *
 * Shows enabled tabs with icons and labels
 * Highlights active tab based on current route
 */
@Component({
  selector: 'app-tab-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tab-nav.component.html',
  styleUrls: ['./tab-nav.component.scss']
})
export class TabNavComponent {
  private settingsService = inject(SettingsService);
  public router = inject(Router);

  // Filter tabs based on enabled tabs in settings
  tabs = computed(() => {
    const enabledTabIds = this.settingsService.enabledTabs();
    return APP_TABS.filter(tab => enabledTabIds.includes(tab.id));
  });

  /**
   * Check if tab is currently active
   */
  isActive(tab: Tab): boolean {
    return this.router.url === tab.route || this.router.url.startsWith(tab.route + '/');
  }
}
