import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  template: `
    <router-outlet></router-outlet>
    <app-toast-container />
  `,
  styles: []
})
export class AppComponent implements OnInit {
  private themeService = inject(ThemeService); // Initialize theme service

  ngOnInit() {
    // Theme service initializes on app start
    // Auth state is checked by guards when navigating
  }
}
