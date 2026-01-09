import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Placeholder Component - Shows "Coming Soon" for tabs under development
 *
 * Use this temporarily for tabs you haven't implemented yet
 * Replace with real components as you build them
 */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="placeholder-container">
      <div class="placeholder-content">
        <i class="fas fa-{{ icon }} placeholder-icon"></i>
        <h2 class="placeholder-title">{{ title }}</h2>
        <p class="placeholder-description">{{ description }}</p>
        <div class="placeholder-badge">Coming Soon</div>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 500px;
      padding: 2rem;
    }

    .placeholder-content {
      text-align: center;
      max-width: 500px;
    }

    .placeholder-icon {
      font-size: 5rem;
      color: var(--bs-secondary);
      opacity: 0.3;
      margin-bottom: 1.5rem;
    }

    .placeholder-title {
      font-size: 2rem;
      font-weight: 600;
      color: var(--bs-body-color);
      margin-bottom: 1rem;
    }

    .placeholder-description {
      font-size: 1.125rem;
      color: var(--bs-secondary-color);
      margin-bottom: 2rem;
    }

    .placeholder-badge {
      display: inline-block;
      background: var(--bs-primary-bg-subtle);
      color: var(--bs-primary);
      padding: 0.5rem 1.5rem;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.875rem;
      border: 2px solid var(--bs-primary-border-subtle);
    }
  `]
})
export class PlaceholderComponent implements OnInit {
  private route = inject(ActivatedRoute);

  @Input() title: string = 'Feature Under Development';
  @Input() description: string = 'This feature is being built and will be available soon.';
  @Input() icon: string = 'tools';

  ngOnInit() {
    // Get data from route if available
    const data = this.route.snapshot.data;

    if (data) {
      this.title = data['title'] || this.title;
      this.description = data['description'] || this.description;
      this.icon = data['icon'] || this.icon;
    }
  }
}
