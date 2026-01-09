import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { SettingsService } from '../../core/services/settings.service';
import { ThemeService } from '../../core/services/theme.service';
import { SettingsDialogComponent } from '../../shared/components/settings-dialog/settings-dialog.component';

/**
 * Header Component - App header with branding and controls
 *
 * Features:
 * - App logo and title
 * - Sidebar toggle button
 * - Connection status indicator
 * - Theme toggle button
 * - Settings dialog
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, SettingsDialogComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  private themeService = inject(ThemeService);
  private fhirService = inject(FhirService);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('HeaderComponent');

  @ViewChild(SettingsDialogComponent) settingsDialog!: SettingsDialogComponent;

  // Expose theme for template
  get currentTheme() {
    return this.themeService.currentTheme();
  }

  get themeIcon() {
    return this.currentTheme === 'dark' ? 'sun' : 'moon';
  }

  // Expose sidebar visibility
  readonly sidebarVisible = computed(() => this.settingsService.sidebarVisible());

  /**
   * Toggle sidebar
   */
  toggleSidebar(): void {
    this.settingsService.toggleSidebar();
  }

  /**
   * Toggle theme
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Open settings dialog
   */
  openSettings(): void {
    this.settingsDialog.open();
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.authService.logout().toPromise();
    this.router.navigate(['/login']);
  }

  /**
   * Open file
   */
  async openFile(): Promise<void> {
    if (!window.electronAPI?.file?.openFile) {
      alert('File operations are only available in Electron');

      return;
    }

    try {
      const result = await window.electronAPI.file.openFile();

      if (result && 'content' in result) {
        // TODO: Handle opened file content
        this.logger.info('File opened:', result.path);
        this.logger.debug('Content:', result.content);
      }
    } catch (error) {
      this.logger.error('Failed to open file:', error);
    }
  }

  /**
   * Save file
   */
  async saveFile(): Promise<void> {
    if (!window.electronAPI?.file?.saveFile) {
      alert('File operations are only available in Electron');

      return;
    }

    try {
      // TODO: Get content to save from current view
      const content = JSON.stringify({ message: 'Example content' }, null, 2);
      const result = await window.electronAPI.file.saveFile(content, 'export.json');

      if (result && 'success' in result && result.success) {
        this.logger.info('File saved:', result.path);
      }
    } catch (error) {
      this.logger.error('Failed to save file:', error);
    }
  }
}
