import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-resource-editor-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resource-editor-dialog.component.html',
  styleUrls: ['./resource-editor-dialog.component.scss']
})
export class ResourceEditorDialogComponent {

  isOpen = signal(false);
  resource = signal<any>(null);

  /**
   * Open dialog with a resource
   */
  open(resource: any) {
    this.resource.set(resource);
    this.isOpen.set(true);
  }

  /**
   * Close dialog
   */
  close() {
    this.isOpen.set(false);
    this.resource.set(null);
  }
}
