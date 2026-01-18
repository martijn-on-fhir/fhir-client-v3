import { Injectable } from '@angular/core';

/**
 * Context types for FHIRPath expression parsing
 */
export type FhirPathContext =
  | 'root'           // Beginning of expression
  | 'property'       // After '.' - expecting property
  | 'function'       // After '.' - expecting function (when typing function name)
  | 'filter_expr'    // Inside where() - filter expression
  | 'oftype_value';  // Inside ofType() - type name

/**
 * FHIRPath autocomplete suggestion
 */
export interface FhirPathSuggestion {
  label: string;
  insertText: string;
  category: 'property' | 'function' | 'type';
  description?: string;
  signature?: string;
}

/**
 * Parse result from expression analysis
 */
export interface FhirPathParseResult {
  context: FhirPathContext;
  currentPath: string;
  prefix: string;
  insideFunction?: string;
}

/**
 * FHIRPath function definition
 */
interface FhirPathFunction {
  name: string;
  signature: string;
  description: string;
  category: 'collection' | 'existence' | 'subsetting' | 'aggregate' | 'string' | 'type' | 'math' | 'boolean';
}

/**
 * FHIRPath Autocomplete Service
 *
 * Provides intelligent autocomplete suggestions for FHIRPath expressions
 * based on the JSON data structure and cursor position.
 */
@Injectable({
  providedIn: 'root'
})
export class FhirpathAutocompleteService {

  /**
   * FHIRPath functions database with signatures and descriptions
   */
  private readonly fhirPathFunctions: FhirPathFunction[] = [
    // Collection functions
    { name: 'where', signature: '(criteria)', description: 'Filter collection by criteria', category: 'collection' },
    { name: 'select', signature: '(projection)', description: 'Transform each element', category: 'collection' },
    { name: 'ofType', signature: '(type)', description: 'Filter by FHIR resource type', category: 'collection' },
    { name: 'repeat', signature: '(expression)', description: 'Recursively evaluate expression', category: 'collection' },

    // Existence functions
    { name: 'exists', signature: '([criteria])', description: 'Check if collection has elements', category: 'existence' },
    { name: 'empty', signature: '()', description: 'Check if collection is empty', category: 'existence' },
    { name: 'all', signature: '(criteria)', description: 'Check if all elements match criteria', category: 'existence' },
    { name: 'allTrue', signature: '()', description: 'Check if all elements are true', category: 'existence' },
    { name: 'anyTrue', signature: '()', description: 'Check if any element is true', category: 'existence' },
    { name: 'allFalse', signature: '()', description: 'Check if all elements are false', category: 'existence' },
    { name: 'anyFalse', signature: '()', description: 'Check if any element is false', category: 'existence' },

    // Subsetting functions
    { name: 'first', signature: '()', description: 'Get first element', category: 'subsetting' },
    { name: 'last', signature: '()', description: 'Get last element', category: 'subsetting' },
    { name: 'tail', signature: '()', description: 'Get all but first element', category: 'subsetting' },
    { name: 'take', signature: '(num)', description: 'Get first N elements', category: 'subsetting' },
    { name: 'skip', signature: '(num)', description: 'Skip first N elements', category: 'subsetting' },
    { name: 'single', signature: '()', description: 'Get single element or error', category: 'subsetting' },

    // Aggregate functions
    { name: 'count', signature: '()', description: 'Count elements in collection', category: 'aggregate' },
    { name: 'distinct', signature: '()', description: 'Get unique elements', category: 'aggregate' },
    { name: 'isDistinct', signature: '()', description: 'Check if all elements are unique', category: 'aggregate' },

    // String functions
    { name: 'startsWith', signature: '(prefix)', description: 'Check if string starts with prefix', category: 'string' },
    { name: 'endsWith', signature: '(suffix)', description: 'Check if string ends with suffix', category: 'string' },
    { name: 'contains', signature: '(substring)', description: 'Check if string contains substring', category: 'string' },
    { name: 'matches', signature: '(regex)', description: 'Match against regular expression', category: 'string' },
    { name: 'replace', signature: '(pattern, replacement)', description: 'Replace pattern with replacement', category: 'string' },
    { name: 'length', signature: '()', description: 'Get string length', category: 'string' },
    { name: 'toChars', signature: '()', description: 'Convert string to characters', category: 'string' },
    { name: 'upper', signature: '()', description: 'Convert to uppercase', category: 'string' },
    { name: 'lower', signature: '()', description: 'Convert to lowercase', category: 'string' },
    { name: 'substring', signature: '(start[, length])', description: 'Extract substring', category: 'string' },
    { name: 'indexOf', signature: '(substring)', description: 'Find index of substring', category: 'string' },
    { name: 'trim', signature: '()', description: 'Remove leading/trailing whitespace', category: 'string' },
    { name: 'split', signature: '(separator)', description: 'Split string by separator', category: 'string' },
    { name: 'join', signature: '([separator])', description: 'Join collection to string', category: 'string' },

    // Type functions
    { name: 'is', signature: '(type)', description: 'Check if value is of type', category: 'type' },
    { name: 'as', signature: '(type)', description: 'Cast value to type', category: 'type' },
    { name: 'toBoolean', signature: '()', description: 'Convert to boolean', category: 'type' },
    { name: 'toInteger', signature: '()', description: 'Convert to integer', category: 'type' },
    { name: 'toDecimal', signature: '()', description: 'Convert to decimal', category: 'type' },
    { name: 'toString', signature: '()', description: 'Convert to string', category: 'type' },
    { name: 'toDate', signature: '()', description: 'Convert to date', category: 'type' },
    { name: 'toDateTime', signature: '()', description: 'Convert to datetime', category: 'type' },
    { name: 'toTime', signature: '()', description: 'Convert to time', category: 'type' },
    { name: 'toQuantity', signature: '([unit])', description: 'Convert to quantity', category: 'type' },

    // Math functions
    { name: 'abs', signature: '()', description: 'Absolute value', category: 'math' },
    { name: 'ceiling', signature: '()', description: 'Round up', category: 'math' },
    { name: 'floor', signature: '()', description: 'Round down', category: 'math' },
    { name: 'round', signature: '([precision])', description: 'Round to precision', category: 'math' },
    { name: 'exp', signature: '()', description: 'Natural exponent', category: 'math' },
    { name: 'ln', signature: '()', description: 'Natural logarithm', category: 'math' },
    { name: 'log', signature: '(base)', description: 'Logarithm with base', category: 'math' },
    { name: 'power', signature: '(exponent)', description: 'Raise to power', category: 'math' },
    { name: 'sqrt', signature: '()', description: 'Square root', category: 'math' },
    { name: 'truncate', signature: '()', description: 'Truncate decimal', category: 'math' },

    // Boolean/utility functions
    { name: 'not', signature: '()', description: 'Logical negation', category: 'boolean' },
    { name: 'iif', signature: '(criterion, true-result[, otherwise-result])', description: 'Conditional expression', category: 'boolean' },
    { name: 'trace', signature: '(name[, projection])', description: 'Debug output', category: 'boolean' }
  ];

  /**
   * Common FHIR resource types for ofType() suggestions
   */
  private readonly fhirResourceTypes: string[] = [
    'Patient', 'Practitioner', 'PractitionerRole', 'Organization', 'Location',
    'Encounter', 'Condition', 'Observation', 'Procedure', 'MedicationRequest',
    'MedicationStatement', 'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
    'CarePlan', 'Goal', 'ServiceRequest', 'DocumentReference', 'Composition',
    'Consent', 'Coverage', 'Claim', 'ExplanationOfBenefit', 'RelatedPerson',
    'Device', 'Specimen', 'ImagingStudy', 'Media', 'QuestionnaireResponse',
    'Bundle', 'OperationOutcome', 'Binary', 'Parameters'
  ];

  /**
   * Parse a FHIRPath expression to determine the context at cursor position
   */
  parseExpression(expression: string, cursorPosition: number): FhirPathParseResult {
    const textBeforeCursor = expression.substring(0, cursorPosition);

    // Default result
    const result: FhirPathParseResult = {
      context: 'root',
      currentPath: '',
      prefix: ''
    };

    if (!textBeforeCursor.trim()) {
      return result;
    }

    // Check if we're inside ofType()
    const ofTypeMatch = textBeforeCursor.match(/\.ofType\(([A-Za-z]*)$/);
    if (ofTypeMatch) {
      result.context = 'oftype_value';
      result.prefix = ofTypeMatch[1];
      result.currentPath = this.extractPathBeforeFunction(textBeforeCursor, 'ofType');
      return result;
    }

    // Check if we're inside where() - filter expression context
    const whereMatch = this.findOpenFunction(textBeforeCursor, 'where');
    if (whereMatch.isInside) {
      result.context = 'filter_expr';
      result.currentPath = whereMatch.pathBefore;
      result.insideFunction = 'where';

      // Find the prefix (what user is typing after the last .)
      const insideExpr = whereMatch.contentInside;
      const lastDot = insideExpr.lastIndexOf('.');
      if (lastDot >= 0) {
        result.prefix = insideExpr.substring(lastDot + 1);
      } else {
        result.prefix = insideExpr;
      }
      return result;
    }

    // Check if we're typing after a dot (property or function)
    const dotMatch = textBeforeCursor.match(/\.([a-zA-Z]*)$/);
    if (dotMatch) {
      result.context = 'property';
      result.prefix = dotMatch[1];
      result.currentPath = this.extractCurrentPath(textBeforeCursor.slice(0, -dotMatch[0].length));
      return result;
    }

    // At root level, typing the start of an expression
    const rootMatch = textBeforeCursor.match(/^([a-zA-Z]*)$/);
    if (rootMatch) {
      result.context = 'root';
      result.prefix = rootMatch[1];
      return result;
    }

    return result;
  }

  /**
   * Get autocomplete suggestions based on parse result and JSON data
   */
  getSuggestions(parseResult: FhirPathParseResult, data: any): FhirPathSuggestion[] {
    const suggestions: FhirPathSuggestion[] = [];
    const lowerPrefix = parseResult.prefix.toLowerCase();

    switch (parseResult.context) {
      case 'root':
        // At root, suggest top-level properties and functions
        suggestions.push(...this.getPropertySuggestions(data, lowerPrefix));
        suggestions.push(...this.getFunctionSuggestions(lowerPrefix));
        break;

      case 'property': {
        // After a dot, suggest properties at the current path and functions
        const propertiesAtPath = this.extractPropertiesAtPath(data, parseResult.currentPath);
        suggestions.push(...this.getPropertySuggestions(propertiesAtPath, lowerPrefix));
        suggestions.push(...this.getFunctionSuggestions(lowerPrefix));
        break;
      }

      case 'filter_expr': {
        // Inside where(), suggest properties of the collection elements
        const filterData = this.extractPropertiesAtPath(data, parseResult.currentPath);
        // Get the first element if it's an array
        const elementData = Array.isArray(filterData) ? filterData[0] : filterData;
        suggestions.push(...this.getPropertySuggestions(elementData, lowerPrefix));
        suggestions.push(...this.getFunctionSuggestions(lowerPrefix));
        break;
      }

      case 'oftype_value':
        // Inside ofType(), suggest resource types
        suggestions.push(...this.getResourceTypeSuggestions(lowerPrefix));
        break;
    }

    // Sort: exact prefix matches first, then alphabetically
    return suggestions.sort((a, b) => {
      const aExact = a.label.toLowerCase().startsWith(lowerPrefix);
      const bExact = b.label.toLowerCase().startsWith(lowerPrefix);

      if (aExact && !bExact) {
        return -1;
      }

      if (!aExact && bExact) {
        return 1;
      }

      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Apply a suggestion to the expression
   */
  applySuggestion(
    expression: string,
    cursorPosition: number,
    suggestion: FhirPathSuggestion
  ): { newExpression: string; newCursorPosition: number } {
    const parsed = this.parseExpression(expression, cursorPosition);
    const textBeforeCursor = expression.substring(0, cursorPosition);
    const textAfterCursor = expression.substring(cursorPosition);

    // Remove the prefix from before cursor and insert the suggestion
    const prefixLength = parsed.prefix.length;
    const beforePrefix = textBeforeCursor.substring(0, textBeforeCursor.length - prefixLength);

    const newExpression = beforePrefix + suggestion.insertText + textAfterCursor;
    let newCursorPosition = beforePrefix.length + suggestion.insertText.length;

    // For functions with parameters, position cursor inside parentheses
    if (suggestion.category === 'function' && suggestion.insertText.endsWith('()')) {
      newCursorPosition = newCursorPosition - 1; // Before the closing paren
    } else if (suggestion.category === 'function' && suggestion.insertText.includes('(')) {
      // Has parameters, position after opening paren
      newCursorPosition = beforePrefix.length + suggestion.insertText.indexOf('(') + 1;
    }

    return { newExpression, newCursorPosition };
  }

  /**
   * Extract properties from JSON data that match the prefix
   */
  private getPropertySuggestions(data: any, prefix: string): FhirPathSuggestion[] {
    if (!data || typeof data !== 'object') {
      return [];
    }

    // If data is an array, get properties from the first element
    const obj = Array.isArray(data) ? data[0] : data;
    if (!obj || typeof obj !== 'object') {
      return [];
    }

    const suggestions: FhirPathSuggestion[] = [];

    for (const key of Object.keys(obj)) {
      if (key.toLowerCase().startsWith(prefix)) {
        const value = obj[key];
        let description = '';

        if (Array.isArray(value)) {
          description = `Array (${value.length} items)`;
        } else if (typeof value === 'object' && value !== null) {
          description = 'Object';
        } else if (typeof value === 'string') {
          description = value.length > 30 ? value.substring(0, 30) + '...' : value;
        } else {
          description = String(value);
        }

        suggestions.push({
          label: key,
          insertText: key,
          category: 'property',
          description
        });
      }
    }

    return suggestions;
  }

  /**
   * Get function suggestions matching the prefix
   */
  private getFunctionSuggestions(prefix: string): FhirPathSuggestion[] {
    return this.fhirPathFunctions
      .filter(fn => fn.name.toLowerCase().startsWith(prefix))
      .map(fn => ({
        label: fn.name,
        insertText: fn.name + (fn.signature === '()' ? '()' : '('),
        category: 'function' as const,
        description: fn.description,
        signature: fn.signature
      }));
  }

  /**
   * Get resource type suggestions for ofType()
   */
  private getResourceTypeSuggestions(prefix: string): FhirPathSuggestion[] {
    return this.fhirResourceTypes
      .filter(type => type.toLowerCase().startsWith(prefix))
      .map(type => ({
        label: type,
        insertText: type + ')',
        category: 'type' as const,
        description: `FHIR ${type} resource`
      }));
  }

  /**
   * Extract the current path from the expression (before the last dot)
   */
  private extractCurrentPath(expression: string): string {
    // Remove any function calls and get the path
    const path = expression.trim();

    // Handle expressions like "name.where(use='official').given" -> "name"
    // We need to track the path segments without the function internals

    const segments: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of path) {
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === '.' && depth === 0) {
        if (current) {
          segments.push(current);
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      segments.push(current);
    }

    // Clean segments - remove function call syntax for path extraction
    return segments.map(s => s.replace(/\(.*\)$/, '')).join('.');
  }

  /**
   * Extract properties at a given path in the JSON data
   */
  private extractPropertiesAtPath(data: any, path: string): any {
    if (!data || !path) {
      return data;
    }

    const segments = this.parsePathSegments(path);
    let current = data;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return null;
      }

      // If current is an array, get the first element
      if (Array.isArray(current)) {
        current = current[0];
      }

      if (typeof current !== 'object') {
        return null;
      }

      current = current[segment];
    }

    return current;
  }

  /**
   * Parse path segments, handling function calls
   */
  private parsePathSegments(path: string): string[] {
    const segments: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of path) {
      if (char === '(') {
        depth++;
        // Skip function content for path extraction
      } else if (char === ')') {
        depth--;
      } else if (char === '.' && depth === 0) {
        if (current) {
          segments.push(current);
        }
        current = '';
      } else if (depth === 0) {
        current += char;
      }
    }

    if (current) {
      segments.push(current);
    }

    return segments;
  }

  /**
   * Find if cursor is inside a specific function call
   */
  private findOpenFunction(text: string, functionName: string): {
    isInside: boolean;
    pathBefore: string;
    contentInside: string;
  } {
    const result = { isInside: false, pathBefore: '', contentInside: '' };

    // Find the last occurrence of functionName(
    const funcPattern = new RegExp(`\\.${functionName}\\(`, 'g');
    let lastMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;

    while ((match = funcPattern.exec(text)) !== null) {
      lastMatch = match;
    }

    if (!lastMatch) {
      return result;
    }

    const funcStart = lastMatch.index + lastMatch[0].length;

    // Count parentheses after the function start
    let depth = 1;
    const textAfterFunc = text.substring(funcStart);

    for (const char of textAfterFunc) {
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      }

      if (depth === 0) {
        // Function is closed, cursor is not inside
        return result;
      }
    }

    // Still inside the function
    result.isInside = true;
    result.pathBefore = this.extractCurrentPath(text.substring(0, lastMatch.index));
    result.contentInside = text.substring(funcStart);

    return result;
  }

  /**
   * Extract path before a function call
   */
  private extractPathBeforeFunction(text: string, functionName: string): string {
    const pattern = new RegExp(`(.*?)\\.${functionName}\\([^)]*$`);
    const match = text.match(pattern);
    if (match) {
      return this.extractCurrentPath(match[1]);
    }
    return '';
  }
}
