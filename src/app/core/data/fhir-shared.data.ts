import {FhirSharedData} from '../models/fhir-types.model';

export const FHIR_SHARED_DATA: FhirSharedData = {
  modifiers: {
    string: ['exact', 'contains', 'missing', 'text'],
    token: ['text', 'not', 'above', 'below', 'in', 'not-in', 'missing'],
    reference: ['missing', 'type'],
    date: ['missing'],
    number: ['missing'],
    quantity: ['missing'],
    uri: ['above', 'below', 'missing']
  },

  prefixOperators: [
    {prefix: 'eq', label: 'Equals', description: 'Equal to value'},
    {prefix: 'ne', label: 'Not Equals', description: 'Not equal to value'},
    {prefix: 'gt', label: 'Greater Than', description: 'Greater than value'},
    {prefix: 'lt', label: 'Less Than', description: 'Less than value'},
    {prefix: 'ge', label: 'Greater or Equal', description: 'Greater than or equal to value'},
    {prefix: 'le', label: 'Less or Equal', description: 'Less than or equal to value'},
    {prefix: 'sa', label: 'Starts After', description: 'Starts after value (date)'},
    {prefix: 'eb', label: 'Ends Before', description: 'Ends before value (date)'},
    {prefix: 'ap', label: 'Approximately', description: 'Approximately equal to value'}
  ],

  globalParameters: [
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
  ]
};
