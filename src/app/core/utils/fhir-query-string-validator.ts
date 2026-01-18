/**
 * Result of validating a FHIR query string
 */
export interface ValidationResult {
  /** Whether the query is valid (no errors) */
  valid: boolean;
  /** List of validation errors that cause the query to be invalid */
  errors: ValidationError[];
  /** List of validation warnings that don't invalidate the query */
  warnings: ValidationWarning[];
  /** Parsed query structure, or null if parsing failed */
  parsed: ParsedFhirQuery | null;
}

/**
 * Represents a validation error that causes the query to be invalid
 */
export interface ValidationError {
  /** Discriminator for error type */
  type: 'error';
  /** Human-readable error message */
  message: string;
  /** Character position in the query where the error occurred */
  position?: number;
  /** Name of the parameter that caused the error */
  parameter?: string;
}

/**
 * Represents a validation warning that doesn't invalidate the query
 */
export interface ValidationWarning {
  /** Discriminator for warning type */
  type: 'warning';
  /** Human-readable warning message */
  message: string;
  /** Name of the parameter that caused the warning */
  parameter?: string;
}

/**
 * Parsed structure of a FHIR query
 */
export interface ParsedFhirQuery {
  /** The FHIR resource type (e.g., "Patient", "Observation") */
  resourceType?: string;
  /** Resource ID for read operations (e.g., "123" in /Patient/123) */
  resourceId?: string;
  /** Version ID for vread operations (e.g., "1" in /Patient/123/_history/1) */
  versionId?: string;
  /** List of parsed search parameters */
  parameters: ParsedParameter[];
}

/**
 * Represents a single parsed search parameter from the query
 */
export interface ParsedParameter {
  /** Parameter name (e.g., "name", "_id", "subject") */
  name: string;
  /** Search modifier (e.g., "exact", "contains", "missing") */
  modifier?: string;
  /** Chained parameter path for reference parameters */
  chainedPath?: string[];
  /** Parameter value after URL decoding */
  value: string;
  /** Value prefix for date/number/quantity comparisons (e.g., "gt", "le") */
  prefix?: string;
}

/**
 * Configuration options for the FHIR query validator
 */
export interface FhirQueryValidatorOptions {
  /** Enable strict validation mode for stricter checking */
  strictMode?: boolean;
  /** Additional resource types to recognize as valid */
  customResourceTypes?: string[];
  /** Additional modifiers to recognize as valid */
  customModifiers?: string[];
}

/**
 * Validates FHIR search query strings according to the FHIR specification.
 *
 * Supports validation of:
 * - Resource types
 * - Search parameters and their values
 * - Parameter modifiers (e.g., :exact, :contains, :missing)
 * - Chained parameters (e.g., subject:Patient.name)
 * - Special parameters (_id, _include, _sort, _count, etc.)
 * - Value prefixes for comparisons (eq, ne, gt, lt, ge, le, sa, eb, ap)
 *
 * @example
 * ```typescript
 * const validator = new FhirQueryValidator();
 * const result = validator.validate('/Patient?name=John&_count=10');
 * if (result.valid) {
 *   console.log('Query is valid');
 * } else {
 *   console.log('Errors:', result.errors);
 * }
 * ```
 */
export class FhirQueryValidator {
  /** Whether strict validation mode is enabled */
  private readonly strictMode: boolean;

  /** Set of valid resource types (lowercase) */
  private readonly resourceTypes: Set<string>;

  /** Set of valid modifiers (lowercase) */
  private readonly modifiers: Set<string>;

  /**
   * Valid FHIR search modifiers organized by parameter type.
   * Each parameter type supports a specific subset of modifiers.
   */
  private static readonly DEFAULT_MODIFIERS = {
    string: ['exact', 'contains', 'missing', 'text'],
    token: ['missing', 'text', 'not', 'of-type', 'in', 'not-in', 'above', 'below'],
    reference: ['missing', 'type', 'identifier'],
    date: ['missing'],
    number: ['missing'],
    quantity: ['missing'],
    uri: ['missing', 'above', 'below'],
    composite: ['missing'],
  } as const;

  /**
   * Valid prefixes for date, number, and quantity parameter values.
   * These prefixes specify comparison operators.
   */
  private static readonly VALUE_PREFIXES = ['eq', 'ne', 'gt', 'lt', 'ge', 'le', 'sa', 'eb', 'ap'] as const;

  /**
   * Special FHIR search parameters that apply across all resource types.
   * These include result parameters, include/revinclude, and format parameters.
   */
  private static readonly SPECIAL_PARAMETERS = [
    '_id', '_lastUpdated', '_tag', '_profile', '_security', '_text', '_content',
    '_list', '_has', '_type', '_query', '_filter',
    '_include', '_revinclude',
    '_sort', '_count', '_offset', '_total',
    '_summary', '_elements', '_contained', '_containedType',
    '_format', '_pretty',
  ] as const;

  /**
   * Common FHIR R4 resource types used for validation.
   * Custom resource types can be added via constructor options or addResourceTypes().
   */
  private static readonly DEFAULT_RESOURCE_TYPES = [
    'Patient', 'Practitioner', 'Organization', 'Location', 'Encounter',
    'Condition', 'Observation', 'Procedure', 'MedicationRequest', 'Medication',
    'DiagnosticReport', 'CarePlan', 'CareTeam', 'Goal', 'AllergyIntolerance',
    'Immunization', 'DocumentReference', 'Consent', 'Coverage', 'Claim',
    'Bundle', 'Composition', 'OperationOutcome', 'CapabilityStatement',
    'StructureDefinition', 'ValueSet', 'CodeSystem', 'ConceptMap',
    'Appointment', 'Schedule', 'Slot', 'Task', 'ServiceRequest',
    'Communication', 'QuestionnaireResponse', 'Questionnaire',
    'RelatedPerson', 'Person', 'Group', 'Device', 'Specimen',
    'FamilyMemberHistory', 'RiskAssessment', 'DetectedIssue',
    'EpisodeOfCare', 'Flag', 'List', 'Basic', 'Binary', 'Media',
    'PractitionerRole', 'HealthcareService', 'Endpoint',
  ] as const;

  /**
   * Creates a new FHIR query validator instance.
   *
   * @param options - Configuration options for the validator
   */
  constructor(options: FhirQueryValidatorOptions = {}) {
    this.strictMode = options.strictMode ?? false;

    const defaultTypes = FhirQueryValidator.DEFAULT_RESOURCE_TYPES.map(r => r.toLowerCase());
    const customTypes = (options.customResourceTypes ?? []).map(r => r.toLowerCase());
    this.resourceTypes = new Set([...defaultTypes, ...customTypes]);

    const defaultModifiers = Object.values(FhirQueryValidator.DEFAULT_MODIFIERS).flat();
    const customModifiers = options.customModifiers ?? [];
    this.modifiers = new Set([...defaultModifiers, ...customModifiers, ...this.resourceTypes]);
  }

  /**
   * Validates a FHIR query string and returns detailed validation results.
   *
   * Accepts queries in the following formats:
   * - `/ResourceType?param=value` (search)
   * - `/ResourceType/id` (read)
   * - `/ResourceType/id/_history/vid` (vread)
   * - `ResourceType?param=value`
   * - `/fhir/ResourceType?param=value`
   * - `/fhir/r4/ResourceType?param=value`
   * - `param=value` (query string only)
   *
   * @param query - The FHIR query string to validate
   * @returns Validation result containing validity status, errors, warnings, and parsed structure
   */
  validate(query: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const parameters: ParsedParameter[] = [];

    if (!query || query.trim() === '') {
      return {
        valid: true,
        errors: [],
        warnings: [],
        parsed: {parameters: []},
      };
    }

    let resourceType: string | undefined;
    let resourceId: string | undefined;
    let versionId: string | undefined;
    let queryString = query;

    // Match patterns including resource ID and version:
    // /ResourceType, /ResourceType?params, /ResourceType/id, /ResourceType/id/_history/vid
    const urlMatch = query.match(
      /^(?:\/)?(?:fhir\/)?(?:r[34]\/)?([A-Z][a-zA-Z]+)(?:\/([A-Za-z0-9.-]+))?(?:\/_history\/([A-Za-z0-9.-]+))?(?:\?(.*))?$/i
    );

    if (urlMatch) {
      const [, resource, id, version, qs] = urlMatch;

      if (resource) {
        resourceType = resource;

        if (!this.isValidResourceType(resource)) {
          warnings.push({
            type: 'warning',
            message: `Unknown resource type: '${resource}'. This may be valid for custom resources.`,
          });
        }
      }

      if (id) {
        resourceId = id;
      }

      if (version) {
        versionId = version;
      }

      queryString = qs || '';
    } else if (query.includes('=')) {
      queryString = query.startsWith('?') ? query.slice(1) : query;
    } else {
      errors.push({
        type: 'error',
        message: 'Invalid query format. Expected format: /ResourceType, /ResourceType/id, or /ResourceType?param=value',
      });
      return {valid: false, errors, warnings, parsed: null};
    }

    if (queryString) {
      const paramPairs = this.splitQueryString(queryString);

      for (const pair of paramPairs) {
        const result = this.parseAndValidateParameter(pair);

        if (result.error) {
          errors.push(result.error);
        }
        if (result.warning) {
          warnings.push(result.warning);
        }
        if (result.parsed) {
          parameters.push(result.parsed);
        }
      }
    }

    this.validateParameterCombinations(parameters, warnings, errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      parsed: {
        resourceType,
        resourceId,
        versionId,
        parameters,
      },
    };
  }

  /**
   * Performs a quick validation check on a FHIR query string.
   *
   * @param query - The FHIR query string to validate
   * @returns True if the query is valid (no errors), false otherwise
   */
  isValid(query: string): boolean {
    return this.validate(query).valid;
  }

  /**
   * Adds custom resource types to the validator.
   * Resource types are also added as valid modifiers for reference parameters.
   *
   * @param types - Resource type names to add
   * @returns This validator instance for method chaining
   */
  addResourceTypes(...types: string[]): this {
    for (const type of types) {
      const lower = type.toLowerCase();
      this.resourceTypes.add(lower);
      this.modifiers.add(lower);
    }
    return this;
  }

  /**
   * Adds custom modifiers to the validator.
   *
   * @param modifiers - Modifier names to add
   * @returns This validator instance for method chaining
   */
  addModifiers(...modifiers: string[]): this {
    for (const modifier of modifiers) {
      this.modifiers.add(modifier.toLowerCase());
    }
    return this;
  }

  /**
   * Checks if a resource type is recognized as valid.
   *
   * @param type - Resource type name to check
   * @returns True if the resource type is valid
   */
  isValidResourceType(type: string): boolean {
    return this.resourceTypes.has(type.toLowerCase());
  }

  /**
   * Checks if a modifier is recognized as valid.
   *
   * @param modifier - Modifier name to check
   * @returns True if the modifier is valid
   */
  isValidModifier(modifier: string): boolean {
    return this.modifiers.has(modifier.toLowerCase());
  }

  /**
   * Splits a query string into individual parameter pairs.
   * Handles nested parentheses and brackets correctly.
   *
   * @param qs - Query string without the leading '?'
   * @returns Array of parameter pairs (e.g., ["name=John", "_count=10"])
   */
  private splitQueryString(qs: string): string[] {
    const pairs: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of qs) {
      if (char === '(' || char === '[') {
        depth++;
        current += char;
      } else if (char === ')' || char === ']') {
        depth--;
        current += char;
      } else if (char === '&' && depth === 0) {
        if (current) {
          pairs.push(current);
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      pairs.push(current);
    }
    return pairs;
  }

  /**
   * Parses and validates a single parameter pair.
   *
   * @param pair - Parameter pair string (e.g., "name=John")
   * @returns Object containing parsed parameter, error, and/or warning
   */
  private parseAndValidateParameter(pair: string): {
    parsed?: ParsedParameter;
    error?: ValidationError;
    warning?: ValidationWarning;
  } {
    const eqIndex = pair.indexOf('=');

    if (eqIndex === -1) {
      return {
        error: {
          type: 'error',
          message: `Invalid parameter format: '${pair}'. Expected format: name=value`,
          parameter: pair,
        },
      };
    }

    const rawName = pair.slice(0, eqIndex);
    const value = pair.slice(eqIndex + 1);

    if (!rawName) {
      return {
        error: {
          type: 'error',
          message: 'Empty parameter name',
          parameter: pair,
        },
      };
    }

    const {name, modifier, chainedPath, error} = this.parseParameterName(rawName);

    if (error) {
      return {error};
    }

    const parsed: ParsedParameter = {
      name,
      value: decodeURIComponent(value),
    };

    if (modifier) {
      parsed.modifier = modifier;
    }

    if (chainedPath && chainedPath.length > 0) {
      parsed.chainedPath = chainedPath;
    }

    const valueValidation = this.validateParameterValue(name, value, modifier);

    if (valueValidation.prefix) {
      parsed.prefix = valueValidation.prefix;
    }

    return {
      parsed,
      warning: valueValidation.warning,
      error: valueValidation.error,
    };
  }

  /**
   * Parses a parameter name to extract the base name, modifier, and chained path.
   * Handles formats like:
   * - `name` (simple parameter)
   * - `name:exact` (parameter with modifier)
   * - `subject:Patient.name` (chained parameter with type)
   * - `subject.name` (chained parameter without type)
   *
   * @param rawName - Raw parameter name from the query string
   * @returns Object containing parsed name, modifier, chainedPath, and/or error
   */
  private parseParameterName(rawName: string): {
    name: string;
    modifier?: string;
    chainedPath?: string[];
    error?: ValidationError;
  } {
    const chainMatch = rawName.match(
      /^([a-zA-Z_][a-zA-Z0-9_-]*)(?::([A-Z][a-zA-Z]+))?((?:\.[a-zA-Z_][a-zA-Z0-9_-]*)*)(?::([a-zA-Z-]+))?$/
    );

    if (!chainMatch) {
      const simpleMatch = rawName.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)(?::([a-zA-Z-]+))?$/);

      if (!simpleMatch) {
        return {
          name: rawName,
          error: {
            type: 'error',
            message: `Invalid parameter name format: '${rawName}'`,
            parameter: rawName,
          },
        };
      }

      const [, name, modifier] = simpleMatch;

      if (modifier && !this.isValidModifier(modifier)) {
        return {
          name,
          modifier,
          error: {
            type: 'error',
            message: `Unknown modifier ":${modifier}" on parameter "${name}"`,
            parameter: rawName,
          },
        };
      }

      return {name, modifier};
    }

    const [, baseName, typeModifier, chainPart, endModifier] = chainMatch;
    const chainedPath: string[] = [];

    if (typeModifier) {
      chainedPath.push(typeModifier);
    }

    if (chainPart) {
      const chainSegments = chainPart.slice(1).split('.');
      chainedPath.push(...chainSegments);
    }

    if (endModifier && !this.isValidModifier(endModifier)) {
      return {
        name: baseName,
        chainedPath: chainedPath.length > 0 ? chainedPath : undefined,
        modifier: endModifier,
        error: {
          type: 'error',
          message: `Unknown modifier ":${endModifier}"`,
          parameter: rawName,
        },
      };
    }

    return {
      name: baseName,
      chainedPath: chainedPath.length > 0 ? chainedPath : undefined,
      modifier: endModifier,
    };
  }

  /**
   * Validates a parameter value based on the parameter name and modifier.
   * Performs specific validation for special parameters like _summary, _count, _include, etc.
   *
   * @param name - Parameter name
   * @param value - Parameter value (URL-encoded)
   * @param modifier - Optional modifier on the parameter
   * @returns Object containing extracted prefix, warning, and/or error
   */
  private validateParameterValue(name: string, value: string, modifier?: string): {
    prefix?: string;
    warning?: ValidationWarning;
    error?: ValidationError;
  } {
    if (!value) {
      return {
        error: {
          type: 'error',
          message: `Parameter '${name}' requires a value`,
          parameter: name,
        },
      };
    }

    if (modifier === 'missing' && value !== 'true' && value !== 'false') {
      return {
        error: {
          type: 'error',
          message: `Parameter '${name}:missing' must have value 'true' or 'false', got: '${value}'`,
          parameter: name,
        },
      };
    }

    const prefixMatch = value.match(/^(eq|ne|gt|lt|ge|le|sa|eb|ap)(.+)$/);
    const prefix = prefixMatch?.[1];

    if (value.includes('|')) {
      const parts = value.split('|');

      if (parts.length > 2) {
        return {
          warning: {
            type: 'warning',
            message: `Token value has multiple '|' separators: "${value}"`,
            parameter: name,
          },
        };
      }
    }

    if (name === '_include' || name === '_revinclude') {
      const includeMatch = value.match(/^([A-Z][a-zA-Z]+):([a-zA-Z]+)(?::([A-Z][a-zA-Z]+))?$/);

      if (!includeMatch) {
        return {
          error: {
            type: 'error',
            message: `Invalid ${name} format: '${value}'. Expected: ResourceType:searchParam[:targetType]`,
            parameter: name,
          },
        };
      }
    }

    if (name === '_sort') {
      const sortParams = value.split(',');

      for (const sortParam of sortParams) {
        if (!sortParam.match(/^-?[a-zA-Z_][a-zA-Z0-9_.-]*$/)) {
          return {
            error: {
              type: 'error',
              message: `Invalid _sort parameter: '${sortParam}'`,
              parameter: name,
            },
          };
        }
      }
    }

    if ((name === '_count' || name === '_offset') && !value.match(/^\d+$/)) {
      return {
        error: {
          type: 'error',
          message: `${name} must be a positive integer, got: '${value}'`,
          parameter: name,
        },
      };
    }

    if (name === '_summary') {
      const validSummary = ['true', 'false', 'text', 'data', 'count'];

      if (!validSummary.includes(value)) {
        return {
          error: {
            type: 'error',
            message: `Invalid _summary value: '${value}'. Valid values: ${validSummary.join(', ')}`,
            parameter: name,
          },
        };
      }
    }

    if (name === '_total') {
      const validTotal = ['none', 'estimate', 'accurate'];

      if (!validTotal.includes(value)) {
        return {
          error: {
            type: 'error',
            message: `Invalid _total value: '${value}'. Valid values: ${validTotal.join(', ')}`,
            parameter: name,
          },
        };
      }
    }

    return {prefix};
  }

  /**
   * Validates combinations of parameters and checks for common issues.
   * Currently checks for:
   * - Duplicate parameters (issues warning)
   * - _offset without _count (issues warning)
   *
   * @param parameters - Array of parsed parameters
   * @param warnings - Array to add warnings to
   * @param _errors - Array to add errors to (reserved for future use)
   */
  private validateParameterCombinations(parameters: ParsedParameter[], warnings: ValidationWarning[], _errors: ValidationError[]): void {
    const paramNames = parameters.map(p => p.name);

    const seen = new Set<string>();
    for (const param of parameters) {
      const key = param.chainedPath
                  ? `${param.name}:${param.chainedPath.join('.')}`
                  : param.name;

      if (
        seen.has(key) &&
        !['_include', '_revinclude', '_tag', '_security', '_profile'].includes(param.name)
      ) {
        warnings.push({
          type: 'warning',
          message: `Duplicate parameter: '${key}' (values will be OR'd)`,
          parameter: key,
        });
      }
      seen.add(key);
    }

    if (paramNames.includes('_offset') && !paramNames.includes('_count')) {
      warnings.push({
        type: 'warning',
        message: '_offset used without _count - behavior may be undefined',
      });
    }
  }
}

/** Default singleton instance of the FHIR query validator */
export const fhirQueryValidator = new FhirQueryValidator();

/**
 * Convenience function to validate a FHIR query string using the default validator.
 *
 * @param query - The FHIR query string to validate
 * @returns Validation result
 */
export const validateFhirQuery = (query: string): ValidationResult => fhirQueryValidator.validate(query);

/**
 * Convenience function to check if a FHIR query string is valid using the default validator.
 *
 * @param query - The FHIR query string to validate
 * @returns True if valid, false otherwise
 */
export const isValidFhirQuery = (query: string): boolean => fhirQueryValidator.isValid(query);
