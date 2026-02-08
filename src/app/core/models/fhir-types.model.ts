import {FhirVersion} from './server-profile.model';

export interface PrefixOperator {
  prefix: string;
  label: string;
  description: string;
}

export interface GlobalParameter {
  name: string;
  type: string;
  description: string;
}

export interface FhirVersionData {
  resourceTypes: string[];
  referenceTargets: Record<string, string[]>;
  enumValues: Record<string, string[]>;
}

export interface FhirSharedData {
  modifiers: Record<string, string[]>;
  prefixOperators: PrefixOperator[];
  globalParameters: GlobalParameter[];
}
