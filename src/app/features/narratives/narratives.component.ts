import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Narratives Component
 *
 * Provides interface for viewing and managing FHIR resource narratives.
 */
@Component({
  selector: 'app-narratives',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './narratives.component.html',
  styleUrl: './narratives.component.scss'
})
export class NarrativesComponent {

}
