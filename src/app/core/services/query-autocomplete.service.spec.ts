import { TestBed } from '@angular/core/testing';
import { FhirTypesService } from './fhir-types.service';
import { QueryAutocompleteService } from './query-autocomplete.service';

const MOCK_RESOURCE_TYPES = ['Observation', 'Organization', 'Patient'];
const MOCK_GLOBAL_PARAMS = [
  { name: '_id', type: 'token', description: 'Logical id' },
  { name: '_count', type: 'number', description: 'Page size' },
  { name: '_include', type: 'string', description: 'Include refs' },
  { name: '_content', type: 'string', description: 'Content search' }
];
const MOCK_MODIFIERS: Record<string, string[]> = {
  string: ['exact', 'contains', 'missing', 'text'],
  token: ['text', 'not', 'above', 'below', 'in', 'not-in', 'missing']
};
const MOCK_PREFIX_OPS = [
  { prefix: 'eq', label: 'Equals', description: 'Equal' },
  { prefix: 'ne', label: 'Not Equals', description: 'Not equal' }
];

const createMockFhirTypesService = () => ({
    searchResourceTypes: jest.fn((prefix: string) => {
      if (!prefix) {
return MOCK_RESOURCE_TYPES;
}
      const lp = prefix.toLowerCase();
      return MOCK_RESOURCE_TYPES.filter(t => t.toLowerCase().startsWith(lp));
    }),
    getModifiers: jest.fn((paramType: string) => MOCK_MODIFIERS[paramType] || []),
    getPrefixOperators: jest.fn(() => [...MOCK_PREFIX_OPS]),
    getGlobalParameters: jest.fn(() => [...MOCK_GLOBAL_PARAMS]),
    searchGlobalParameters: jest.fn((prefix: string) => {
      if (!prefix) {
return MOCK_GLOBAL_PARAMS;
}
      const lp = prefix.toLowerCase();
      return MOCK_GLOBAL_PARAMS.filter(p => p.name.toLowerCase().startsWith(lp));
    }),
    getEnumValues: jest.fn(() => undefined),
    getReferenceTargets: jest.fn(() => []),
    isValidResourceType: jest.fn((type: string) => MOCK_RESOURCE_TYPES.includes(type))
  });

describe('QueryAutocompleteService', () => {
  let service: QueryAutocompleteService;
  let mockFhirTypes: ReturnType<typeof createMockFhirTypesService>;

  beforeEach(() => {
    mockFhirTypes = createMockFhirTypesService();
    TestBed.configureTestingModule({
      providers: [
        QueryAutocompleteService,
        { provide: FhirTypesService, useValue: mockFhirTypes }
      ]
    });
    service = TestBed.inject(QueryAutocompleteService);
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('parseQuery', () => {
    it('should detect resource_type context after /', () => {
      const result = service.parseQuery('/', 1);
      expect(result.context).toBe('resource_type');
      expect(result.prefix).toBe('');
    });

    it('should detect resource_type context with partial input', () => {
      const result = service.parseQuery('/Pat', 4);
      expect(result.context).toBe('resource_type');
      expect(result.prefix).toBe('Pat');
    });

    it('should detect parameter_name context after ?', () => {
      const result = service.parseQuery('/Patient?', 9);
      expect(result.context).toBe('parameter_name');
      expect(result.resourceType).toBe('Patient');
    });

    it('should detect parameter_value context after =', () => {
      const result = service.parseQuery('Patient?gender=', 15);
      expect(result.context).toBe('parameter_value');
      expect(result.currentParam).toBe('gender');
    });

    it('should detect modifier context after :', () => {
      const result = service.parseQuery('Patient?name:', 13);
      expect(result.context).toBe('modifier');
      expect(result.currentParam).toBe('name');
    });

    it('should return resource_type for empty query', () => {
      const result = service.parseQuery('', 0);
      expect(result.context).toBe('resource_type');
    });

    it('should track used parameters', () => {
      const result = service.parseQuery('Patient?gender=male&name=', 25);
      expect(result.usedParams).toContain('gender');
      expect(result.usedParams).toContain('name');
    });
  });

  describe('getSuggestions', () => {
    it('should return resource type suggestions for resource_type context', () => {
      const parsed = service.parseQuery('/Pat', 4);
      const suggestions = service.getSuggestions(parsed);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].label).toBe('Patient');
      expect(suggestions[0].category).toBe('resource');
    });

    it('should return parameter suggestions for parameter_name context', () => {
      const parsed = service.parseQuery('Patient?', 8);
      const suggestions = service.getSuggestions(parsed);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.category === 'global')).toBe(true);
    });

    it('should return modifier suggestions for modifier context', () => {
      // Set up metadata so getParamType returns 'string'
      service.setMetadata({
        rest: [{ resource: [{ type: 'Patient', searchParam: [{ name: 'name', type: 'string' }] }] }]
      });
      const parsed = service.parseQuery('Patient?name:', 13);
      const suggestions = service.getSuggestions(parsed);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe('modifier');
    });
  });

  describe('applySuggestion', () => {
    it('should correctly insert resource type suggestion', () => {
      const suggestion = { label: 'Patient', insertText: 'Patient', category: 'resource' as const };
      const result = service.applySuggestion('/Pat', 4, suggestion);
      expect(result.newQuery).toBe('/Patient');
      expect(result.newCursorPosition).toBe(8);
    });

    it('should correctly insert parameter name suggestion', () => {
      const suggestion = { label: '_count', insertText: '_count=', category: 'global' as const };
      const result = service.applySuggestion('Patient?_c', 10, suggestion);
      expect(result.newQuery).toBe('Patient?_count=');
      expect(result.newCursorPosition).toBe(15);
    });
  });
});
