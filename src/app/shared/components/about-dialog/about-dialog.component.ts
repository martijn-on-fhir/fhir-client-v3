import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import packageJson from '../../../../../package.json';

@Component({
  selector: 'app-about-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-dialog.component.html',
  styleUrls: ['./about-dialog.component.scss']
})
export class AboutDialogComponent {
  isOpen = signal(false);
  version = packageJson.version;

  /**
   * Open dialog
   */
  open() {
    this.isOpen.set(true);
  }

  /**
   * Close dialog
   */
  close() {
    this.isOpen.set(false);
  }
}
