import { CommonModule, KeyValuePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { SmartQueryTemplate, TemplateCategory, getCategoryInfo, CATEGORIES } from '../../../core/models/smart-template.model';

/**
 * Template Browser Component
 *
 * Browse, search, and select smart query templates.
 * Displays templates organized by category with accordion and search functionality.
 */
@Component({
  selector: 'app-template-browser',
  standalone: true,
  imports: [CommonModule, KeyValuePipe],
  templateUrl: './template-browser.component.html',
  styleUrl: './template-browser.component.scss'
})
export class TemplateBrowserComponent {
  @Input() set templates(value: SmartQueryTemplate[]) {
    this._templates.set(value || []);
  }
  get templates(): SmartQueryTemplate[] {
    return this._templates();
  }
  @Input() selectedTemplate: SmartQueryTemplate | null = null;
  @Input() set searchQuery(value: string) {
    this._searchQuery.set(value || '');
  }
  @Input() set selectedCategory(value: TemplateCategory | 'all') {
    this._selectedCategory.set(value || 'all');
  }
  @Output() selectTemplate = new EventEmitter<SmartQueryTemplate>();
  @Output() editTemplate = new EventEmitter<SmartQueryTemplate>();
  @Output() deleteTemplate = new EventEmitter<SmartQueryTemplate>();
  @Output() exportTemplate = new EventEmitter<SmartQueryTemplate>();

  // Internal signals for reactive inputs
  private _templates = signal<SmartQueryTemplate[]>([]);
  private _searchQuery = signal('');
  private _selectedCategory = signal<TemplateCategory | 'all'>('all');

  // Expanded categories (accordion state)
  expandedCategories = signal(new Set<string>(['patient-care']));

  // Helper to get category info
  getCategoryInfo = getCategoryInfo;

  // All categories
  allCategories = CATEGORIES;

  // Group templates by category
  // Show all categories only when no filter is active (all + no search)
  groupedTemplates = computed(() => {
    const groups = new Map<TemplateCategory, SmartQueryTemplate[]>();
    const templates = this._templates();
    const category = this._selectedCategory();
    const search = this._searchQuery();
    const showAllCategories = category === 'all' && !search;

    if (showAllCategories) {
      // Initialize all categories with empty arrays when showing everything
      CATEGORIES.forEach(cat => {
        groups.set(cat.id, []);
      });
    }

    // Fill with actual templates
    templates.forEach(template => {
      const existing = groups.get(template.category) || [];
      existing.push(template);
      groups.set(template.category, existing);
    });

    return groups;
  });

  /**
   * Toggle category expansion
   */
  toggleCategory(categoryId: string) {
    this.expandedCategories.update(expanded => {
      const newExpanded = new Set(expanded);

      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }

      return newExpanded;
    });
  }

  /**
   * Check if category is expanded
   */
  isCategoryExpanded(categoryId: string): boolean {
    return this.expandedCategories().has(categoryId);
  }

  /**
   * Handle template selection
   */
  onSelectTemplate(template: SmartQueryTemplate) {
    this.selectTemplate.emit(template);
  }

  /**
   * Handle template edit
   */
  onEditTemplate(event: Event, template: SmartQueryTemplate) {
    event.stopPropagation();
    this.editTemplate.emit(template);
  }

  /**
   * Handle template delete
   */
  onDeleteTemplate(event: Event, template: SmartQueryTemplate) {
    event.stopPropagation();
    this.deleteTemplate.emit(template);
  }

  /**
   * Handle template export
   */
  onExportTemplate(event: Event, template: SmartQueryTemplate) {
    event.stopPropagation();
    this.exportTemplate.emit(template);
  }

  /**
   * Track by for templates
   */
  trackByTemplateId(_index: number, template: SmartQueryTemplate): string {
    return template.id;
  }

  /**
   * Track by for category entries
   */
  trackByCategoryKey(_index: number, entry: any): string {
    return entry.key;
  }
}
