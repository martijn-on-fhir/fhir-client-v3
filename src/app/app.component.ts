import { Component, OnInit, ViewChild, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationService } from './core/services/navigation.service';
import { NictizService } from './core/services/nictiz.service';
import { ThemeService } from './core/services/theme.service';
import { mergeProfileElements } from './core/utils/profile-merge';
import { ResourceEditorDialogComponent } from './shared/components/resource-editor-dialog/resource-editor-dialog.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, ResourceEditorDialogComponent],
  template: `
    <router-outlet></router-outlet>
    <app-toast-container />
    <app-resource-editor-dialog></app-resource-editor-dialog>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  @ViewChild(ResourceEditorDialogComponent) editorDialog!: ResourceEditorDialogComponent;

  private themeService = inject(ThemeService);
  private navigationService = inject(NavigationService);
  private nictizService = inject(NictizService);

  constructor() {
    // Listen for edit resource events
    effect(() => {
      const event = this.navigationService.editResourceEvent();

      if (event?.resource) {
        // Wait for ViewChild to be available
        setTimeout(() => {
          this.openEditorWithResource(event.resource);
          this.navigationService.clearEditResourceEvent();
        }, 0);
      }
    });
  }

  ngOnInit() {
    // Theme service initializes on app start
    // Auth state is checked by guards when navigating
  }

  /**
   * Opens the resource editor dialog with an existing resource
   * Fetches the StructureDefinition based on the profile URL if available
   * Uses caching and merges with base definitions for complete element list
   */
  private async openEditorWithResource(resource: any) {
    if (!resource?.resourceType || !this.editorDialog) {
      return;
    }

    // Check if resource has a profile URL in meta.profile
    const profileUrl = resource.meta?.profile?.[0];

    if (profileUrl) {
      // Extract profile title from URL for cache key
      const profileTitle = profileUrl.split('/').pop() || profileUrl;

      // 1. Check cache first
      const cached = await window.electronAPI?.profileCache?.getProfile(profileTitle);

      if (cached) {
        const fullSD = {
          ...cached.profile,
          snapshot: {
            element: cached.mergedElements || []
          }
        };
        this.editorDialog.open(fullSD, resource);

        return;
      }

      // 2. Fetch StructureDefinition from server
      const sd = await this.nictizService.fetchSingleStructureDefinition(profileUrl);

      if (sd) {
        // 3. Fetch base definition chain and merge elements
        let baseChain: any[] = [];

        if (sd.baseDefinition) {
          baseChain = await this.nictizService.fetchBaseDefinitionChain(sd.baseDefinition);
        }

        const mergedElements = mergeProfileElements(sd, baseChain);

        // 4. Create full SD with merged elements
        const fullSD = {
          ...sd,
          snapshot: {
            element: mergedElements
          }
        };

        // 5. Cache for future use
        try {
          await window.electronAPI?.profileCache?.setProfile(profileTitle, {
            profile: {
              id: sd.id,
              url: sd.url,
              name: sd.name,
              type: sd.type,
              title: sd.title || sd.name,
              description: sd.description,
              purpose: sd.purpose,
              baseDefinition: sd.baseDefinition,
            },
            baseChain: baseChain.map((bd) => ({
              name: bd.name,
              url: bd.url,
            })),
            mergedElements,
            constraints: [],
          });
        } catch {
          // Caching failure is not critical
        }

        this.editorDialog.open(fullSD, resource);

        return;
      }
    }

    // Fallback: Create a minimal StructureDefinition for the resource type
    const minimalSD = {
      resourceType: 'StructureDefinition',
      id: resource.resourceType,
      type: resource.resourceType,
      name: resource.resourceType,
      title: resource.resourceType,
      url: `http://hl7.org/fhir/StructureDefinition/${resource.resourceType}`,
      snapshot: {
        element: []
      }
    };

    this.editorDialog.open(minimalSD, resource);
  }
}
