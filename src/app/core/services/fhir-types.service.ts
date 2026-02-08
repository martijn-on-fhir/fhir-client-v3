import {Injectable, computed, inject} from '@angular/core';
import {FHIR_R3_DATA} from '../data/fhir-r3.data';
import {FHIR_R4_DATA} from '../data/fhir-r4.data';
import {FHIR_SHARED_DATA} from '../data/fhir-shared.data';
import {FhirVersionData, PrefixOperator, GlobalParameter} from '../models/fhir-types.model';
import {FhirVersion} from '../models/server-profile.model';
import {ServerProfileService} from './server-profile.service';

const VERSION_DATA: Record<FhirVersion, FhirVersionData> = {
  'STU3': FHIR_R3_DATA,
  'R4': FHIR_R4_DATA,
  'R4B': FHIR_R4_DATA,
  'R5': FHIR_R4_DATA
};

const DEFAULT_VERSION: FhirVersion = 'STU3';

@Injectable({
  providedIn: 'root'
})
export class FhirTypesService {

  private serverProfileService = inject(ServerProfileService);

  private versionData = computed<FhirVersionData>(() => {
    const version = this.serverProfileService.activeProfile()?.fhirVersion ?? DEFAULT_VERSION;
    return VERSION_DATA[version];
  });

  getResourceTypes(): string[] {
    return [...this.versionData().resourceTypes];
  }

  searchResourceTypes(prefix: string): string[] {
    if (!prefix) {
      return this.versionData().resourceTypes;
    }
    const lowerPrefix = prefix.toLowerCase();
    return this.versionData().resourceTypes.filter(type =>
      type.toLowerCase().startsWith(lowerPrefix)
    );
  }

  isValidResourceType(type: string): boolean {
    return this.versionData().resourceTypes.includes(type);
  }

  getModifiers(paramType: string): string[] {
    return FHIR_SHARED_DATA.modifiers[paramType] || [];
  }

  getPrefixOperators(): PrefixOperator[] {
    return [...FHIR_SHARED_DATA.prefixOperators];
  }

  getGlobalParameters(): GlobalParameter[] {
    return [...FHIR_SHARED_DATA.globalParameters];
  }

  getEnumValues(fieldPath: string): string[] | undefined {
    return this.versionData().enumValues[fieldPath];
  }

  searchGlobalParameters(prefix: string): GlobalParameter[] {
    if (!prefix) {
      return FHIR_SHARED_DATA.globalParameters;
    }
    const lowerPrefix = prefix.toLowerCase();
    return FHIR_SHARED_DATA.globalParameters.filter(param =>
      param.name.toLowerCase().startsWith(lowerPrefix)
    );
  }

  getReferenceTargets(paramName: string): string[] {
    return this.versionData().referenceTargets[paramName] || [];
  }
}
