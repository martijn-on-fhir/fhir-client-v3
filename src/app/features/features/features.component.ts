import { CommonModule } from '@angular/common';
import { Component, signal, inject, OnInit, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QueryAutocompleteService, Suggestion, ParsedQuery } from '../../core/services/query-autocomplete.service';
import { FhirService } from '../../core/services/fhir.service';
import { firstValueFrom } from 'rxjs';

/**
 * Features Component
 *
 * Proof of concept playground for testing new features
 * before integrating them into the main application.
 *
 * Current POC: FHIR Query Autocomplete
 */
@Component({
  selector: 'app-features',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './features.component.html',
  styleUrl: './features.component.scss'
})
export class FeaturesComponent implements OnInit {
  private autocompleteService = inject(QueryAutocompleteService);
  private fhirService = inject(FhirService);

  @ViewChild('queryInput') queryInput!: ElementRef<HTMLInputElement>;

  /** Current query input */
  query = signal<string>('/');

  /** Autocomplete suggestions */
  suggestions = signal<Suggestion[]>([]);

  /** Show/hide suggestions dropdown */
  showSuggestions = signal<boolean>(false);

  /** Currently selected suggestion index */
  selectedIndex = signal<number>(-1);

  /** Parsed query info for debug display */
  parsedQuery = signal<ParsedQuery | null>(null);

  /** Loading state for metadata */
  metadataLoading = signal<boolean>(true);

  /** Error message */
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.loadMetadata();
    // Trigger initial suggestions
    this.updateSuggestions();
  }

  /**
   * Load metadata from FHIR server
   */
  private async loadMetadata(): Promise<void> {
    try {
      this.metadataLoading.set(true);
      this.error.set(null);

      // Try to get cached metadata first
      const cached = await window.electronAPI?.metadata?.get();
      if (cached) {
        this.autocompleteService.setMetadata(cached);
        this.metadataLoading.set(false);
        return;
      }

      // Fetch from server
      const metadata = await firstValueFrom(this.fhirService.getMetadata());
      this.autocompleteService.setMetadata(metadata);
      this.metadataLoading.set(false);
    } catch (err) {
      this.error.set('Failed to load metadata. Autocomplete will have limited functionality.');
      this.metadataLoading.set(false);
    }
  }

  /**
   * Handle input changes - triggers autocomplete
   */
  onQueryChange(value: string): void {
    this.query.set(value);
    this.updateSuggestions();
  }

  /**
   * Update suggestions based on current query and cursor position
   */
  private updateSuggestions(): void {
    const input = this.queryInput?.nativeElement;
    const cursorPosition = input?.selectionStart ?? this.query().length;

    const parsed = this.autocompleteService.parseQuery(this.query(), cursorPosition);
    this.parsedQuery.set(parsed);

    const suggestions = this.autocompleteService.getSuggestions(parsed);
    this.suggestions.set(suggestions.slice(0, 15)); // Limit to 15 suggestions
    this.selectedIndex.set(-1);

    // Show suggestions if we have any
    this.showSuggestions.set(suggestions.length > 0);
  }

  /**
   * Handle keyboard navigation in suggestions
   */
  onKeyDown(event: KeyboardEvent): void {
    const suggestions = this.suggestions();
    const currentIndex = this.selectedIndex();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (suggestions.length > 0) {
          this.selectedIndex.set(Math.min(currentIndex + 1, suggestions.length - 1));
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (suggestions.length > 0) {
          this.selectedIndex.set(Math.max(currentIndex - 1, -1));
        }
        break;

      case 'Enter':
        if (currentIndex >= 0 && currentIndex < suggestions.length) {
          event.preventDefault();
          this.selectSuggestion(suggestions[currentIndex]);
        }
        break;

      case 'Tab':
        if (suggestions.length > 0 && currentIndex === -1) {
          event.preventDefault();
          this.selectSuggestion(suggestions[0]);
        } else if (currentIndex >= 0) {
          event.preventDefault();
          this.selectSuggestion(suggestions[currentIndex]);
        }
        break;

      case 'Escape':
        this.showSuggestions.set(false);
        this.selectedIndex.set(-1);
        break;
    }
  }

  /**
   * Handle input event (for cursor position changes)
   */
  onInput(): void {
    this.updateSuggestions();
  }

  /**
   * Handle click in input (cursor position may change)
   */
  onClick(): void {
    this.updateSuggestions();
  }

  /**
   * Select a suggestion
   */
  selectSuggestion(suggestion: Suggestion): void {
    const input = this.queryInput?.nativeElement;
    const cursorPosition = input?.selectionStart ?? this.query().length;

    const result = this.autocompleteService.applySuggestion(
      this.query(),
      cursorPosition,
      suggestion
    );

    this.query.set(result.newQuery);
    this.showSuggestions.set(false);
    this.selectedIndex.set(-1);

    // Set cursor position after Angular updates the input
    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
        // Trigger new suggestions after selection
        this.updateSuggestions();
      }
    }, 0);
  }

  /**
   * Handle focus - show suggestions
   */
  onFocus(): void {
    this.updateSuggestions();
  }

  /**
   * Handle blur - hide suggestions (with delay for click handling)
   */
  onBlur(): void {
    setTimeout(() => {
      this.showSuggestions.set(false);
    }, 200);
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    switch (category) {
      case 'resource': return 'fa-cube';
      case 'parameter': return 'fa-filter';
      case 'global': return 'fa-globe';
      case 'modifier': return 'fa-at';
      case 'operator': return 'fa-equals';
      case 'value': return 'fa-tag';
      default: return 'fa-circle';
    }
  }

  /**
   * Get category color class
   */
  getCategoryClass(category: string): string {
    switch (category) {
      case 'resource': return 'text-primary';
      case 'parameter': return 'text-success';
      case 'global': return 'text-info';
      case 'modifier': return 'text-warning';
      case 'operator': return 'text-danger';
      case 'value': return 'text-secondary';
      default: return 'text-muted';
    }
  }
}
