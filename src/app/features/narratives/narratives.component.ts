import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NictizService } from '../../core/services/nictiz.service';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';
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
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ResultHeaderComponent],
  templateUrl: './narratives.component.html',
  styleUrl: './narratives.component.scss'
})
export class NarrativesComponent implements OnInit {

  /** Reference to Monaco editor component */
  @ViewChild('monacoEditor') monacoEditor!: MonacoEditorComponent;

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

  constructor(public nictizService: NictizService) {}

  async ngOnInit() {
    await this.nictizService.fetchStructureDefinitions();
    await this.loadTemplatesDir();
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
        // No template found - show message but not as an error
        this.templateError.set(`No template found for "${profileTitle}". Click Create to add one.`);
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
}
