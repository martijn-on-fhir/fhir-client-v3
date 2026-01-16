import { Component, OnInit, ViewChild, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationService } from './core/services/navigation.service';
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
export class AppComponent implements OnInit {
  @ViewChild(ResourceEditorDialogComponent) editorDialog!: ResourceEditorDialogComponent;

  private themeService = inject(ThemeService);
  private navigationService = inject(NavigationService);

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
   */
  private openEditorWithResource(resource: any) {
    if (!resource?.resourceType || !this.editorDialog) {
      return;
    }

    // Create a minimal StructureDefinition for the resource type
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
