/**
 * FHIR Validator Utility
 *
 * Provides basic FHIR R4 resource validation.
 * Validates structure, required fields, data types, and references.
 */

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'information';
  code: string;
  diagnostics: string;
  location: string[];
  expression?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  resourceType?: string;
}

/**
 * FHIR R4 base resource types
 */
const FHIR_R4_RESOURCES = [
  'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment',
  'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
  'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam', 'CatalogEntry',
  'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse', 'ClinicalImpression',
  'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition', 'Composition',
  'ConceptMap', 'Condition', 'Consent', 'Contract', 'Coverage', 'CoverageEligibilityRequest',
  'CoverageEligibilityResponse', 'DetectedIssue', 'Device', 'DeviceDefinition', 'DeviceMetric',
  'DeviceRequest', 'DeviceUseStatement', 'DiagnosticReport', 'DocumentManifest', 'DocumentReference',
  'EffectEvidenceSynthesis', 'Encounter', 'Endpoint', 'EnrollmentRequest', 'EnrollmentResponse',
  'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceVariable', 'ExampleScenario',
  'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal', 'GraphDefinition', 'Group',
  'GuidanceResponse', 'HealthcareService', 'ImagingStudy', 'Immunization', 'ImmunizationEvaluation',
  'ImmunizationRecommendation', 'ImplementationGuide', 'InsurancePlan', 'Invoice', 'Library',
  'Linkage', 'List', 'Location', 'Measure', 'MeasureReport', 'Media', 'Medication',
  'MedicationAdministration', 'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest',
  'MedicationStatement', 'MedicinalProduct', 'MedicinalProductAuthorization', 'MedicinalProductContraindication',
  'MedicinalProductIndication', 'MedicinalProductIngredient', 'MedicinalProductInteraction',
  'MedicinalProductManufactured', 'MedicinalProductPackaged', 'MedicinalProductPharmaceutical',
  'MedicinalProductUndesirableEffect', 'MessageDefinition', 'MessageHeader', 'MolecularSequence',
  'NamingSystem', 'NutritionOrder', 'Observation', 'ObservationDefinition', 'OperationDefinition',
  'OperationOutcome', 'Organization', 'OrganizationAffiliation', 'Parameters', 'Patient',
  'PaymentNotice', 'PaymentReconciliation', 'Person', 'PlanDefinition', 'Practitioner',
  'PractitionerRole', 'Procedure', 'Provenance', 'Questionnaire', 'QuestionnaireResponse',
  'RelatedPerson', 'RequestGroup', 'ResearchDefinition', 'ResearchElementDefinition', 'ResearchStudy',
  'ResearchSubject', 'RiskAssessment', 'RiskEvidenceSynthesis', 'Schedule', 'SearchParameter',
  'ServiceRequest', 'Slot', 'Specimen', 'SpecimenDefinition', 'StructureDefinition', 'StructureMap',
  'Subscription', 'Substance', 'SubstanceNucleicAcid', 'SubstancePolymer', 'SubstanceProtein',
  'SubstanceReferenceInformation', 'SubstanceSourceMaterial', 'SubstanceSpecification', 'SupplyDelivery',
  'SupplyRequest', 'Task', 'TerminologyCapabilities', 'TestReport', 'TestScript', 'ValueSet',
  'VerificationResult', 'VisionPrescription',
];

/**
 * FHIR STU3 (R3) base resource types
 */
const FHIR_STU3_RESOURCES = [
  'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment',
  'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BodySite', 'Bundle', 'CapabilityStatement',
  'CarePlan', 'CareTeam', 'ChargeItem', 'Claim', 'ClaimResponse', 'ClinicalImpression', 'CodeSystem',
  'Communication', 'CommunicationRequest', 'CompartmentDefinition', 'Composition', 'ConceptMap',
  'Condition', 'Consent', 'Contract', 'Coverage', 'DataElement', 'DetectedIssue', 'Device',
  'DeviceComponent', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement', 'DiagnosticReport',
  'DocumentManifest', 'DocumentReference', 'EligibilityRequest', 'EligibilityResponse', 'Encounter',
  'Endpoint', 'EnrollmentRequest', 'EnrollmentResponse', 'EpisodeOfCare', 'ExpansionProfile',
  'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal', 'GraphDefinition', 'Group',
  'GuidanceResponse', 'HealthcareService', 'ImagingManifest', 'ImagingStudy', 'Immunization',
  'ImmunizationRecommendation', 'ImplementationGuide', 'Library', 'Linkage', 'List', 'Location',
  'Measure', 'MeasureReport', 'Media', 'Medication', 'MedicationAdministration', 'MedicationDispense',
  'MedicationRequest', 'MedicationStatement', 'MessageDefinition', 'MessageHeader', 'NamingSystem',
  'NutritionOrder', 'Observation', 'OperationDefinition', 'OperationOutcome', 'Organization',
  'Parameters', 'Patient', 'PaymentNotice', 'PaymentReconciliation', 'Person', 'PlanDefinition',
  'Practitioner', 'PractitionerRole', 'Procedure', 'ProcedureRequest', 'ProcessRequest',
  'ProcessResponse', 'Provenance', 'Questionnaire', 'QuestionnaireResponse', 'ReferralRequest',
  'RelatedPerson', 'RequestGroup', 'ResearchStudy', 'ResearchSubject', 'RiskAssessment', 'Schedule',
  'SearchParameter', 'Sequence', 'ServiceDefinition', 'Slot', 'Specimen', 'StructureDefinition',
  'StructureMap', 'Subscription', 'Substance', 'SupplyDelivery', 'SupplyRequest', 'Task',
  'TestReport', 'TestScript', 'ValueSet', 'VisionPrescription',
];

/**
 * Common required fields for FHIR R4 resources
 */
const R4_REQUIRED_FIELDS: Record<string, string[]> = {
  Patient: ['resourceType'],
  Observation: ['resourceType', 'status', 'code'],
  Condition: ['resourceType', 'subject'],
  Procedure: ['resourceType', 'status', 'subject'],
  Encounter: ['resourceType', 'status', 'class'],
  MedicationRequest: ['resourceType', 'status', 'intent', 'medicationCodeableConcept', 'subject'],
  DiagnosticReport: ['resourceType', 'status', 'code'],
  AllergyIntolerance: ['resourceType', 'patient'],
  Immunization: ['resourceType', 'status', 'vaccineCode', 'patient', 'occurrenceDateTime'],
};

/**
 * Common required fields for FHIR STU3 resources
 */
const STU3_REQUIRED_FIELDS: Record<string, string[]> = {
  Patient: ['resourceType'],
  Observation: ['resourceType', 'status', 'code'],
  Condition: ['resourceType', 'subject'],
  Procedure: ['resourceType', 'status', 'subject'],
  Encounter: ['resourceType', 'status', 'class'],
  MedicationRequest: ['resourceType', 'status', 'intent', 'medicationCodeableConcept', 'subject'],
  DiagnosticReport: ['resourceType', 'status', 'code'],
  AllergyIntolerance: ['resourceType', 'patient'],
  Immunization: ['resourceType', 'status', 'vaccineCode', 'patient', 'date'],
};

/**
 * Validate a FHIR resource
 */
export function validateFhirResource(resource: any, version: 'R4' | 'STU3' = 'R4'): ValidationResult {
  const issues: ValidationIssue[] = [];
  const validResources = version === 'STU3' ? FHIR_STU3_RESOURCES : FHIR_R4_RESOURCES;
  const requiredFields = version === 'STU3' ? STU3_REQUIRED_FIELDS : R4_REQUIRED_FIELDS;

  let parsedResource: any;
  try {
    parsedResource = typeof resource === 'string' ? JSON.parse(resource) : resource;
  } catch {
    return {
      isValid: false,
      issues: [{
        severity: 'error',
        code: 'invalid',
        diagnostics: 'Invalid JSON: Unable to parse resource',
        location: ['$'],
      }],
    };
  }

  if (!parsedResource || typeof parsedResource !== 'object') {
    issues.push({
      severity: 'error',
      code: 'invalid',
      diagnostics: 'Resource must be a valid JSON object',
      location: ['$'],
    });
    return { isValid: false, issues };
  }

  const resourceType = parsedResource.resourceType;

  if (!resourceType) {
    issues.push({
      severity: 'error',
      code: 'required',
      diagnostics: 'resourceType is required',
      location: ['resourceType'],
    });
  } else if (!validResources.includes(resourceType)) {
    issues.push({
      severity: 'error',
      code: 'code-invalid',
      diagnostics: `Unknown resource type: ${resourceType}. Must be a valid FHIR ${version} resource type.`,
      location: ['resourceType'],
    });
  }

  if (resourceType && requiredFields[resourceType]) {
    requiredFields[resourceType].forEach((field) => {
      if (!hasField(parsedResource, field)) {
        issues.push({
          severity: 'error',
          code: 'required',
          diagnostics: `Required field '${field}' is missing`,
          location: [field],
        });
      }
    });
  }

  if (parsedResource.id && !isValidId(parsedResource.id)) {
    issues.push({
      severity: 'error',
      code: 'invalid',
      diagnostics: 'Resource ID must contain only alphanumeric characters, hyphens, and periods',
      location: ['id'],
    });
  }

  if (resourceType) {
    validateResourceSpecific(parsedResource, resourceType, issues);
  }

  validateReferences(parsedResource, '', issues);
  addBestPracticeWarnings(parsedResource, resourceType, issues);

  return {
    isValid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    resourceType,
  };
}

function hasField(obj: any, path: string): boolean {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return false;
    }
    current = current[key];
  }
  return current !== null && current !== undefined;
}

function isValidId(id: string): boolean {
  return /^[A-Za-z0-9-.]{1,64}$/.test(id);
}

function validateReferences(obj: any, path: string, issues: ValidationIssue[]): void {
  if (!obj || typeof obj !== 'object') return;

  if (obj.reference) {
    const reference = obj.reference;
    const location = path ? `${path}.reference` : 'reference';
    if (typeof reference === 'string') {
      const relativePattern = /^[A-Z][a-zA-Z]+\/[A-Za-z0-9-.]+$/;
      const urlPattern = /^https?:\/\/.+/;
      const urnPattern = /^urn:.+/;
      if (!relativePattern.test(reference) && !urlPattern.test(reference) && !urnPattern.test(reference)) {
        issues.push({
          severity: 'warning',
          code: 'invalid',
          diagnostics: `Reference '${reference}' does not follow FHIR reference format (ResourceType/id, URL, or URN)`,
          location: [location],
        });
      }
    }
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const newPath = path ? `${path}.${key}` : key;
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          validateReferences(item, `${newPath}[${index}]`, issues);
        });
      } else if (typeof value === 'object' && value !== null) {
        validateReferences(value, newPath, issues);
      }
    }
  }
}

function validateResourceSpecific(resource: any, resourceType: string, issues: ValidationIssue[]): void {
  switch (resourceType) {
    case 'Patient':
      if (!resource.name && !resource.identifier) {
        issues.push({
          severity: 'warning',
          code: 'business-rule',
          diagnostics: 'Patient should have at least one name or identifier',
          location: ['Patient'],
        });
      }
      break;
    case 'Observation':
      if (!resource.valueQuantity && !resource.valueCodeableConcept && !resource.valueString &&
          !resource.valueBoolean && !resource.valueInteger && !resource.valueRange &&
          !resource.valueRatio && !resource.valueSampledData && !resource.valueTime &&
          !resource.valueDateTime && !resource.valuePeriod && !resource.component &&
          !resource.dataAbsentReason) {
        issues.push({
          severity: 'warning',
          code: 'business-rule',
          diagnostics: 'Observation should have a value, component, or dataAbsentReason',
          location: ['Observation'],
        });
      }
      break;
    case 'Condition':
      if (!resource.code) {
        issues.push({
          severity: 'warning',
          code: 'business-rule',
          diagnostics: 'Condition should have a code',
          location: ['Condition.code'],
        });
      }
      break;
  }
}

function addBestPracticeWarnings(resource: any, resourceType: string, issues: ValidationIssue[]): void {
  if (!resource.meta || !resource.meta.lastUpdated) {
    issues.push({
      severity: 'information',
      code: 'informational',
      diagnostics: 'Best practice: Include meta.lastUpdated for resource versioning',
      location: ['meta.lastUpdated'],
    });
  }

  if (resourceType === 'Patient') {
    if (!resource.telecom || resource.telecom.length === 0) {
      issues.push({
        severity: 'information',
        code: 'informational',
        diagnostics: 'Best practice: Include contact information (telecom) for Patient',
        location: ['Patient.telecom'],
      });
    }
    if (!resource.gender) {
      issues.push({
        severity: 'information',
        code: 'informational',
        diagnostics: 'Best practice: Include gender for Patient',
        location: ['Patient.gender'],
      });
    }
  }

  if (resource.identifier && Array.isArray(resource.identifier)) {
    resource.identifier.forEach((id: any, index: number) => {
      if (!id.system) {
        issues.push({
          severity: 'warning',
          code: 'business-rule',
          diagnostics: 'Identifier should include a system URL',
          location: [`identifier[${index}].system`],
        });
      }
    });
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'error': return 'danger';
    case 'warning': return 'warning';
    case 'information': return 'info';
    default: return 'secondary';
  }
}

export function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'error': return 'times-circle';
    case 'warning': return 'exclamation-triangle';
    case 'information': return 'info-circle';
    default: return 'question-circle';
  }
}

export function validateAgainstServer(resource: any, metadata: any): ValidationResult {
  const issues: ValidationIssue[] = [];
  let parsedResource: any;

  try {
    parsedResource = typeof resource === 'string' ? JSON.parse(resource) : resource;
  } catch {
    return {
      isValid: false,
      issues: [{
        severity: 'error',
        code: 'invalid',
        diagnostics: 'Invalid JSON: Unable to parse resource',
        location: ['$'],
      }],
    };
  }

  if (!metadata || !metadata.resourceType || metadata.resourceType !== 'CapabilityStatement') {
    issues.push({
      severity: 'warning',
      code: 'informational',
      diagnostics: 'No CapabilityStatement available. Cannot validate against server capabilities.',
      location: ['$'],
    });
    return { isValid: true, issues };
  }

  const resourceType = parsedResource.resourceType;

  if (!resourceType) {
    issues.push({
      severity: 'error',
      code: 'required',
      diagnostics: 'resourceType is required',
      location: ['resourceType'],
    });
    return { isValid: false, issues, resourceType };
  }

  const serverVersion = metadata.fhirVersion;
  if (serverVersion) {
    issues.push({
      severity: 'information',
      code: 'informational',
      diagnostics: `Server FHIR version: ${serverVersion}`,
      location: ['$'],
    });
  }

  const restResources = metadata.rest?.[0]?.resource || [];
  const supportedResource = restResources.find((r: any) => r.type === resourceType);

  if (!supportedResource) {
    issues.push({
      severity: 'error',
      code: 'not-supported',
      diagnostics: `Resource type '${resourceType}' is not supported by this FHIR server`,
      location: ['resourceType'],
    });
    return { isValid: false, issues, resourceType };
  }

  const supportedInteractions = supportedResource.interaction?.map((i: any) => i.code) || [];
  if (supportedInteractions.length > 0) {
    issues.push({
      severity: 'information',
      code: 'informational',
      diagnostics: `Server supports: ${supportedInteractions.join(', ')} operations for ${resourceType}`,
      location: ['$'],
    });
  }

  return {
    isValid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    resourceType,
  };
}
