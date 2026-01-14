import { Injectable, inject } from '@angular/core';
import { R3TypesService } from './r3-types.service';

/**
 * Query context - where in the query the cursor is
 */
export type QueryContext =
  | 'resource_type'      // After / - expecting resource type
  | 'parameter_name'     // After ? or & - expecting parameter name
  | 'modifier'           // After : - expecting modifier
  | 'parameter_value'    // After = - expecting value
  | 'unknown';

/**
 * Parsed query information
 */
export interface ParsedQuery {
  /** Full query string */
  query: string;
  /** Current cursor position */
  cursorPosition: number;
  /** Detected context at cursor */
  context: QueryContext;
  /** Resource type if detected */
  resourceType?: string;
  /** Current parameter name being edited */
  currentParam?: string;
  /** Current parameter type (from metadata) */
  currentParamType?: string;
  /** Text before cursor in current segment */
  prefix: string;
  /** Already used parameters in query */
  usedParams: string[];
}

/**
 * Autocomplete suggestion
 */
export interface Suggestion {
  /** Display text */
  label: string;
  /** Text to insert */
  insertText: string;
  /** Category/type of suggestion */
  category: 'resource' | 'parameter' | 'modifier' | 'operator' | 'value' | 'global';
  /** Optional description */
  description?: string;
  /** Parameter type (for parameters) */
  paramType?: string;
}

/**
 * Query Autocomplete Service
 *
 * Parses FHIR query strings and provides intelligent suggestions
 * based on cursor position and context.
 */
@Injectable({
  providedIn: 'root'
})
export class QueryAutocompleteService {
  private r3Types = inject(R3TypesService);

  /** Cached metadata from CapabilityStatement */
  private metadata: any = null;

  /**
   * Set metadata from CapabilityStatement
   */
  setMetadata(metadata: any): void {
    this.metadata = metadata;
  }

  /**
   * Parse query string and determine context at cursor position
   */
  parseQuery(query: string, cursorPosition: number): ParsedQuery {
    const result: ParsedQuery = {
      query,
      cursorPosition,
      context: 'unknown',
      prefix: '',
      usedParams: []
    };

    if (!query) {
      result.context = 'resource_type';
      result.prefix = '';
      return result;
    }

    // Extract resource type from query
    const resourceMatch = query.match(/^\/([A-Za-z]*)/);
    if (resourceMatch) {
      result.resourceType = resourceMatch[1];
    }

    // Find all used parameters
    const paramMatches = query.matchAll(/[?&]([a-zA-Z_][a-zA-Z0-9_.-]*)(?::[a-zA-Z]+)?=/g);
    for (const match of paramMatches) {
      result.usedParams.push(match[1]);
    }

    // Determine context based on cursor position
    const textBeforeCursor = query.substring(0, cursorPosition);

    // Check if we're typing a resource type (after / at start)
    if (textBeforeCursor.match(/^\/[A-Za-z]*$/)) {
      result.context = 'resource_type';
      result.prefix = textBeforeCursor.substring(1);
      return result;
    }

    // Check if we're typing a modifier (after :)
    const modifierMatch = textBeforeCursor.match(/[?&]([a-zA-Z_][a-zA-Z0-9_.-]*):([a-zA-Z]*)$/);
    if (modifierMatch) {
      result.context = 'modifier';
      result.currentParam = modifierMatch[1];
      result.prefix = modifierMatch[2];
      return result;
    }

    // Check if we're typing a parameter value (after =)
    const valueMatch = textBeforeCursor.match(/[?&]([a-zA-Z_][a-zA-Z0-9_.-]*)(?::([a-zA-Z]+))?=([^&]*)$/);
    if (valueMatch) {
      result.context = 'parameter_value';
      result.currentParam = valueMatch[1];
      result.prefix = valueMatch[3];
      // Get param type from metadata
      result.currentParamType = this.getParamType(result.resourceType, result.currentParam);
      return result;
    }

    // Check if we're typing a parameter name (after ? or &)
    const paramMatch = textBeforeCursor.match(/[?&]([a-zA-Z_][a-zA-Z0-9_.-]*)?$/);
    if (paramMatch) {
      result.context = 'parameter_name';
      result.prefix = paramMatch[1] || '';
      return result;
    }

    return result;
  }

  /**
   * Get suggestions based on parsed query
   */
  getSuggestions(parsedQuery: ParsedQuery): Suggestion[] {
    switch (parsedQuery.context) {
      case 'resource_type':
        return this.getResourceSuggestions(parsedQuery.prefix);

      case 'parameter_name':
        return this.getParameterSuggestions(
          parsedQuery.resourceType,
          parsedQuery.prefix,
          parsedQuery.usedParams
        );

      case 'modifier':
        return this.getModifierSuggestions(
          parsedQuery.resourceType,
          parsedQuery.currentParam,
          parsedQuery.prefix
        );

      case 'parameter_value':
        return this.getValueSuggestions(
          parsedQuery.resourceType,
          parsedQuery.currentParam,
          parsedQuery.currentParamType,
          parsedQuery.prefix
        );

      default:
        return [];
    }
  }

  /**
   * Get resource type suggestions
   */
  private getResourceSuggestions(prefix: string): Suggestion[] {
    const types = this.r3Types.searchResourceTypes(prefix);
    return types.map(type => ({
      label: type,
      insertText: type,
      category: 'resource' as const,
      description: `FHIR ${type} resource`
    }));
  }

  /**
   * Get search parameter suggestions
   */
  private getParameterSuggestions(
    resourceType: string | undefined,
    prefix: string,
    usedParams: string[]
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Add global parameters
    const globalParams = this.r3Types.searchGlobalParameters(prefix);
    for (const param of globalParams) {
      if (!usedParams.includes(param.name)) {
        suggestions.push({
          label: param.name,
          insertText: param.name + '=',
          category: 'global',
          description: param.description,
          paramType: param.type
        });
      }
    }

    // Add resource-specific parameters from metadata
    if (resourceType && this.metadata) {
      const resourceMeta = this.getResourceMetadata(resourceType);
      if (resourceMeta?.searchParam) {
        const lowerPrefix = prefix.toLowerCase();
        for (const param of resourceMeta.searchParam) {
          if (!usedParams.includes(param.name) &&
              param.name.toLowerCase().startsWith(lowerPrefix)) {
            suggestions.push({
              label: param.name,
              insertText: param.name + '=',
              category: 'parameter',
              description: param.documentation || `Search by ${param.name}`,
              paramType: param.type
            });
          }
        }
      }
    }

    // Sort: exact matches first, then alphabetically
    return suggestions.sort((a, b) => {
      const aExact = a.label.toLowerCase() === prefix.toLowerCase();
      const bExact = b.label.toLowerCase() === prefix.toLowerCase();
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
   * Get modifier suggestions
   */
  private getModifierSuggestions(
    resourceType: string | undefined,
    paramName: string | undefined,
    prefix: string
  ): Suggestion[] {
    if (!paramName) {
return [];
}

    const paramType = this.getParamType(resourceType, paramName);
    const modifiers = this.r3Types.getModifiers(paramType || 'string');

    const lowerPrefix = prefix.toLowerCase();
    return modifiers
      .filter(mod => mod.toLowerCase().startsWith(lowerPrefix))
      .map(mod => ({
        label: mod,
        insertText: mod,
        category: 'modifier' as const,
        description: `${paramType} modifier`
      }));
  }

  /**
   * Get value suggestions (operators for date/number, enum values, etc.)
   */
  private getValueSuggestions(
    resourceType: string | undefined,
    paramName: string | undefined,
    paramType: string | undefined,
    prefix: string
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // For date, number, quantity - suggest operators
    if (paramType === 'date' || paramType === 'number' || paramType === 'quantity') {
      const operators = this.r3Types.getPrefixOperators();
      for (const op of operators) {
        if (op.prefix.startsWith(prefix.toLowerCase())) {
          suggestions.push({
            label: op.prefix,
            insertText: op.prefix,
            category: 'operator',
            description: op.description
          });
        }
      }
    }

    // Check for enum values
    if (paramName) {
      // Try resource-specific enum
      let enumValues = this.r3Types.getEnumValues(`${resourceType}.${paramName}`);
      // Fall back to generic enum
      if (!enumValues) {
        enumValues = this.r3Types.getEnumValues(paramName);
      }

      if (enumValues) {
        const lowerPrefix = prefix.toLowerCase();
        for (const value of enumValues) {
          if (value.toLowerCase().startsWith(lowerPrefix)) {
            suggestions.push({
              label: value,
              insertText: value,
              category: 'value',
              description: `${paramName} value`
            });
          }
        }
      }
    }

    // For _summary parameter
    if (paramName === '_summary') {
      const summaryValues = this.r3Types.getEnumValues('_summary') || [];
      const lowerPrefix = prefix.toLowerCase();
      for (const value of summaryValues) {
        if (value.toLowerCase().startsWith(lowerPrefix)) {
          suggestions.push({
            label: value,
            insertText: value,
            category: 'value',
            description: `Summary mode: ${value}`
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Get resource metadata from cached CapabilityStatement
   */
  private getResourceMetadata(resourceType: string): any {
    if (!this.metadata?.rest?.[0]?.resource) {
return null;
}
    return this.metadata.rest[0].resource.find(
      (r: any) => r.type === resourceType
    );
  }

  /**
   * Get parameter type from metadata
   */
  private getParamType(resourceType: string | undefined, paramName: string | undefined): string | undefined {
    if (!paramName) {
return undefined;
}

    // Check global parameters first
    const globalParam = this.r3Types.getGlobalParameters().find(p => p.name === paramName);
    if (globalParam) {
return globalParam.type;
}

    // Check resource-specific parameters
    if (resourceType) {
      const resourceMeta = this.getResourceMetadata(resourceType);
      const param = resourceMeta?.searchParam?.find((p: any) => p.name === paramName);
      if (param) {
return param.type;
}
    }

    return undefined;
  }

  /**
   * Apply suggestion to query string
   */
  applySuggestion(query: string, cursorPosition: number, suggestion: Suggestion): { newQuery: string; newCursorPosition: number } {
    const parsed = this.parseQuery(query, cursorPosition);
    const textBeforeCursor = query.substring(0, cursorPosition);
    const textAfterCursor = query.substring(cursorPosition);

    let newQuery: string;
    let newCursorPosition: number;

    switch (parsed.context) {
      case 'resource_type': {
        // Replace from / to cursor
        const beforeSlash = textBeforeCursor.substring(0, textBeforeCursor.lastIndexOf('/') + 1);
        newQuery = beforeSlash + suggestion.insertText + textAfterCursor;
        newCursorPosition = beforeSlash.length + suggestion.insertText.length;
        break;
      }

      case 'parameter_name': {
        // Replace from ? or & to cursor
        const lastSeparator = Math.max(textBeforeCursor.lastIndexOf('?'), textBeforeCursor.lastIndexOf('&'));
        const beforeParam = textBeforeCursor.substring(0, lastSeparator + 1);
        newQuery = beforeParam + suggestion.insertText + textAfterCursor;
        newCursorPosition = beforeParam.length + suggestion.insertText.length;
        break;
      }

      case 'modifier': {
        // Replace from : to cursor
        const colonPos = textBeforeCursor.lastIndexOf(':');
        const beforeModifier = textBeforeCursor.substring(0, colonPos + 1);
        newQuery = beforeModifier + suggestion.insertText + '=' + textAfterCursor;
        newCursorPosition = beforeModifier.length + suggestion.insertText.length + 1;
        break;
      }

      case 'parameter_value': {
        // Replace from = to cursor (or after last value separator)
        const equalPos = textBeforeCursor.lastIndexOf('=');
        const beforeValue = textBeforeCursor.substring(0, equalPos + 1);
        newQuery = beforeValue + suggestion.insertText + textAfterCursor;
        newCursorPosition = beforeValue.length + suggestion.insertText.length;
        break;
      }

      default:
        newQuery = query;
        newCursorPosition = cursorPosition;
    }

    return { newQuery, newCursorPosition };
  }
}
