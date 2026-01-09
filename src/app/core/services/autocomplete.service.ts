import { Injectable, inject } from '@angular/core';
// eslint-disable-next-line @typescript-eslint/naming-convention
import type * as Monaco from 'monaco-editor';
import { LoggerService } from './logger.service';

/**
 * Autocomplete Service for Monaco Editor in Resource Editor
 *
 * Provides context-aware autocomplete for FHIR resources:
 * - Property name suggestions based on StructureDefinition
 * - Enum value suggestions extracted from element bindings
 * - Nested type context detection (CodeableConcept, Identifier, etc.)
 * - Template-based default value insertion
 */
@Injectable({
  providedIn: 'root'
})
export class AutocompleteService {
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('AutocompleteService');
  /**
   * Common FHIR property names mapped to their types (fallback when structure definition lookup fails)
   */
  private readonly PROPERTY_TYPE_MAP: Record<string, string> = {
    coding: 'Coding',
    identifier: 'Identifier',
    reference: 'Reference',
    meta: 'Meta',
    category: 'CodeableConcept',
    code: 'CodeableConcept',
    type: 'CodeableConcept',
    period: 'Period',
    quantity: 'Quantity',
    range: 'Range',
    ratio: 'Ratio',
    attachment: 'Attachment',
    contact: 'ContactPoint',
    telecom: 'ContactPoint',
    name: 'HumanName',
    address: 'Address',
    annotation: 'Annotation',
    note: 'Annotation',
    timing: 'Timing',
    signature: 'Signature',
  };

  /**
   * FHIR primitive type names
   */
  private readonly PRIMITIVE_TYPES = [
    'string',
    'boolean',
    'integer',
    'decimal',
    'uri',
    'url',
    'canonical',
    'base64Binary',
    'instant',
    'date',
    'dateTime',
    'time',
    'code',
    'oid',
    'id',
    'markdown',
    'unsignedInt',
    'positiveInt',
    'uuid',
  ];

  /**
   * Extracts enum values from a structure definition element
   * Checks multiple places where enum values might be defined:
   * 1. element.short (most common - e.g., "registered | preliminary | final | amended +")
   * 2. binding.description with pipe-separated inline values
   * 3. constraint with enum pattern (values separated by |)
   * 4. fixed value pattern
   */
  getEnumValuesFromElement(element: any): string[] | null {
    if (!element) {
return null;
}

    const enumValues: string[] = [];

    // 1. Check the 'short' field first - this is where FHIR often lists enum values
    // Example: "registered | preliminary | final | amended +"
    if (element.short) {
      const shortMatch = element.short.match(/^([a-zA-Z0-9-]+(?:\s*\|\s*[a-zA-Z0-9-]+)+)/);

      if (shortMatch) {
        const values = shortMatch[1]
          .split('|')
          .map((v: string) => v.trim())
          .filter((v: string) => v.length > 0 && v !== '+');
        enumValues.push(...values);
      }
    }

    // 2. Check for binding with strength "required"
    if (element.binding && enumValues.length === 0) {
      if (element.binding.description && enumValues.length === 0) {
        const desc = element.binding.description;
        const pipeMatch = desc.match(/^([a-zA-Z0-9-]+(?:\s*\|\s*[a-zA-Z0-9-]+)+)/);

        if (pipeMatch) {
          const values = pipeMatch[1]
            .split('|')
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0);
          enumValues.push(...values);
        }
      }
    }

    // Check constraints for patterns like "value=(option1|option2|option3)"
    if (element.constraint && Array.isArray(element.constraint)) {
      for (const constraint of element.constraint) {
        if (constraint.human || constraint.expression) {
          const text = constraint.human || constraint.expression || '';
          const match = text.match(/\(([a-zA-Z0-9-]+(?:\|[a-zA-Z0-9-]+)+)\)/);

          if (match) {
            const values = match[1].split('|').filter((v: string) => v.length > 0);
            enumValues.push(...values);
          }
        }
      }
    }

    // Check for fixed value (single value enum)
    if (element.fixedCode || element.fixedString) {
      const fixedValue = element.fixedCode || element.fixedString;
      if (fixedValue) {
        enumValues.push(fixedValue);
      }
    }

    // Check for pattern value
    if (element.patternCode || element.patternString) {
      const patternValue = element.patternCode || element.patternString;
      if (patternValue) {
        enumValues.push(patternValue);
      }
    }

    return enumValues.length > 0 ? [...new Set(enumValues)] : null;
  }

  /**
   * Gets the property name when the cursor is positioned in a property value
   * Returns the property name if cursor is after a colon (in value position), null otherwise
   */
  getPropertyNameForValue(model: Monaco.editor.ITextModel, position: Monaco.Position): string | null {
    try {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Check if we're in a string value position (inside quotes after a colon)
      // Pattern: "propertyName": "cursorHere
      const valueMatch = textBeforeCursor.match(/"([^"]+)"\s*:\s*"([^"]*)$/);

      if (valueMatch) {
        return valueMatch[1];
      }

      // Also check if we just started typing the value (right after opening quote)
      // Pattern: "propertyName": "
      const justStartedMatch = textBeforeCursor.match(/"([^"]+)"\s*:\s*"$/);

      if (justStartedMatch) {
        return justStartedMatch[1];
      }
    } catch (error) {
      this.logger.error('Error getting property name for value:', error);
    }

    return null;
  }

  /**
   * Determines the FHIR type context at the cursor position by parsing backwards
   * through the JSON structure to find the parent property
   */
  getTypeContext(model: Monaco.editor.ITextModel, position: Monaco.Position, structureElements: any[]): string | null {
    try {
      // Get all text up to cursor
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Parse backwards to find parent property
      let braceCount = 0;
      let bracketCount = 0;
      let foundPropertyName: string | null = null;

      // Process character by character backwards
      for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
        const char = textBeforeCursor[i];

        if (char === '}') {
braceCount++;
} else if (char === '{') {
          braceCount--;

          // When we exit the current object (braceCount goes negative)
          if (braceCount < 0) {
            // Continue looking if we're still inside an array
            if (bracketCount > 0) {
              braceCount = 0;
              continue;
            }

            // Look backwards from this position to find property name
            const beforeOpening = textBeforeCursor.substring(0, i);
            const propertyMatch = beforeOpening.match(/"([^"]+)"\s*:\s*(?:\[)?$/);

            if (propertyMatch) {
              foundPropertyName = propertyMatch[1];
              break;
            }
          }
        } else if (char === ']') {
bracketCount++;
} else if (char === '[') {
          bracketCount--;

          // When we exit an array (bracketCount goes negative)
          if (bracketCount < 0) {
            // Look backwards from this position to find property name
            const beforeOpening = textBeforeCursor.substring(0, i);
            const propertyMatch = beforeOpening.match(/"([^"]+)"\s*:\s*$/);

            if (propertyMatch) {
              foundPropertyName = propertyMatch[1];
              break;
            }
          }
        }
      }

      if (foundPropertyName) {
        // Look up this property in structure definition
        const element = structureElements.find((el: any) => {
          const path = el.path || '';
          return path.endsWith(`.${foundPropertyName}`);
        });

        if (element?.type && element.type.length > 0) {
          const typeCode = element.type[0].code;
          return typeCode;
        } else {
          // Fallback: use property type mapping
          const mappedType = this.PROPERTY_TYPE_MAP[foundPropertyName];
          if (mappedType) {
            return mappedType;
          }
        }
      }
    } catch (error) {
      this.logger.error('Error determining context:', error);
    }

    return null;
  }

  /**
   * Generates default value for a property based on its type
   */
  getDefaultValue(
    propertyName: string,
    element: any,
    contextType: string | null,
    contextPrefix: string,
    templates: Record<string, any>
  ): { defaultValue: string; typeDetail: string } {
    const isArray = element?.max === '*';
    let defaultValue = '""';
    let typeDetail = '';

    // For template-based context, infer type from template value
    if (contextType && !element) {
      const template = templates[contextType] || templates[contextType.toLowerCase()];

      if (template && template[propertyName] !== undefined) {
        const templateValue = template[propertyName];

        if (Array.isArray(templateValue)) {
          if (templateValue.length > 0 && typeof templateValue[0] === 'object') {
            defaultValue = `[${JSON.stringify(templateValue[0])}]`;
            typeDetail = ' (array - template)';
          } else {
            defaultValue = '[]';
            typeDetail = ' (array)';
          }
        } else if (typeof templateValue === 'object' && templateValue !== null) {
          defaultValue = JSON.stringify(templateValue);
          typeDetail = ' (object)';
        } else if (typeof templateValue === 'boolean') {
          defaultValue = 'false';
          typeDetail = ' (boolean)';
        } else if (typeof templateValue === 'number') {
          defaultValue = '0';
          typeDetail = ' (number)';
        } else {
          defaultValue = '""';
          typeDetail = ' (string)';
        }
      }
    } else if (isArray && element?.type && element.type.length > 0) {
      const typeCode = element.type[0].code;

      if (this.PRIMITIVE_TYPES.includes(typeCode)) {
        defaultValue = '[]';
        typeDetail = ` (${typeCode}[])`;
      } else {
        const template = templates[typeCode] || templates[typeCode.toLowerCase()];

        if (template) {
          defaultValue = `[${JSON.stringify(template)}]`;
          typeDetail = ` (${typeCode}[] - template)`;
        } else {
          defaultValue = '[{}]';
          typeDetail = ` (${typeCode}[])`;
        }
      }
    } else if (isArray) {
      defaultValue = '[]';
      typeDetail = ' (array)';
    } else if (element?.type && element.type.length > 0) {
      const typeCode = element.type[0].code;

      if (typeCode === 'boolean') {
        defaultValue = 'false';
        typeDetail = ' (boolean)';
      } else if (typeCode === 'integer' || typeCode === 'unsignedInt' || typeCode === 'positiveInt') {
        defaultValue = '0';
        typeDetail = ' (number)';
      } else if (typeCode === 'decimal') {
        defaultValue = '0.0';
        typeDetail = ' (decimal)';
      } else if (this.PRIMITIVE_TYPES.includes(typeCode)) {
        defaultValue = '""';
        typeDetail = ` (${typeCode})`;
      } else {
        const template = templates[typeCode] || templates[typeCode.toLowerCase()];

        if (template) {
          defaultValue = JSON.stringify(template);
          typeDetail = ` (${typeCode} - template)`;
        } else {
          defaultValue = '{}';
          typeDetail = ` (${typeCode})`;
        }
      }
    }

    return { defaultValue, typeDetail };
  }

  /**
   * Creates completion item with proper insert text and snippet handling
   */
  createCompletionItem(
    propertyName: string,
    defaultValue: string,
    typeDetail: string,
    contextPrefix: string,
    index: number,
    model: Monaco.editor.ITextModel,
    position: Monaco.Position,
    word: Monaco.editor.IWordAtPosition,
    monaco: typeof Monaco,
    hasClosingQuote: boolean
  ): Monaco.languages.CompletionItem {
    let insertText = propertyName;
    let additionalTextEdits: Monaco.languages.TextEdit[] = [];
    let useSnippet = false;

    const lineContent = model.getLineContent(position.lineNumber);
    const textAfterCursor = lineContent.substring(position.column - 1);

    // Check if there's already a closing quote and colon
    if (textAfterCursor.match(/^"\s*:/)) {
      // Just insert property name, value structure already exists
      additionalTextEdits = [
        {
          range: new monaco.Range(
            position.lineNumber,
            position.column + propertyName.length + 1,
            position.lineNumber,
            position.column + propertyName.length + 1
          ),
          text: ` ${defaultValue}`,
        },
      ];
    } else {
      // Use snippet syntax for arrays and empty objects to position cursor
      if (defaultValue === '[]') {
        insertText = `${propertyName}": [$0]`;
        useSnippet = true;
      } else if (defaultValue === '{}') {
        insertText = `${propertyName}": {$0}`;
        useSnippet = true;
      } else if (defaultValue === '[{}]') {
        insertText = `${propertyName}": [{$0}]`;
        useSnippet = true;
      } else {
        insertText = `${propertyName}": ${defaultValue}`;
      }
    }

    const endColumn = hasClosingQuote ? word.endColumn + 1 : word.endColumn;
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, endColumn);

    // Determine if we should auto-format after insertion
    const shouldAutoFormat = (defaultValue.startsWith('{') || defaultValue.startsWith('[{')) &&
                             defaultValue !== '{}' && defaultValue !== '[{}]';

    const completionItem: Monaco.languages.CompletionItem = {
      label: propertyName,
      kind: monaco.languages.CompletionItemKind.Field,
      insertText: insertText,
      detail: `${contextPrefix}.${propertyName}${typeDetail}`,
      sortText: `a_${index.toString().padStart(3, '0')}`,
      range: range as any,
      additionalTextEdits: additionalTextEdits.length > 0 ? additionalTextEdits : undefined,
    };

    // Enable snippet mode for arrays and empty objects
    if (useSnippet) {
      completionItem.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
    }

    // Add format command for complex types
    if (shouldAutoFormat) {
      completionItem.command = {
        id: 'editor.action.formatDocument',
        title: 'Format Document',
      };
    }

    return completionItem;
  }
}
