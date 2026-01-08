/**
 * Smart Query Templates Type Definitions
 *
 * Defines the data structures for parameterized FHIR query templates.
 * Templates allow users to create reusable query patterns with dynamic parameters.
 */

/**
 * Parameter types supported by Smart Templates
 */
export type ParameterType = 'string' | 'number' | 'date' | 'boolean' | 'reference' | 'token' | 'choice';

/**
 * Choice option for choice-type parameters
 */
export interface ChoiceOption {
  label: string;
  value: string;
  description?: string;
}

/**
 * Template parameter definition
 */
export interface TemplateParameter {
  /** Parameter name (used in template with {{name}}) */
  name: string;

  /** Display label for the parameter */
  label: string;

  /** Parameter type determines the input widget */
  type: ParameterType;

  /** Help text shown below the input */
  hint?: string;

  /** Whether this parameter is required */
  required: boolean;

  /** Default value (can use special tokens like {{today}}) */
  default?: string;

  /** For choice type: available options */
  choices?: ChoiceOption[];

  /** For reference type: target resource types */
  referenceTypes?: string[];

  /** For number type: min/max validation */
  min?: number;
  max?: number;

  /** For string type: regex validation pattern */
  pattern?: string;
}

/**
 * Template category for organization
 */
export type TemplateCategory = 'patient-care' | 'testing' | 'administrative' | 'security' | 'analytics' | 'custom';

/**
 * Smart Query Template
 */
export interface SmartQueryTemplate {
  /** Unique template ID */
  id: string;

  /** Template name */
  name: string;

  /** Detailed description */
  description: string;

  /** Category for organization */
  category: TemplateCategory;

  /** Search tags */
  tags: string[];

  /** Template author */
  author: string;

  /** Template version */
  version: string;

  /** Template parameters */
  parameters: TemplateParameter[];

  /** Query template string with {{parameter}} placeholders */
  queryTemplate: string;

  /** Creation timestamp */
  createdAt: string;

  /** Last modified timestamp */
  updatedAt?: string;

  /** Whether this is a system template (cannot be deleted) */
  isSystem?: boolean;

  /** Number of times this template has been used */
  usageCount?: number;
}

/**
 * Template parameter values filled by user
 */
export interface TemplateParameterValues {
  [parameterName: string]: string;
}

/**
 * Category metadata for display
 */
export interface CategoryInfo {
  id: TemplateCategory;
  label: string;
  icon: string;
  description: string;
}

/**
 * Predefined category information
 */
export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'patient-care',
    label: 'Patient Care',
    icon: 'user-md',
    description: 'Templates for patient management and clinical workflows',
  },
  {
    id: 'testing',
    label: 'Testing & Development',
    icon: 'flask',
    description: 'Templates for testing, debugging, and development',
  },
  {
    id: 'administrative',
    label: 'Administrative',
    icon: 'building',
    description: 'Templates for administrative and organizational tasks',
  },
  {
    id: 'security',
    label: 'Security & Audit',
    icon: 'shield-alt',
    description: 'Templates for security audits and compliance',
  },
  {
    id: 'analytics',
    label: 'Analytics & Reporting',
    icon: 'chart-bar',
    description: 'Templates for data analysis and reporting',
  },
  {
    id: 'custom',
    label: 'Custom Templates',
    icon: 'star',
    description: 'User-created custom templates',
  },
];

/**
 * Helper function to get category info
 */
export function getCategoryInfo(category: TemplateCategory): CategoryInfo {
  return CATEGORIES.find((c) => c.id === category) || CATEGORIES[CATEGORIES.length - 1];
}

/**
 * System templates (pre-defined examples)
 */
export const SYSTEM_TEMPLATES: SmartQueryTemplate[] = [
  // ========== Patient Care ==========
  {
    id: 'patient-search-by-name',
    name: 'Search Patients by Name',
    description: 'Find patients by their given name or family name',
    category: 'patient-care',
    tags: ['patient', 'search', 'name'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'name',
        label: 'Patient Name',
        type: 'string',
        hint: 'Enter patient given name or family name',
        required: true,
      },
      {
        name: 'count',
        label: 'Max Results',
        type: 'number',
        hint: 'Maximum number of results to return',
        required: false,
        default: '10',
        min: 1,
        max: 100,
      },
    ],
    queryTemplate: '/Patient?name={{name}}&_count={{count}}',
  },
  {
    id: 'patient-by-identifier',
    name: 'Search Patient by Identifier',
    description: 'Find a patient using their medical record number or other identifier',
    category: 'patient-care',
    tags: ['patient', 'identifier', 'mrn'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'identifier',
        label: 'Identifier',
        type: 'string',
        hint: 'Medical record number or other identifier',
        required: true,
      },
    ],
    queryTemplate: '/Patient?identifier={{identifier}}',
  },
  {
    id: 'observations-by-patient',
    name: 'Patient Observations',
    description: 'Retrieve observations for a specific patient',
    category: 'patient-care',
    tags: ['observation', 'patient', 'vitals'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'patient',
        label: 'Patient ID',
        type: 'reference',
        hint: 'Enter the patient resource ID',
        required: true,
        referenceTypes: ['Patient'],
      },
      {
        name: 'code',
        label: 'Observation Code',
        type: 'token',
        hint: 'LOINC or SNOMED code (optional)',
        required: false,
      },
      {
        name: 'count',
        label: 'Max Results',
        type: 'number',
        hint: 'Maximum number of results',
        required: false,
        default: '50',
        min: 1,
        max: 200,
      },
    ],
    queryTemplate: '/Observation?patient={{patient}}&code={{code}}&_count={{count}}',
  },
  {
    id: 'recent-encounters',
    name: 'Recent Encounters',
    description: 'Find encounters within a date range',
    category: 'patient-care',
    tags: ['encounter', 'date', 'recent'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'date',
        label: 'Since Date',
        type: 'date',
        hint: 'Show encounters from this date onward',
        required: true,
        default: '2024-01-01',
      },
      {
        name: 'status',
        label: 'Status',
        type: 'choice',
        hint: 'Filter by encounter status',
        required: false,
        choices: [
          { label: 'All', value: '', description: 'No status filter' },
          { label: 'Planned', value: 'planned', description: 'Planned encounters' },
          { label: 'In Progress', value: 'in-progress', description: 'Ongoing encounters' },
          { label: 'Finished', value: 'finished', description: 'Completed encounters' },
        ],
      },
    ],
    queryTemplate: '/Encounter?date=ge{{date}}&status={{status}}',
  },
  {
    id: 'medications-by-patient',
    name: 'Patient Medications',
    description: 'Get all medications for a patient',
    category: 'patient-care',
    tags: ['medication', 'patient', 'prescription'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'patient',
        label: 'Patient ID',
        type: 'reference',
        hint: 'Patient resource ID',
        required: true,
        referenceTypes: ['Patient'],
      },
      {
        name: 'status',
        label: 'Status',
        type: 'choice',
        hint: 'Filter by medication status',
        required: false,
        choices: [
          { label: 'All', value: '' },
          { label: 'Active', value: 'active' },
          { label: 'Completed', value: 'completed' },
          { label: 'Stopped', value: 'stopped' },
        ],
      },
    ],
    queryTemplate: '/MedicationRequest?patient={{patient}}&status={{status}}',
  },
  {
    id: 'conditions-by-patient',
    name: 'Patient Conditions',
    description: 'Retrieve all conditions/diagnoses for a patient',
    category: 'patient-care',
    tags: ['condition', 'diagnosis', 'patient'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'patient',
        label: 'Patient ID',
        type: 'reference',
        hint: 'Patient resource ID',
        required: true,
        referenceTypes: ['Patient'],
      },
    ],
    queryTemplate: '/Condition?patient={{patient}}',
  },

  // ========== Testing & Development ==========
  {
    id: 'count-resources',
    name: 'Count Resources',
    description: 'Get the total count of a specific resource type',
    category: 'testing',
    tags: ['count', 'testing', 'summary'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'resourceType',
        label: 'Resource Type',
        type: 'choice',
        hint: 'Select resource type to count',
        required: true,
        choices: [
          { label: 'Patient', value: 'Patient' },
          { label: 'Observation', value: 'Observation' },
          { label: 'Encounter', value: 'Encounter' },
          { label: 'Condition', value: 'Condition' },
          { label: 'MedicationRequest', value: 'MedicationRequest' },
          { label: 'Practitioner', value: 'Practitioner' },
          { label: 'Organization', value: 'Organization' },
        ],
      },
    ],
    queryTemplate: '/{{resourceType}}?_summary=count',
  },
  {
    id: 'recent-resources',
    name: 'Recently Created Resources',
    description: 'Find recently created resources of any type',
    category: 'testing',
    tags: ['recent', 'testing', 'date'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'resourceType',
        label: 'Resource Type',
        type: 'choice',
        hint: 'Resource type to search',
        required: true,
        choices: [
          { label: 'Patient', value: 'Patient' },
          { label: 'Observation', value: 'Observation' },
          { label: 'Encounter', value: 'Encounter' },
        ],
      },
      {
        name: 'count',
        label: 'Limit',
        type: 'number',
        hint: 'Number of results',
        required: false,
        default: '20',
        min: 1,
        max: 100,
      },
    ],
    queryTemplate: '/{{resourceType}}?_sort=-_lastUpdated&_count={{count}}',
  },
  {
    id: 'test-search-all',
    name: 'Fetch All Resources',
    description: 'Retrieve all resources of a specific type (use with caution)',
    category: 'testing',
    tags: ['all', 'testing', 'bulk'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'resourceType',
        label: 'Resource Type',
        type: 'string',
        hint: 'Enter resource type (e.g., Patient, Observation)',
        required: true,
      },
      {
        name: 'count',
        label: 'Page Size',
        type: 'number',
        hint: 'Results per page',
        required: false,
        default: '50',
        min: 1,
        max: 200,
      },
    ],
    queryTemplate: '/{{resourceType}}?_count={{count}}',
  },

  // ========== Administrative ==========
  {
    id: 'practitioners-search',
    name: 'Search Practitioners',
    description: 'Find practitioners by name or specialty',
    category: 'administrative',
    tags: ['practitioner', 'search', 'staff'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'name',
        label: 'Practitioner Name',
        type: 'string',
        hint: 'Enter practitioner name',
        required: false,
      },
    ],
    queryTemplate: '/Practitioner?name={{name}}',
  },
  {
    id: 'organizations-search',
    name: 'Search Organizations',
    description: 'Find healthcare organizations',
    category: 'administrative',
    tags: ['organization', 'search', 'hospital'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'name',
        label: 'Organization Name',
        type: 'string',
        hint: 'Enter organization name',
        required: false,
      },
    ],
    queryTemplate: '/Organization?name={{name}}',
  },
  {
    id: 'locations-search',
    name: 'Search Locations',
    description: 'Find healthcare service locations',
    category: 'administrative',
    tags: ['location', 'search', 'facility'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'name',
        label: 'Location Name',
        type: 'string',
        hint: 'Enter location name',
        required: false,
      },
    ],
    queryTemplate: '/Location?name={{name}}',
  },

  // ========== Security & Audit ==========
  {
    id: 'audit-events-recent',
    name: 'Recent Audit Events',
    description: 'View recent security audit events',
    category: 'security',
    tags: ['audit', 'security', 'log'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'date',
        label: 'Since Date',
        type: 'date',
        hint: 'Show audit events from this date',
        required: false,
      },
      {
        name: 'count',
        label: 'Max Results',
        type: 'number',
        hint: 'Number of events to return',
        required: false,
        default: '50',
        min: 1,
        max: 200,
      },
    ],
    queryTemplate: '/AuditEvent?date=ge{{date}}&_count={{count}}&_sort=-date',
  },
  {
    id: 'provenance-search',
    name: 'Resource Provenance',
    description: 'Track changes and authorship of resources',
    category: 'security',
    tags: ['provenance', 'audit', 'history'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'target',
        label: 'Target Resource ID',
        type: 'reference',
        hint: 'Resource to track provenance for',
        required: false,
      },
    ],
    queryTemplate: '/Provenance?target={{target}}',
  },

  // ========== Analytics & Reporting ==========
  {
    id: 'observations-by-code',
    name: 'Observations by Code',
    description: 'Aggregate observations by LOINC or SNOMED code',
    category: 'analytics',
    tags: ['observation', 'analytics', 'code'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'code',
        label: 'Observation Code',
        type: 'token',
        hint: 'LOINC or SNOMED code',
        required: true,
      },
      {
        name: 'date',
        label: 'Date Range',
        type: 'date',
        hint: 'Filter by date (ge for greater than)',
        required: false,
      },
    ],
    queryTemplate: '/Observation?code={{code}}&date=ge{{date}}',
  },
  {
    id: 'encounters-by-type',
    name: 'Encounters by Type',
    description: 'Get encounters filtered by encounter type',
    category: 'analytics',
    tags: ['encounter', 'analytics', 'type'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'type',
        label: 'Encounter Type',
        type: 'token',
        hint: 'Encounter type code',
        required: false,
      },
      {
        name: 'count',
        label: 'Max Results',
        type: 'number',
        hint: 'Number of results',
        required: false,
        default: '100',
        min: 1,
        max: 500,
      },
    ],
    queryTemplate: '/Encounter?type={{type}}&_count={{count}}',
  },
  {
    id: 'diagnostic-reports',
    name: 'Diagnostic Reports',
    description: 'Search diagnostic reports by patient or code',
    category: 'analytics',
    tags: ['diagnostic', 'report', 'lab'],
    author: 'System',
    version: '1.0.0',
    isSystem: true,
    createdAt: new Date().toISOString(),
    parameters: [
      {
        name: 'patient',
        label: 'Patient ID',
        type: 'reference',
        hint: 'Patient resource ID (optional)',
        required: false,
        referenceTypes: ['Patient'],
      },
      {
        name: 'code',
        label: 'Report Code',
        type: 'token',
        hint: 'Report code (optional)',
        required: false,
      },
    ],
    queryTemplate: '/DiagnosticReport?patient={{patient}}&code={{code}}',
  },
];
