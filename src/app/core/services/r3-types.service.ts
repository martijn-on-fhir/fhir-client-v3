import {Injectable} from '@angular/core';

/**
 * R3 Types Service
 *
 * Provides FHIR R3 (STU3) resource type information for autocomplete.
 * Data is derived from the r3.d.ts type definitions.
 */
@Injectable({
  providedIn: 'root'
})
export class R3TypesService {

  /**
   * All FHIR R3 resource types that extend DomainResource
   */
  private readonly resourceTypes: string[] = [
    'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance',
    'Appointment', 'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary',
    'BodySite', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam',
    'ChargeItem', 'Claim', 'ClaimResponse', 'ClinicalImpression', 'CodeSystem',
    'Communication', 'CommunicationRequest', 'CompartmentDefinition', 'Composition',
    'ConceptMap', 'Condition', 'Consent', 'Contract', 'Coverage', 'DataElement',
    'DetectedIssue', 'Device', 'DeviceComponent', 'DeviceMetric', 'DeviceRequest',
    'DeviceUseStatement', 'DiagnosticReport', 'DocumentManifest', 'DocumentReference',
    'EligibilityRequest', 'EligibilityResponse', 'Encounter', 'Endpoint',
    'EnrollmentRequest', 'EnrollmentResponse', 'EpisodeOfCare', 'ExpansionProfile',
    'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal', 'GraphDefinition',
    'Group', 'GuidanceResponse', 'HealthcareService', 'ImagingManifest', 'ImagingStudy',
    'Immunization', 'ImmunizationRecommendation', 'ImplementationGuide', 'Library',
    'Linkage', 'List', 'Location', 'Measure', 'MeasureReport', 'Media', 'Medication',
    'MedicationAdministration', 'MedicationDispense', 'MedicationRequest',
    'MedicationStatement', 'MessageDefinition', 'MessageHeader', 'NamingSystem',
    'NutritionOrder', 'Observation', 'OperationDefinition', 'OperationOutcome',
    'Organization', 'Patient', 'PaymentNotice', 'PaymentReconciliation', 'Person',
    'PlanDefinition', 'Practitioner', 'PractitionerRole', 'Procedure', 'ProcedureRequest',
    'ProcessRequest', 'ProcessResponse', 'Provenance', 'Questionnaire',
    'QuestionnaireResponse', 'ReferralRequest', 'RelatedPerson', 'RequestGroup',
    'ResearchStudy', 'ResearchSubject', 'RiskAssessment', 'Schedule', 'SearchParameter',
    'Sequence', 'ServiceDefinition', 'Slot', 'Specimen', 'StructureDefinition',
    'StructureMap', 'Subscription', 'Substance', 'SupplyDelivery', 'SupplyRequest',
    'Task', 'TestReport', 'TestScript', 'ValueSet', 'VisionPrescription'
  ];

  /**
   * Common FHIR search parameter modifiers
   */
  private readonly modifiers: Record<string, string[]> = {
    string: ['exact', 'contains', 'missing', 'text'],
    token: ['text', 'not', 'above', 'below', 'in', 'not-in', 'missing'],
    reference: ['missing', 'type'],
    date: ['missing'],
    number: ['missing'],
    quantity: ['missing'],
    uri: ['above', 'below', 'missing']
  };

  /**
   * FHIR search parameter prefix operators (for date, number, quantity)
   */
  private readonly prefixOperators = [
    {prefix: 'eq', label: 'Equals', description: 'Equal to value'},
    {prefix: 'ne', label: 'Not Equals', description: 'Not equal to value'},
    {prefix: 'gt', label: 'Greater Than', description: 'Greater than value'},
    {prefix: 'lt', label: 'Less Than', description: 'Less than value'},
    {prefix: 'ge', label: 'Greater or Equal', description: 'Greater than or equal to value'},
    {prefix: 'le', label: 'Less or Equal', description: 'Less than or equal to value'},
    {prefix: 'sa', label: 'Starts After', description: 'Starts after value (date)'},
    {prefix: 'eb', label: 'Ends Before', description: 'Ends before value (date)'},
    {prefix: 'ap', label: 'Approximately', description: 'Approximately equal to value'}
  ];

  /**
   * Common global search parameters available for all resources
   */
  private readonly globalParameters = [
    {name: '_id', type: 'token', description: 'Logical id of the resource'},
    {name: '_lastUpdated', type: 'date', description: 'When the resource was last updated'},
    {name: '_tag', type: 'token', description: 'Tags applied to the resource'},
    {name: '_profile', type: 'uri', description: 'Profiles the resource claims to conform to'},
    {name: '_security', type: 'token', description: 'Security labels applied to the resource'},
    {name: '_text', type: 'string', description: 'Search on the narrative of the resource'},
    {name: '_content', type: 'string', description: 'Search on the entire content of the resource'},
    {name: '_list', type: 'string', description: 'Search for resources in a specified list'},
    {name: '_has', type: 'string', description: 'Reverse chaining search'},
    {name: '_type', type: 'token', description: 'Resource type (for system-level searches)'},
    {name: '_count', type: 'number', description: 'Number of results per page'},
    {name: '_sort', type: 'string', description: 'Sort order for results'},
    {name: '_skip', type: 'number', description: 'Number of records to skip'},
    {name: '_include', type: 'string', description: 'Include referenced resources'},
    {name: '_revinclude', type: 'string', description: 'Include resources that reference this'},
    {name: '_summary', type: 'token', description: 'Return summary of results'},
    {name: '_elements', type: 'string', description: 'Specific elements to return'},
    {name: '_contained', type: 'token', description: 'How to handle contained resources'},
    {name: '_containedType', type: 'token', description: 'Type filter for contained resources'}
  ];

  /**
   * Enum values for common FHIR fields
   */
  private readonly enumValues: Record<string, string[]> = {
    // Administrative gender (Patient, Person, Practitioner, RelatedPerson)
    'gender': ['male', 'female', 'other', 'unknown'],

    // Address use
    'address.use': ['home', 'work', 'temp', 'old'],

    // Address type
    'address.type': ['postal', 'physical', 'both'],

    // Contact point system
    'telecom.system': ['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'],

    // Contact point use
    'telecom.use': ['home', 'work', 'temp', 'old', 'mobile'],

    // Name use
    'name.use': ['usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden'],

    // Identifier use
    'identifier.use': ['usual', 'official', 'temp', 'secondary'],

    // Status values for various resources
    'status': ['active', 'inactive', 'entered-in-error'],

    // Appointment status
    'Appointment.status': ['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error'],

    // Encounter status
    'Encounter.status': ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'],

    // Observation status
    'Observation.status': ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'],

    // MedicationRequest status
    'MedicationRequest.status': ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'],

    // Condition clinical status
    'Condition.clinicalStatus': ['active', 'recurrence', 'inactive', 'remission', 'resolved'],

    // Condition verification status
    'Condition.verificationStatus': ['provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error', 'unknown'],

    // _summary parameter values
    '_summary': ['true', 'false', 'text', 'data', 'count']
  };

  /**
   * Get all resource types
   */
  getResourceTypes(): string[] {
    return [...this.resourceTypes];
  }

  /**
   * Search resource types by prefix
   */
  searchResourceTypes(prefix: string): string[] {

    if (!prefix) {
      return this.resourceTypes
    }

    const lowerPrefix = prefix.toLowerCase();

    return this.resourceTypes.filter(type =>
      type.toLowerCase().startsWith(lowerPrefix)
    );
  }

  /**
   * Check if a string is a valid resource type
   */
  isValidResourceType(type: string): boolean {
    return this.resourceTypes.includes(type);
  }

  /**
   * Get modifiers for a parameter type
   */
  getModifiers(paramType: string): string[] {
    return this.modifiers[paramType] || [];
  }

  /**
   * Get prefix operators (for date, number, quantity types)
   */
  getPrefixOperators(): typeof this.prefixOperators {
    return [...this.prefixOperators];
  }

  /**
   * Get global search parameters
   */
  getGlobalParameters(): typeof this.globalParameters {
    return [...this.globalParameters];
  }

  /**
   * Get enum values for a field
   */
  getEnumValues(fieldPath: string): string[] | undefined {
    return this.enumValues[fieldPath];
  }

  /**
   * Search global parameters by prefix
   */
  searchGlobalParameters(prefix: string): typeof this.globalParameters {

    if (!prefix) {
      return this.globalParameters;
    }

    const lowerPrefix = prefix.toLowerCase();

    return this.globalParameters.filter(param =>
      param.name.toLowerCase().startsWith(lowerPrefix)
    );
  }
}
