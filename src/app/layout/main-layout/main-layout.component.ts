import { CommonModule } from '@angular/common';
import { Component, inject, computed, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SettingsService } from '../../core/services/settings.service';
import { AboutDialogComponent } from '../../shared/components/about-dialog/about-dialog.component';
import { ServerInfoDialogComponent } from '../../shared/components/server-info-dialog/server-info-dialog.component';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TabNavComponent } from '../tab-nav/tab-nav.component';

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
    AboutDialogComponent,
    ServerInfoDialogComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private settingsService = inject(SettingsService);

  @ViewChild(AboutDialogComponent) aboutDialog!: AboutDialogComponent;
  @ViewChild(ServerInfoDialogComponent) serverInfoDialog!: ServerInfoDialogComponent;

  // Store callback references for cleanup
  private showAboutCallback = () => {
    this.aboutDialog?.open();
  };

  private showServerInfoCallback = () => {
    this.serverInfoDialog?.open();
  };

  // Expose sidebar visibility to template
  readonly sidebarVisible = computed(() => this.settingsService.sidebarVisible());

  ngOnInit() {
    // Listen for Electron menu events
    if (window.electronAPI?.on) {
      window.electronAPI.on('show-about', this.showAboutCallback);
      window.electronAPI.on('show-server-info', this.showServerInfoCallback);
    }
  }

  ngOnDestroy() {
    // Clean up event listeners
    if (window.electronAPI?.off) {
      window.electronAPI.off('show-about', this.showAboutCallback);
      window.electronAPI.off('show-server-info', this.showServerInfoCallback);
    }
  }
}
