import { Injectable, signal, computed } from '@angular/core';

/**
 * Narrative State Service
 *
 * Persists narratives component state across tab navigation.
 * Stores selected profile and editor content in memory.
 */
@Injectable({
  providedIn: 'root'
})
export class NarrativeStateService {

  // Selected profile URL
  private selectedProfileUrlSignal = signal<string>('');

  // Selected profile title
  private selectedProfileTitleSignal = signal<string>('');

  // Editor content
  private editorContentSignal = signal<string>('');

  // Template error
  private templateErrorSignal = signal<string | null>(null);

  /**
   * Read-only computed for selected profile URL
   */
  readonly selectedProfileUrl = computed(() => this.selectedProfileUrlSignal());

  /**
   * Read-only computed for selected profile title
   */
  readonly selectedProfileTitle = computed(() => this.selectedProfileTitleSignal());

  /**
   * Read-only computed for editor content
   */
  readonly editorContent = computed(() => this.editorContentSignal());

  /**
   * Read-only computed for template error
   */
  readonly templateError = computed(() => this.templateErrorSignal());

  /**
   * Store selected profile URL
   */
  setSelectedProfileUrl(url: string) {
    this.selectedProfileUrlSignal.set(url);
  }

  /**
   * Store selected profile title
   */
  setSelectedProfileTitle(title: string) {
    this.selectedProfileTitleSignal.set(title);
  }

  /**
   * Store editor content
   */
  setEditorContent(content: string) {
    this.editorContentSignal.set(content);
  }

  /**
   * Store template error
   */
  setTemplateError(error: string | null) {
    this.templateErrorSignal.set(error);
  }

  /**
   * Store all state at once
   */
  setState(profileUrl: string, profileTitle: string, content: string, error: string | null) {
    this.selectedProfileUrlSignal.set(profileUrl);
    this.selectedProfileTitleSignal.set(profileTitle);
    this.editorContentSignal.set(content);
    this.templateErrorSignal.set(error);
  }

  /**
   * Clear all state
   */
  clearState() {
    this.selectedProfileUrlSignal.set('');
    this.selectedProfileTitleSignal.set('');
    this.editorContentSignal.set('');
    this.templateErrorSignal.set(null);
  }

  /**
   * Check if there's stored content
   */
  hasContent(): boolean {
    return this.selectedProfileUrlSignal().length > 0 || this.editorContentSignal().length > 0;
  }
}
