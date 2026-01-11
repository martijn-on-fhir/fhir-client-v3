import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { JsonViewerToolbarComponent } from '../json-viewer-toolbar/json-viewer-toolbar.component';

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
}
