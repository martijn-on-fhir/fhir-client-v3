import { Injectable, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';

/**
 * Registration information for a Monaco editor
 */
interface EditorRegistration {
  component: MonacoEditorComponent;
  isEditable: boolean;
  route: string;
}

/**
 * Service for managing Monaco editor state across tabs
 *
 * This service tracks which Monaco editors are registered,
 * which tab is currently active, and provides methods to
 * get/set editor content for the active editor.
 */
@Injectable({
  providedIn: 'root'
})
export class EditorStateService {
  private router = inject(Router);

  // Store editor registrations by route
  private editors = new Map<string, EditorRegistration>();

  // Track current active route
  private activeRoute = signal<string>('');

  constructor() {
    // Subscribe to router events to track active route
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map(e => e.urlAfterRedirects)
      )
      .subscribe(url => {
        this.activeRoute.set(url);
      });

    // Set initial route
    this.activeRoute.set(this.router.url);
  }

  /**
   * Register a Monaco editor for a specific route
   *
   * @param component Monaco editor component instance
   * @param isEditable Whether the editor is editable (not read-only)
   * @param route Route path for this editor (e.g., '/app/validator')
   */
  registerEditor(component: MonacoEditorComponent, isEditable: boolean, route: string): void {
    this.editors.set(route, { component, isEditable, route });
  }

  /**
   * Unregister an editor for a specific route
   *
   * @param route Route path to unregister
   */
  unregisterEditor(route: string): void {
    this.editors.delete(route);
  }

  /**
   * Get the content from the currently active editor
   *
   * @returns Editor content as string, or null if no editor is active
   */
  getEditorContent(): string | null {
    const editor = this.getActiveEditor();
    if (!editor?.component?.editor) {
      return null;
    }

    return editor.component.editor.getValue();
  }

  /**
   * Set the content in the currently active editor
   *
   * @param content Content to set
   */
  setEditorContent(content: string): void {
    const editor = this.getActiveEditor();
    if (!editor?.component?.editor) {
      return;
    }

    editor.component.editor.setValue(content);
  }

  /**
   * Check if the current tab has a Monaco editor that can be saved
   *
   * @returns True if active tab has a Monaco editor
   */
  canSave(): boolean {
    const editor = this.getActiveEditor();
    return editor?.component?.editor != null;
  }

  /**
   * Check if the current tab has an editable Monaco editor
   *
   * @returns True if active tab has an editable Monaco editor
   */
  canOpen(): boolean {
    const editor = this.getActiveEditor();
    return editor?.component?.editor != null && editor.isEditable;
  }

  /**
   * Get the editor registration for the currently active route
   *
   * @returns Editor registration or undefined if no editor for current route
   */
  private getActiveEditor(): EditorRegistration | undefined {
    const currentRoute = this.activeRoute();

    // Try exact match first
    if (this.editors.has(currentRoute)) {
      return this.editors.get(currentRoute);
    }

    // Try to find a route that the current URL starts with
    // This handles nested routes (e.g., /app/query/details)
    for (const [route, registration] of this.editors.entries()) {
      if (currentRoute.startsWith(route)) {
        return registration;
      }
    }

    return undefined;
  }
}
