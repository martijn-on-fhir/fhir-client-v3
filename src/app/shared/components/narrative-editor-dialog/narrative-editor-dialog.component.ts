import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Output, signal, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MonacoEditorComponent} from '../monaco-editor/monaco-editor.component';

/**
 * Narrative Editor Dialog Component
 *
 * Dialog for editing and generating FHIR resource narratives.
 * Triggered by the generate narrative button in the JSON viewer toolbar.
 */
@Component({
  selector: 'app-narrative-editor-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent],
  templateUrl: './narrative-editor-dialog.component.html',
  styleUrl: './narrative-editor-dialog.component.scss'
})
export class NarrativeEditorDialogComponent {

  /**
   * Reference to the Monaco editor component.
   */
  @ViewChild('monacoEditor') monacoEditor!: MonacoEditorComponent;

  /**
   * Event emitter for closing the dialog.
   */
  @Output() close = new EventEmitter<void>();

  /**
   * Event emitter for saving the narrative.
   */
  @Output() save = new EventEmitter<{ narrative: string }>();

  // Dialog state
  show = signal(false);
  narrativeContent = signal('');
  loading = signal(false);

  /**
   * Open the dialog
   */
  open(existingNarrative?: string) {
    this.show.set(true);
    this.narrativeContent.set(existingNarrative || '');
  }

  /**
   * Close the dialog
   */
  closeDialog() {
    this.show.set(false);
    this.narrativeContent.set('');
    this.close.emit();
  }

  /**
   * Save the narrative
   */
  saveNarrative() {
    this.save.emit({narrative: this.narrativeContent()});
    this.closeDialog();
  }
}
