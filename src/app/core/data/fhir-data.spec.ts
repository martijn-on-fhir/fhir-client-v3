import { FHIR_R3_DATA } from './fhir-r3.data';
import { FHIR_R4_DATA } from './fhir-r4.data';
import { FHIR_SHARED_DATA } from './fhir-shared.data';

describe('FHIR Data Files', () => {

  describe('FHIR_R3_DATA (STU3)', () => {
    it('should have a non-empty sorted resourceTypes array', () => {
      expect(FHIR_R3_DATA.resourceTypes.length).toBeGreaterThan(0);
      const sorted = [...FHIR_R3_DATA.resourceTypes].sort();
      expect(FHIR_R3_DATA.resourceTypes).toEqual(sorted);
    });

    it('should contain Patient, Observation, and BodySite (STU3-only)', () => {
      expect(FHIR_R3_DATA.resourceTypes).toContain('Patient');
      expect(FHIR_R3_DATA.resourceTypes).toContain('Observation');
      expect(FHIR_R3_DATA.resourceTypes).toContain('BodySite');
    });

    it('should NOT contain BodyStructure (R4-only)', () => {
      expect(FHIR_R3_DATA.resourceTypes).not.toContain('BodyStructure');
    });

    it('should have referenceTargets as a non-empty object', () => {
      expect(Object.keys(FHIR_R3_DATA.referenceTargets).length).toBeGreaterThan(0);
    });

    it('should have enumValues as a non-empty object', () => {
      expect(Object.keys(FHIR_R3_DATA.enumValues).length).toBeGreaterThan(0);
    });
  });

  describe('FHIR_R4_DATA (R4)', () => {
    it('should have a non-empty sorted resourceTypes array', () => {
      expect(FHIR_R4_DATA.resourceTypes.length).toBeGreaterThan(0);
      const sorted = [...FHIR_R4_DATA.resourceTypes].sort();
      expect(FHIR_R4_DATA.resourceTypes).toEqual(sorted);
    });

    it('should contain Patient, Observation, and BodyStructure (R4-only)', () => {
      expect(FHIR_R4_DATA.resourceTypes).toContain('Patient');
      expect(FHIR_R4_DATA.resourceTypes).toContain('Observation');
      expect(FHIR_R4_DATA.resourceTypes).toContain('BodyStructure');
    });

    it('should NOT contain BodySite (STU3-only)', () => {
      expect(FHIR_R4_DATA.resourceTypes).not.toContain('BodySite');
    });

    it('should have referenceTargets as a non-empty object', () => {
      expect(Object.keys(FHIR_R4_DATA.referenceTargets).length).toBeGreaterThan(0);
    });

    it('should have enumValues as a non-empty object', () => {
      expect(Object.keys(FHIR_R4_DATA.enumValues).length).toBeGreaterThan(0);
    });
  });

  describe('FHIR_SHARED_DATA', () => {
    it('should have modifiers for string, token, and reference', () => {
      expect(FHIR_SHARED_DATA.modifiers['string']).toBeDefined();
      expect(FHIR_SHARED_DATA.modifiers['string'].length).toBeGreaterThan(0);
      expect(FHIR_SHARED_DATA.modifiers['token']).toBeDefined();
      expect(FHIR_SHARED_DATA.modifiers['token'].length).toBeGreaterThan(0);
      expect(FHIR_SHARED_DATA.modifiers['reference']).toBeDefined();
      expect(FHIR_SHARED_DATA.modifiers['reference'].length).toBeGreaterThan(0);
    });

    it('should have 9 prefix operators', () => {
      expect(FHIR_SHARED_DATA.prefixOperators).toHaveLength(9);
      const prefixes = FHIR_SHARED_DATA.prefixOperators.map(op => op.prefix);
      expect(prefixes).toEqual(['eq', 'ne', 'gt', 'lt', 'ge', 'le', 'sa', 'eb', 'ap']);
    });

    it('should have globalParameters including _id, _count, _include', () => {
      const names = FHIR_SHARED_DATA.globalParameters.map(p => p.name);
      expect(names).toContain('_id');
      expect(names).toContain('_count');
      expect(names).toContain('_include');
    });
  });
});
