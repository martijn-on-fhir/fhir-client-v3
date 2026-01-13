/**
 * Tab Model - Defines structure for navigation tabs
 */

export interface Tab {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: string | number; // Optional badge (e.g., error count)
  active?: boolean;
}

/**
 * All application tabs
 * Add new tabs here as you build them!
 *
 * NOTE: All routes are under /app/* since the main layout is only loaded after authentication
 */
export const APP_TABS: Tab[] = [
  {
    id: 'query',
    label: 'FHIR Query',
    icon: 'search',
    route: '/app/query',
    active: true
  },
  {
    id: 'predefined',
    label: 'Predefined',
    icon: 'file-alt',
    route: '/app/predefined',
    active: true
  },
  {
    id: 'terminology',
    label: 'Terminology',
    icon: 'book',
    route: '/app/terminology',
    active: true
  },
  {
    id: 'validator',
    label: 'Validator',
    icon: 'check-circle',
    route: '/app/validator',
    active: true
  },
  {
    id: 'resource-info',
    label: 'Resource Info',
    icon: 'info-circle',
    route: '/app/resource-info',
    active: true
  },
  {
    id: 'profiles',
    label: 'Profiles',
    icon: 'file-lines',
    route: '/app/profiles',
    active: true
  },
  {
    id: 'nictiz',
    label: 'Nictiz',
    icon: 'hospital',
    route: '/app/nictiz',
    active: true
  },
  {
    id: 'fhirpath',
    label: 'FhirPath',
    icon: 'route',
    route: '/app/fhirpath',
    active: true
  },
  {
    id: 'pluriform',
    label: 'Pluriform',
    icon: 'shapes',
    route: '/app/pluriform',
    active: true
  },

  {
    id: 'logs',
    label: 'Logs',
    icon: 'list',
    route: '/app/logs',
    active: true
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    icon: 'bell',
    route: '/app/subscriptions',
    active: true
  }
];
