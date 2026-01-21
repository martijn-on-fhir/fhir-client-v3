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

  /** Loading state while fetching profile */
  loadingProfile = signal<boolean>(false);

  /** Error message from profile loading */
  profileError = signal<string | null>(null);

  /** Content to display in the editor */
  editorContent = signal<string>('');

  constructor(public nictizService: NictizService) {}

  async ngOnInit() {
    await this.nictizService.fetchStructureDefinitions();
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
        await this.fetchStructureDefinition(value);
      }
    } else {
      this.selectedProfileTitle.set('');
      this.editorContent.set('');
    }
  }

  /**
   * Fetches the StructureDefinition and displays it in the editor
   */
  async fetchStructureDefinition(profileUrl: string) {
    this.loadingProfile.set(true);
    this.profileError.set(null);
    this.editorContent.set('');

    try {
      const sd = await this.nictizService.fetchSingleStructureDefinition(profileUrl);

      if (sd) {
        this.editorContent.set(JSON.stringify(sd, null, 2));
      } else {
        this.profileError.set('StructureDefinition not available.');
      }
    } catch (err: any) {
      this.profileError.set(err.message || 'Failed to fetch StructureDefinition');
    } finally {
      this.loadingProfile.set(false);
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
