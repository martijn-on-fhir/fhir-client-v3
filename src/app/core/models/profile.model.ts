/**
 * Profile Models
 *
 * Type-safe models for FHIR profiles
 */

export interface ProfileInfo {
  url: string;
  resourceType: string;
}

export interface StructureDefinition {
  resourceType: 'StructureDefinition';
  id?: string;
  url?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  description?: string;
  purpose?: string;
  type?: string;
  baseDefinition?: string;
  snapshot?: {
    element: StructureDefinitionElement[];
  };
  differential?: {
    element: StructureDefinitionElement[];
  };
}

export interface StructureDefinitionElement {
  id?: string;
  path?: string;
  short?: string;
  definition?: string;
  min?: number;
  max?: string;
  type?: Array<{
    code?: string;
    profile?: string[];
    targetProfile?: string[];
  }>;
  constraint?: Constraint[];
}

export interface Constraint {
  key?: string;
  severity?: 'error' | 'warning';
  human?: string;
  expression?: string;
}

export interface ProfileCacheStats {
  count: number;
  totalSize: number;
  profiles: Array<{
    resourceType: string;
    size: number;
    cached: Date;
  }>;
}
