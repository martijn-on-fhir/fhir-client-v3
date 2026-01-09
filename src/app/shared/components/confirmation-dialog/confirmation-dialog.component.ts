import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Confirmation Dialog Component
 *
 * Reusable modal dialog for confirmations (delete, warnings, etc.)
 */
@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent {
  @Input() isOpen = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() confirmButtonClass = 'btn-danger'; // btn-danger, btn-primary, btn-warning
  @Input() icon = 'fa-exclamation-triangle'; // FontAwesome icon
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  handleConfirm() {
    this.confirm.emit();
  }

  handleCancel() {
    this.cancel.emit();
  }
}
