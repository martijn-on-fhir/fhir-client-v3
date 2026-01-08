import { Component, inject, computed, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { TabNavComponent } from '../tab-nav/tab-nav.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AboutDialogComponent } from '../../shared/components/about-dialog/about-dialog.component';
import { SettingsService } from '../../core/services/settings.service';

/**
 * Main Layout Component - App shell structure
 *
 * Structure:
 * - Header (60px fixed height)
 * - Sidebar (optional, resizable 150-500px)
 * - Tab Navigation (sticky)
 * - Content Area (scrollable with router-outlet)
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    TabNavComponent,
    SidebarComponent,
    AboutDialogComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private settingsService = inject(SettingsService);

  @ViewChild(AboutDialogComponent) aboutDialog!: AboutDialogComponent;

  // Store callback reference for cleanup
  private showAboutCallback = () => {
    this.aboutDialog?.open();
  };

  // Expose sidebar visibility to template
  readonly sidebarVisible = computed(() => this.settingsService.sidebarVisible());

  ngOnInit() {
    // Listen for Electron menu events
    if (window.electronAPI?.on) {
      window.electronAPI.on('show-about', this.showAboutCallback);
    }
  }

  ngOnDestroy() {
    // Clean up event listeners
    if (window.electronAPI?.off) {
      window.electronAPI.off('show-about', this.showAboutCallback);
    }
  }
}
