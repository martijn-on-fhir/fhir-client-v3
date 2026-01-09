/**
 * Template Service - Manages smart query templates
 *
 * Handles loading, saving, and managing query templates
 * with localStorage persistence for custom templates
 */

import { Injectable, signal, inject } from '@angular/core';
import { SmartQueryTemplate, SYSTEM_TEMPLATES, TemplateCategory } from '../models/smart-template.model';
import { LoggerService } from './logger.service';

const CUSTOM_TEMPLATES_KEY = 'smart-templates-custom';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private customTemplates = signal<SmartQueryTemplate[]>([]);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('TemplateService');

  constructor() {
    this.loadCustomTemplates();
  }

  /**
   * Get all templates (system + custom)
   */
  getAllTemplates(): SmartQueryTemplate[] {
    return [...SYSTEM_TEMPLATES, ...this.customTemplates()];
  }

  /**
   * Get templates filtered by category and search query
   */
  getFilteredTemplates(category: TemplateCategory | 'all', searchQuery: string): SmartQueryTemplate[] {
    let templates = this.getAllTemplates();

    // Filter by category
    if (category !== 'all') {
      templates = templates.filter(t => t.category === category);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return templates;
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): SmartQueryTemplate | undefined {
    return this.getAllTemplates().find(t => t.id === id);
  }

  /**
   * Save a custom template
   */
  saveTemplate(template: SmartQueryTemplate): void {
    const customs = this.customTemplates();
    const existingIndex = customs.findIndex(t => t.id === template.id);

    if (existingIndex >= 0) {
      // Update existing
      customs[existingIndex] = { ...template, updatedAt: new Date().toISOString() };
    } else {
      // Add new
      customs.push({ ...template, createdAt: new Date().toISOString() });
    }

    this.customTemplates.set([...customs]);
    this.persistCustomTemplates();
  }

  /**
   * Delete a custom template
   */
  deleteTemplate(id: string): boolean {
    const template = this.getTemplate(id);
    if (template?.isSystem) {
      return false; // Cannot delete system templates
    }

    const customs = this.customTemplates().filter(t => t.id !== id);
    this.customTemplates.set(customs);
    this.persistCustomTemplates();
    return true;
  }

  /**
   * Increment usage count for a template
   */
  incrementUsageCount(id: string): void {
    const template = this.getTemplate(id);
    if (!template) {
return;
}

    if (template.isSystem) {
      // For system templates, track in separate counter
      const counters = this.getUsageCounters();
      counters[id] = (counters[id] || 0) + 1;
      localStorage.setItem('template-usage-counters', JSON.stringify(counters));
    } else {
      // For custom templates, update the template itself
      template.usageCount = (template.usageCount || 0) + 1;
      this.saveTemplate(template);
    }
  }

  /**
   * Get usage count for a template
   */
  getUsageCount(id: string): number {
    const template = this.getTemplate(id);
    if (!template) {
return 0;
}

    if (template.isSystem) {
      const counters = this.getUsageCounters();
      return counters[id] || 0;
    }

    return template.usageCount || 0;
  }

  /**
   * Load custom templates from localStorage
   */
  private loadCustomTemplates(): void {
    try {
      const stored = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      if (stored) {
        const templates = JSON.parse(stored) as SmartQueryTemplate[];
        this.customTemplates.set(templates);
      }
    } catch (error) {
      this.logger.error('Failed to load custom templates:', error);
      this.customTemplates.set([]);
    }
  }

  /**
   * Persist custom templates to localStorage
   */
  private persistCustomTemplates(): void {
    try {
      localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(this.customTemplates()));
    } catch (error) {
      this.logger.error('Failed to persist custom templates:', error);
    }
  }

  /**
   * Get usage counters for system templates
   */
  private getUsageCounters(): Record<string, number> {
    try {
      const stored = localStorage.getItem('template-usage-counters');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Generate unique ID for new template
   */
  generateId(): string {
    return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export a template to a JSON file
   */
  async exportTemplate(template: SmartQueryTemplate): Promise<void> {
    const electronAPI = (window as any).electronAPI;

    if (!electronAPI?.file?.saveFile) {
      throw new Error('File operations not available - not running in Electron environment');
    }

    try {
      // Create clean export (remove runtime properties)
      const exportData: Partial<SmartQueryTemplate> = {
        name: template.name,
        description: template.description,
        category: template.category,
        queryTemplate: template.queryTemplate,
        parameters: template.parameters,
        tags: template.tags,
        author: template.author,
        version: template.version
      };

      const content = JSON.stringify(exportData, null, 2);
      const defaultFileName = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

      const result = await electronAPI.file.saveFile(content, defaultFileName);

      if (result?.success) {
        this.logger.info('Template exported:', result.path);
      } else if (result?.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      this.logger.error('Failed to export template:', error);
      throw error;
    }
  }

  /**
   * Import a template from a JSON file
   */
  async importTemplate(): Promise<SmartQueryTemplate | null> {
    const electronAPI = (window as any).electronAPI;

    if (!electronAPI?.file?.openFile) {
      throw new Error('File operations not available - not running in Electron environment');
    }

    try {
      const result = await electronAPI.file.openFile();

      if (!result) {
        return null; // User canceled
      }

      if (result.error) {
        throw new Error(result.error);
      }

      // Parse and validate template
      const imported = JSON.parse(result.content) as Partial<SmartQueryTemplate>;

      if (!imported.name || !imported.queryTemplate || !imported.category) {
        throw new Error('Invalid template file: missing required fields');
      }

      // Create new template with fresh ID
      const newTemplate: SmartQueryTemplate = {
        id: this.generateId(),
        name: imported.name,
        description: imported.description || '',
        category: imported.category,
        queryTemplate: imported.queryTemplate,
        parameters: imported.parameters || [],
        tags: imported.tags || [],
        author: imported.author || 'Unknown',
        version: imported.version || '1.0.0',
        isSystem: false,
        createdAt: new Date().toISOString()
      };

      // Save to custom templates
      this.saveTemplate(newTemplate);
      this.logger.info('Template imported:', newTemplate.name);

      return newTemplate;
    } catch (error) {
      this.logger.error('Failed to import template:', error);
      throw error;
    }
  }


  /**
   * Process template with parameter values
   */
  renderTemplate(template: SmartQueryTemplate, values: Record<string, string>): string {
    let query = template.queryTemplate;

    // First, process special tokens in parameter values
    const processedValues: Record<string, string> = {};

    Object.entries(values).forEach(([key, value]) => {
      processedValues[key] = this.processSpecialTokens(value);
    });

    // Replace parameters
    template.parameters.forEach(param => {
      const value = processedValues[param.name] || '';
      const placeholder = new RegExp(`{{${param.name}}}`, 'g');
      query = query.replace(placeholder, encodeURIComponent(value));
    });

    // Clean up empty parameters (remove &param= or ?param=)
    query = query.replace(/[?&][^=]+==?(&|$)/g, (match, end) => end === '&' ? '&' : '');
    query = query.replace(/[?&]$/, ''); // Remove trailing ? or &

    return query;
  }

  /**
   * Process special tokens in a value
   * Supports: {{today}}, {{today-N}}, {{today+N}}, {{now}}, {{uuid}}
   */
  private processSpecialTokens(value: string): string {

    if (!value) {
      return value;
    }

    let processed = value;

    // {{today}} → current date (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    processed = processed.replace(/\{\{today\}\}/g, today);

    // {{today-N}} → N days ago (YYYY-MM-DD)
    processed = processed.replace(/\{\{today-(\d+)\}\}/g, (_, days) => {
      const date = new Date();
      date.setDate(date.getDate() - parseInt(days, 10));
      return date.toISOString().split('T')[0];
    });

    // {{today+N}} → N days from now (YYYY-MM-DD)
    processed = processed.replace(/\{\{today\+(\d+)\}\}/g, (_, days) => {
      const date = new Date();
      date.setDate(date.getDate() + parseInt(days, 10));
      return date.toISOString().split('T')[0];
    });

    // {{now}} → current ISO datetime
    processed = processed.replace(/\{\{now\}\}/g, () => new Date().toISOString());

    // {{uuid}} → random UUID
    processed = processed.replace(/\{\{uuid\}\}/g, () => {

      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      // Fallback UUID generation for older browsers
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    });

    return processed;
  }
}
