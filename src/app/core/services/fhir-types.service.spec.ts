import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServerProfile } from '../models/server-profile.model';
import { FhirTypesService } from './fhir-types.service';
import { ServerProfileService } from './server-profile.service';

const createMockServerProfileService = (fhirVersion?: string) => {
  const profile = fhirVersion
    ? signal<ServerProfile | null>({
        id: 'test-id',
        name: 'Test',
        fhirServerUrl: 'http://test',
        authType: 'none',
        fhirVersion: fhirVersion as any
      })
    : signal<ServerProfile | null>(null);

  return { activeProfile: profile };
};

describe('FhirTypesService', () => {
  const setup = (fhirVersion?: string) => {
    const mock = createMockServerProfileService(fhirVersion);
    TestBed.configureTestingModule({
      providers: [
        FhirTypesService,
        { provide: ServerProfileService, useValue: mock }
      ]
    });
    return {
      service: TestBed.inject(FhirTypesService),
      mockProfileService: mock
    };
  };

  afterEach(() => TestBed.resetTestingModule());

  describe('getResourceTypes', () => {
    it('should return STU3 types when profile has fhirVersion STU3', () => {
      const { service } = setup('STU3');
      const types = service.getResourceTypes();
      expect(types).toContain('BodySite');
      expect(types).not.toContain('BodyStructure');
    });

    it('should return R4 types when profile has fhirVersion R4', () => {
      const { service } = setup('R4');
      const types = service.getResourceTypes();
      expect(types).toContain('BodyStructure');
      expect(types).not.toContain('BodySite');
    });

    it('should fall back to STU3 when no profile is active', () => {
      const { service } = setup();
      const types = service.getResourceTypes();
      expect(types).toContain('BodySite');
      expect(types).not.toContain('BodyStructure');
    });

    it('should map R4B to R4 data', () => {
      const { service } = setup('R4B');
      const types = service.getResourceTypes();
      expect(types).toContain('BodyStructure');
      expect(types).not.toContain('BodySite');
    });

    it('should map R5 to R4 data', () => {
      const { service } = setup('R5');
      const types = service.getResourceTypes();
      expect(types).toContain('BodyStructure');
      expect(types).not.toContain('BodySite');
    });
  });

  describe('searchResourceTypes', () => {
    it('should filter resource types by prefix', () => {
      const { service } = setup('STU3');
      const results = service.searchResourceTypes('Pat');
      expect(results).toContain('Patient');
      expect(results.every(r => r.toLowerCase().startsWith('pat'))).toBe(true);
    });

    it('should return all resource types when prefix is empty', () => {
      const { service } = setup('STU3');
      const all = service.getResourceTypes();
      const searched = service.searchResourceTypes('');
      expect(searched).toEqual(all);
    });
  });

  describe('isValidResourceType', () => {
    it('should return true for valid resource type', () => {
      const { service } = setup('STU3');
      expect(service.isValidResourceType('Patient')).toBe(true);
    });

    it('should return false for invalid resource type', () => {
      const { service } = setup('STU3');
      expect(service.isValidResourceType('FakeResource')).toBe(false);
    });

    it('should validate BodySite as true for STU3, false for R4', () => {
      const { service: stu3 } = setup('STU3');
      expect(stu3.isValidResourceType('BodySite')).toBe(true);

      TestBed.resetTestingModule();
      const { service: r4 } = setup('R4');
      expect(r4.isValidResourceType('BodySite')).toBe(false);
    });

    it('should validate BodyStructure as true for R4, false for STU3', () => {
      const { service: r4 } = setup('R4');
      expect(r4.isValidResourceType('BodyStructure')).toBe(true);

      TestBed.resetTestingModule();
      const { service: stu3 } = setup('STU3');
      expect(stu3.isValidResourceType('BodyStructure')).toBe(false);
    });
  });

  describe('getModifiers', () => {
    it('should return modifiers for string type', () => {
      const { service } = setup('STU3');
      const mods = service.getModifiers('string');
      expect(mods).toEqual(['exact', 'contains', 'missing', 'text']);
    });

    it('should return empty array for unknown type', () => {
      const { service } = setup('STU3');
      expect(service.getModifiers('unknown')).toEqual([]);
    });
  });

  describe('getPrefixOperators', () => {
    it('should return 9 operators', () => {
      const { service } = setup('STU3');
      expect(service.getPrefixOperators()).toHaveLength(9);
    });
  });

  describe('getGlobalParameters', () => {
    it('should include _id and _count', () => {
      const { service } = setup('STU3');
      const params = service.getGlobalParameters();
      const names = params.map(p => p.name);
      expect(names).toContain('_id');
      expect(names).toContain('_count');
    });
  });

  describe('searchGlobalParameters', () => {
    it('should filter global parameters by prefix', () => {
      const { service } = setup('STU3');
      const results = service.searchGlobalParameters('_c');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.name.startsWith('_c'))).toBe(true);
    });
  });

  describe('getEnumValues', () => {
    it('should return gender values', () => {
      const { service } = setup('STU3');
      const values = service.getEnumValues('gender');
      expect(values).toBeDefined();
      expect(values).toContain('male');
      expect(values).toContain('female');
    });
  });

  describe('getReferenceTargets', () => {
    it('should return target types for subject', () => {
      const { service } = setup('STU3');
      const targets = service.getReferenceTargets('subject');
      expect(targets).toContain('Patient');
      expect(targets).toContain('Group');
    });
  });
});
