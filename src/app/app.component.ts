import { Component, ViewChild, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationService } from './core/services/navigation.service';
import { ProfileLoadingService } from './core/services/profile-loading.service';
import { ThemeService } from './core/services/theme.service';
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
export class AppComponent {
  @ViewChild(ResourceEditorDialogComponent) editorDialog!: ResourceEditorDialogComponent;

  private themeService = inject(ThemeService);
  private navigationService = inject(NavigationService);
  private profileLoadingService = inject(ProfileLoadingService);

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

      const result = await this.profileLoadingService.loadProfile(profileUrl, profileTitle);

      if (result) {
        this.editorDialog.open(result.structureDefinition, resource);

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
