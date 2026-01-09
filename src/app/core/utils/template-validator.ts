/**
 * Template Validator Utility
 *
 * Validates smart query templates for correctness and completeness.
 */

import { SmartQueryTemplate, TemplateParameter } from '../models/smart-template.model';

export interface TemplateValidationError {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

/**
 * Validate a template
 */
export const validateTemplate = (template: Partial<SmartQueryTemplate>): TemplateValidationError[] => {
  const errors: TemplateValidationError[] = [];

  // Required fields
  if (!template.name?.trim()) {
    errors.push({
      type: 'error',
      field: 'name',
      message: 'Template name is required'
    });
  }

  if (!template.description?.trim()) {
    errors.push({
      type: 'error',
      field: 'description',
      message: 'Template description is required'
    });
  }

  if (!template.category) {
    errors.push({
      type: 'error',
      field: 'category',
      message: 'Template category is required'
    });
  }

  if (!template.queryTemplate?.trim()) {
    errors.push({
      type: 'error',
      field: 'queryTemplate',
      message: 'Query template is required'
    });
  }

  // Query template validation
  if (template.queryTemplate) {
    // Extract parameter placeholders from query
    const queryParams = extractParametersFromQuery(template.queryTemplate);
    const definedParams = new Set((template.parameters || []).map(p => p.name));

    // Check for undefined parameters (used in query but not defined)
    queryParams.forEach(param => {
      if (!definedParams.has(param)) {
        errors.push({
          type: 'error',
          field: 'queryTemplate',
          message: `Parameter '${param}' is used in query but not defined`
        });
      }
    });

    // Check for unused parameters (defined but not used in query)
    definedParams.forEach(param => {
      if (!queryParams.has(param)) {
        errors.push({
          type: 'warning',
          field: 'parameters',
          message: `Parameter '${param}' is defined but not used in query`
        });
      }
    });
  }

  // Parameter validation
  if (template.parameters) {
    const paramNames = new Set<string>();

    template.parameters.forEach((param, index) => {
      const prefix = `parameters[${index}]`;

      // Check for duplicate parameter names
      if (paramNames.has(param.name)) {
        errors.push({
          type: 'error',
          field: prefix,
          message: `Duplicate parameter name: '${param.name}'`
        });
      }
      paramNames.add(param.name);

      // Validate parameter name format
      if (!isValidParameterName(param.name)) {
        errors.push({
          type: 'error',
          field: prefix,
          message: `Invalid parameter name: '${param.name}'. Use only letters, numbers, hyphens, and underscores.`
        });
      }

      // Check required fields
      if (!param.label?.trim()) {
        errors.push({
          type: 'error',
          field: `${prefix}.label`,
          message: 'Parameter label is required'
        });
      }

      // Type-specific validation
      if (param.type === 'choice' && (!param.choices || param.choices.length === 0)) {
        errors.push({
          type: 'error',
          field: `${prefix}.choices`,
          message: 'Choice type requires at least one option'
        });
      }

      if (param.type === 'number') {
        if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
          errors.push({
            type: 'error',
            field: `${prefix}.min/max`,
            message: 'Min value cannot be greater than max value'
          });
        }
      }

      // Validate regex pattern if provided
      if (param.pattern) {
        try {
          new RegExp(param.pattern);
        } catch {
          errors.push({
            type: 'error',
            field: `${prefix}.pattern`,
            message: 'Invalid regular expression pattern'
          });
        }
      }
    });
  }

  return errors;
};

/**
 * Validate parameter name
 */
export const validateParameterName = (
  name: string,
  existingParameters: TemplateParameter[],
  editIndex?: number
): string | null => {
  if (!name.trim()) {
    return 'Parameter name is required';
  }

  if (!isValidParameterName(name)) {
    return 'Parameter name must contain only letters, numbers, hyphens, and underscores';
  }

  // Check for duplicates
  const isDuplicate = existingParameters.some((param, index) => {
    if (editIndex !== undefined && index === editIndex) {
      return false; // Skip the parameter being edited
    }

    return param.name === name;
  });

  if (isDuplicate) {
    return 'A parameter with this name already exists';
  }

  return null;
};

/**
 * Check if parameter name is valid (alphanumeric, hyphen, underscore)
 */
const isValidParameterName = (name: string): boolean => /^[a-zA-Z0-9_-]+$/.test(name);

/**
 * Extract parameter names from query template
 */
export const extractParametersFromQuery = (query: string): Set<string> => {
  const params = new Set<string>();
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
  let match;

  while ((match = regex.exec(query)) !== null) {
    params.add(match[1]);
  }

  return params;
};

/**
 * Get default parameter values from template
 */
export const getDefaultParameterValues = (template: SmartQueryTemplate): Record<string, string> => {
  const values: Record<string, string> = {};

  template.parameters.forEach(param => {
    values[param.name] = param.default || '';
  });

  return values;
};
