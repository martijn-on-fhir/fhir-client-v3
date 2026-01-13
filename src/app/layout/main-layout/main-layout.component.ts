import { CommonModule } from '@angular/common';
import { Component, inject, computed, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EditorStateService } from '../../core/services/editor-state.service';
import { SettingsService } from '../../core/services/settings.service';
import { AboutDialogComponent } from '../../shared/components/about-dialog/about-dialog.component';
import { CertificateManagerDialogComponent } from '../../shared/components/certificate-manager-dialog/certificate-manager-dialog.component';
import { ServerInfoDialogComponent } from '../../shared/components/server-info-dialog/server-info-dialog.component';
import { SettingsDialogComponent } from '../../shared/components/settings-dialog/settings-dialog.component';
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
    ServerInfoDialogComponent,
    SettingsDialogComponent,
    CertificateManagerDialogComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private settingsService = inject(SettingsService);
  private editorStateService = inject(EditorStateService);

  @ViewChild(AboutDialogComponent) aboutDialog!: AboutDialogComponent;
  @ViewChild(ServerInfoDialogComponent) serverInfoDialog!: ServerInfoDialogComponent;
  @ViewChild(SettingsDialogComponent) settingsDialog!: SettingsDialogComponent;
  @ViewChild(CertificateManagerDialogComponent) certificateManagerDialog!: CertificateManagerDialogComponent;

  // Store callback references for cleanup
  private showAboutCallback = () => {
    this.aboutDialog?.open();
  };

  private showServerInfoCallback = () => {
    this.serverInfoDialog?.open();
  };

  private showSettingsCallback = () => {
    this.settingsDialog?.open();
  };

  private showCertificateManagerCallback = () => {
    this.certificateManagerDialog?.open();
  };

  private handleFileOpen = async () => {
    if (!this.editorStateService.canOpen()) {
      alert('This editor is read-only. Switch to Validator tab to edit.');

      return;
    }

    try {
      // Type guard for window.electronAPI
      if (!window.electronAPI || !window.electronAPI.file || !window.electronAPI.file.openFile) {
        alert('File API not available');

        return;
      }

      const result = await window.electronAPI.file.openFile();

      if (result && !('error' in result)) {
        // Validate JSON
        JSON.parse(result.content);
        this.editorStateService.setEditorContent(result.content);
      }
    } catch (e) {
      console.error('Failed to open file:', e);
      alert('Invalid JSON file');
    }
  };

  private handleFileSave = async () => {
    if (!this.editorStateService.canSave()) {
      alert('No editor content to save on this tab');

      return;
    }

    try {
      const content = this.editorStateService.getEditorContent();

      if (!content) {
return;
}

      // Type guard for window.electronAPI
      if (!window.electronAPI || !window.electronAPI.file || !window.electronAPI.file.saveFile) {
        alert('File API not available');

        return;
      }

      // Format JSON with pretty-print
      const formatted = JSON.stringify(JSON.parse(content), null, 2);
      await window.electronAPI.file.saveFile(formatted, 'export.json');
    } catch (e) {
      console.error('Failed to save file:', e);
      alert('Invalid JSON content');
    }
  };

  // Expose sidebar visibility to template
  readonly sidebarVisible = computed(() => this.settingsService.sidebarVisible());

  ngOnInit() {
    // Listen for Electron menu events
    if (window.electronAPI?.on) {
      window.electronAPI.on('show-about', this.showAboutCallback);
      window.electronAPI.on('show-server-info', this.showServerInfoCallback);
      window.electronAPI.on('show-settings', this.showSettingsCallback);
      window.electronAPI.on('show-certificate-manager', this.showCertificateManagerCallback);
      window.electronAPI.on('file-open', this.handleFileOpen);
      window.electronAPI.on('file-save', this.handleFileSave);
    }
  }

  ngOnDestroy() {
    // Clean up event listeners
    if (window.electronAPI?.off) {
      window.electronAPI.off('show-about', this.showAboutCallback);
      window.electronAPI.off('show-server-info', this.showServerInfoCallback);
      window.electronAPI.off('show-settings', this.showSettingsCallback);
      window.electronAPI.off('show-certificate-manager', this.showCertificateManagerCallback);
      window.electronAPI.off('file-open', this.handleFileOpen);
      window.electronAPI.off('file-save', this.handleFileSave);
    }
  }
}
