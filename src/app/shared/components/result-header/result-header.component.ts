import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { JsonViewerToolbarComponent } from '../json-viewer-toolbar/json-viewer-toolbar.component';

/**
 * FHIR Bundle link for pagination
 * Note: FHIR spec uses 'previous' but some servers use 'prev'
 */
export interface BundleLink {
  relation: 'self' | 'first' | 'previous' | 'prev' | 'next' | 'last';
  url: string;
}

/**
 * Result Header Component
 *
 * Reusable header component for result panels across different tabs.
 * Provides consistent styling and layout with optional Monaco editor toolbar.
 *
 * Features:
 * - Customizable icon and title
 * - Optional Monaco editor toolbar integration
 * - Content projection for badges and extra actions
 * - Flexible styling options (padding, flex-shrink)
 *
 * @example
 * ```html
 * <app-result-header
 *   icon="fa-check-circle"
 *   title="Fhir Validator"
 *   [editor]="component?.editor"
 *   [readOnly]="false">
 * </app-result-header>
 * ```
 *
 * @example With badge
 * ```html
 * <app-result-header
 *   icon="fa-list"
 *   title="Application Logs"
 *   [showToolbar]="false">
 *   <span slot="title-suffix" class="badge bg-success ms-2">
 *     <i class="fas fa-eye me-1"></i>Live
 *   </span>
 * </app-result-header>
 * ```
 */
@Component({
  selector: 'app-result-header',
  standalone: true,
  imports: [CommonModule, JsonViewerToolbarComponent],
  templateUrl: './result-header.component.html',
  styleUrl: './result-header.component.scss'
})
export class ResultHeaderComponent {
  /**
   * FontAwesome icon class (without 'fas' prefix)
   * @example 'fa-check-circle', 'fa-sitemap', 'fa-shapes'
   */
  @Input() icon!: string;

  /**
   * Header title text
   * @example 'Fhir Validator', 'Results', 'Application Logs'
   */
  @Input() title!: string;

  /**
   * Whether to show the Monaco editor toolbar
   * Set to false for headers without editor functionality (e.g., Logs)
   * @default true
   */
  @Input() showToolbar = true;

  /**
   * Monaco editor instance for toolbar integration
   * Pass the editor from ViewChild reference
   * @example this.component?.editor
   */
  @Input() editor?: any;

  /**
   * Whether the editor is in read-only mode
   * Controls toolbar functionality (save/load buttons)
   * @default true
   */
  @Input() readOnly = true;

  /**
   * Apply flex-shrink: 0 style to prevent header from shrinking
   * @default true
   */
  @Input() flexShrink = true;

  /**
   * Padding size for the header
   * - 'default': Standard Bootstrap padding
   * - 'small': Reduced padding (p-2)
   * @default 'default'
   */
  @Input() padding: 'default' | 'small' = 'default';

  /**
   * FHIR Bundle pagination links
   * Contains URLs for first, previous, next, last pages
   */
  @Input() paginationLinks: BundleLink[] = [];

  /**
   * Total number of results in the Bundle
   */
  @Input() total?: number;

  /**
   * Query execution time in milliseconds
   */
  @Input() executionTime?: number | null;

  /**
   * Response size in bytes
   */
  @Input() responseSize?: number | null;

  /**
   * Event emitted when the timing badge is clicked
   * Opens the request inspector dialog
   */
  @Output() timingClicked = new EventEmitter<void>();

  /**
   * Event emitted when user navigates to a page via pagination
   * Emits the URL to navigate to
   */
  @Output() pageNavigate = new EventEmitter<string>();

  /**
   * Whether to show the edit button in the toolbar
   * Should be true for single FHIR resources, false for Bundles
   * @default false
   */
  @Input() showEditButton = false;

  /**
   * Event emitted when the edit button is clicked
   */
  @Output() editClicked = new EventEmitter<void>();

  /**
   * Whether to show the delete button in the toolbar
   * Should be true for single FHIR resources, false for Bundles
   * @default false
   */
  @Input() showDeleteButton = false;

  /**
   * Event emitted when the delete button is clicked
   */
  @Output() deleteClicked = new EventEmitter<void>();

  /**
   * Whether to show the compare button in the toolbar
   * Should be true for single FHIR resources, false for Bundles
   * @default false
   */
  @Input() showCompareButton = false;

  /**
   * Event emitted when the compare button is clicked
   */
  @Output() compareClicked = new EventEmitter<void>();

  /**
   * Whether to show the copy as cURL button in the toolbar
   * Should be true when a query has been executed
   * @default false
   */
  @Input() showCopyAsCurl = false;

  /**
   * Event emitted when the copy as cURL button is clicked
   */
  @Output() copyAsCurlClicked = new EventEmitter<void>();

  /**
   * Whether to show the $everything button in the toolbar
   * Should be true for Patient or Encounter resources
   * @default false
   */
  @Input() showEverythingButton = false;

  /**
   * Event emitted when the $everything button is clicked
   */
  @Output() everythingClicked = new EventEmitter<void>();

  /**
   * Check if a specific pagination link exists
   * Handles 'prev'/'previous' interchangeably
   */
  hasLink(relation: string): boolean {
    if (relation === 'previous') {
      return this.paginationLinks.some(link => link.relation === 'previous' || link.relation === 'prev');
    }

    return this.paginationLinks.some(link => link.relation === relation);
  }

  /**
   * Get URL for a specific pagination link
   * Handles 'prev'/'previous' interchangeably
   */
  getLink(relation: string): string | undefined {
    if (relation === 'previous') {
      return this.paginationLinks.find(link => link.relation === 'previous' || link.relation === 'prev')?.url;
    }

    return this.paginationLinks.find(link => link.relation === relation)?.url;
  }

  /**
   * Navigate to a specific page
   */
  navigateTo(relation: string): void {
    const url = this.getLink(relation);

    if (url) {
      this.pageNavigate.emit(url);
    }
  }

  /**
   * Get badge color class based on execution time
   * Green: <500ms, Yellow: <2000ms, Red: >=2000ms
   */
  getTimingBadgeClass(): string {
    if (this.executionTime === null || this.executionTime === undefined) {
      return 'bg-secondary';
    }

    if (this.executionTime < 500) {
      return 'bg-success';
    } else if (this.executionTime < 2000) {
      return 'bg-warning text-dark';
    } else {
      return 'bg-danger';
    }
  }

  /**
   * Format response size for display
   * Returns formatted string with appropriate unit (B, KB, MB)
   */
  formatResponseSize(): string {
    if (this.responseSize === null || this.responseSize === undefined) {
      return '';
    }

    if (this.responseSize < 1024) {
      return `${this.responseSize} B`;
    } else if (this.responseSize < 1024 * 1024) {
      return `${(this.responseSize / 1024).toFixed(1)} KB`;
    } else {
      return `${(this.responseSize / (1024 * 1024)).toFixed(2)} MB`;
    }
  }
}
