import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FhirService } from '../../../core/services/fhir.service';

/**
 * Reference Selector Dialog Component
 *
 * Allows users to search for FHIR resources and select one to create a Reference.
 * Triggered by Alt+Enter on Reference-type properties.
 */
@Component({
  selector: 'app-reference-selector-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reference-selector-dialog.component.html',
  styleUrl: './reference-selector-dialog.component.scss'
})
export class ReferenceSelectorDialogComponent {
  private fhirService = inject(FhirService);

  @Input() propertyName = '';
  @Output() close = new EventEmitter<void>();
  @Output() select = new EventEmitter<{ reference: string; display: string }>();

  // Dialog state
  show = signal(false);
  query = signal('');
  results = signal<any[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  /**
   * Open the dialog
   */
  open(propertyName: string) {
    this.propertyName = propertyName;
    this.show.set(true);
    this.query.set('');
    this.results.set([]);
    this.error.set(null);
  }

  /**
   * Close the dialog
   */
  closeDialog() {
    this.show.set(false);
    this.close.emit();
  }

  /**
   * Execute FHIR search query
   */
  async executeQuery() {
    const q = this.query();

    if (!q.trim()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.results.set([]);

    try {
      // Ensure query starts with '/' for the FHIR API
      const queryPath = q.startsWith('/') ? q : `/${q}`;

      // Execute the FHIR query
      const response = await this.fhirService.executeQuery(queryPath).toPromise();

      // Extract entries from Bundle
      const entries = response?.entry || [];
      const resources = entries.map((entry: any) => entry.resource);

      this.results.set(resources);
    } catch (err: any) {
      const message = err.message || 'Failed to execute query';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Get display name from a FHIR resource
   */
  getDisplayName(resource: any): string {
    const resourceType = resource.resourceType;

    switch (resourceType) {
      case 'Patient':
        if (resource.name && resource.name.length > 0) {
          const name = resource.name[0];
          const given = name.given?.join(' ') || '';
          const family = name.family || '';

          return `${given} ${family}`.trim();
        }

        return 'Unknown Patient';

      case 'Practitioner':
        if (resource.name && resource.name.length > 0) {
          const name = resource.name[0];
          const given = name.given?.join(' ') || '';
          const family = name.family || '';
          const prefix = name.prefix?.join(' ') || '';

          return `${prefix} ${given} ${family}`.trim();
        }

        return 'Unknown Practitioner';

      case 'Organization':
        return resource.name || 'Unknown Organization';

      case 'Location':
        return resource.name || 'Unknown Location';

      default:
        // Fallback: try common display fields
        if (resource.name) {
          if (typeof resource.name === 'string') {
            return resource.name;
          } else if (Array.isArray(resource.name) && resource.name.length > 0) {
            const name = resource.name[0];

            if (typeof name === 'string') {
return name;
}

            if (name.text) {
return name.text;
}
          }
        }

        if (resource.title) {
return resource.title;
}

        if (resource.display) {
return resource.display;
}

        return `${resourceType}/${resource.id}`;
    }
  }

  /**
   * Select a resource from the list
   */
  selectResource(resource: any) {
    const resourceType = resource.resourceType;
    const id = resource.id;
    const reference = `${resourceType}/${id}`;
    const display = this.getDisplayName(resource);

    this.select.emit({ reference, display });
    this.closeDialog();
  }

  /**
   * Handle Enter key in query input
   */
  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.executeQuery();
    }
  }
}
