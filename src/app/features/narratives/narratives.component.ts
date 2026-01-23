import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NictizService } from '../../core/services/nictiz.service';
import { ToastService } from '../../core/services/toast.service';
import { NarrativeStateService } from '../../core/services/narrative-state.service';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';
import { NarrativeEditorDialogComponent } from '../../shared/components/narrative-editor-dialog/narrative-editor-dialog.component';
import { ResultHeaderComponent } from '../../shared/components/result-header/result-header.component';

/**
 * Narratives Component
 *
 * Provides interface for viewing and managing FHIR resource narratives.
 * Loads Handlebars templates based on selected Nictiz profiles.
 */
@Component({
  selector: 'app-narratives',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, NarrativeEditorDialogComponent, ResultHeaderComponent],
  templateUrl: './narratives.component.html',
  styleUrl: './narratives.component.scss'
})
export class NarrativesComponent implements OnInit {

  /** Reference to Monaco editor component */
  @ViewChild('monacoEditor') monacoEditor!: MonacoEditorComponent;

  /** Reference to Narrative Editor Dialog */
  @ViewChild(NarrativeEditorDialogComponent) narrativeEditorDialog!: NarrativeEditorDialogComponent;

  /** URL of currently selected profile */
  selectedProfileUrl = signal<string>('');

  /** Title of currently selected profile */
  selectedProfileTitle = signal<string>('');

  /** Loading state while fetching template */
  loadingTemplate = signal<boolean>(false);

  /** Error message from template loading */
  templateError = signal<string | null>(null);

  /** Content to display in the editor */
  editorContent = signal<string>('');

  /** Path to the templates directory */
  templatesDir = signal<string>('');

  /** Flag to prevent saving state during initialization */
  private isInitialized = false;

  private toastService = inject(ToastService);
  private narrativeStateService = inject(NarrativeStateService);

  constructor(public nictizService: NictizService) {
    // Auto-save state whenever signals change (but only after initialization)
    effect(() => {
      const profileUrl = this.selectedProfileUrl();
      const profileTitle = this.selectedProfileTitle();
      const content = this.editorContent();
      const error = this.templateError();

      // Only save state after component is fully initialized
      if (this.isInitialized) {
        this.narrativeStateService.setState(profileUrl, profileTitle, content, error);
      }
    }, {allowSignalWrites: true});
  }

  async ngOnInit() {
    // First load profiles and templates directory
    await this.nictizService.fetchStructureDefinitions();
    await this.loadTemplatesDir();

    // Then restore state if it exists (after profiles are loaded)
    if (this.narrativeStateService.hasContent()) {
      const savedProfileUrl = this.narrativeStateService.selectedProfileUrl();
      const savedProfileTitle = this.narrativeStateService.selectedProfileTitle();
      const savedContent = this.narrativeStateService.editorContent();
      const savedError = this.narrativeStateService.templateError();

      // Verify the saved profile still exists in the loaded profiles
      const profileExists = this.nictizService.structureDefinitions().some(p => p.url === savedProfileUrl);

      if (profileExists && savedProfileUrl) {
        // Restore all state
        this.selectedProfileUrl.set(savedProfileUrl);
        this.selectedProfileTitle.set(savedProfileTitle);
        this.editorContent.set(savedContent);
        this.templateError.set(savedError);
      }
    }

    // Mark initialization as complete - now effects can save state
    this.isInitialized = true;
  }

  /**
   * Load the templates directory path
   */
  async loadTemplatesDir() {

    try {
      const dir = await window.electronAPI?.narrativeTemplates?.getDir();

      if (dir) {
        this.templatesDir.set(dir);
      }
    } catch (error) {
      console.error('Failed to get templates directory:', error);
    }
  }

  /**
   * Handles profile selection change from dropdown
   */
  async onProfileChange(event: Event) {

    const value = (event.target as HTMLSelectElement).value;
    this.selectedProfileUrl.set(value);

    if (value) {

      const profile = this.nictizService.structureDefinitions().find(p => p.url === value);

      if (profile) {
        this.selectedProfileTitle.set(profile.title);
        await this.loadTemplate(profile.title);
      }
    } else {

      this.selectedProfileTitle.set('');
      this.editorContent.set('');
      this.templateError.set(null);
    }
  }

  /**
   * Loads the template for the selected profile
   */
  async loadTemplate(profileTitle: string) {

    this.loadingTemplate.set(true);
    this.templateError.set(null);
    this.editorContent.set('');

    try {

      const result = await window.electronAPI?.narrativeTemplates?.get(profileTitle);

      if (result) {
        this.editorContent.set(result.content);
      } else {
        // No template found - show info toast
        this.toastService.info(`No template found for "${profileTitle}". Click Create to add one.`);
      }
    } catch (err: any) {
      this.templateError.set(err.message || 'Failed to load template');
    } finally {
      this.loadingTemplate.set(false);
    }
  }

  /**
   * Returns sorted list of profiles by formatted title
   */
  getSortedProfiles() {

    return [...this.nictizService.structureDefinitions()]
      .sort((a, b) => {
        const titleA = this.formatTitle(a.title);
        const titleB = this.formatTitle(b.title);

        return titleA.localeCompare(titleB);
      });
  }

  /**
   * Gets formatted display name for a profile
   */
  getProfileDisplayName(title: string): string {
    return this.formatTitle(title);
  }

  /**
   * Formats profile title by removing Dutch healthcare standard prefixes
   */
  formatTitle(title: string): string {

    let entity = title;

    if (title.startsWith('HCIM')) {
      entity = title.replace('HCIM ', '').trim();
    } else if (title.startsWith('nl-core-')) {
      const label = title.replace('nl-core-', '').trim();
      entity = label.charAt(0).toUpperCase() + label.slice(1);
    } else if (title.startsWith('Zib ')) {
      entity = title.replace(/^Zib\s+/i, '').trim();
    }

    return entity;
  }

  /**
   * Opens the narrative editor dialog
   */
  openNarrativeEditor() {
    this.narrativeEditorDialog.open(this.editorContent());
  }

  /**
   * Handles save event from the narrative editor dialog
   */
  async onNarrativeSave(event: { narrative: string }) {
    const profileTitle = this.selectedProfileTitle();

    if (!profileTitle) {
      return;
    }

    try {

      await window.electronAPI?.narrativeTemplates?.set(profileTitle, event.narrative);
      this.editorContent.set(event.narrative);
      this.templateError.set(null);

    } catch (err: any) {
      this.templateError.set(err.message || 'Failed to save template');
    }
  }
}
