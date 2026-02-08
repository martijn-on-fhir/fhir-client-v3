import { detectFhirVersion } from './server-profile.model';

describe('detectFhirVersion', () => {
  it('should detect STU3 from "3.0.1"', () => {
    expect(detectFhirVersion('3.0.1')).toBe('STU3');
  });

  it('should detect STU3 from "3.0.2"', () => {
    expect(detectFhirVersion('3.0.2')).toBe('STU3');
  });

  it('should detect R4 from "4.0.1"', () => {
    expect(detectFhirVersion('4.0.1')).toBe('R4');
  });

  it('should detect R4 from "4.0.0"', () => {
    expect(detectFhirVersion('4.0.0')).toBe('R4');
  });

  it('should detect R4B from "4.3.0"', () => {
    expect(detectFhirVersion('4.3.0')).toBe('R4B');
  });

  it('should detect R5 from "5.0.0"', () => {
    expect(detectFhirVersion('5.0.0')).toBe('R5');
  });

  it('should detect R5 from "5.0.0-ballot1"', () => {
    expect(detectFhirVersion('5.0.0-ballot1')).toBe('R5');
  });

  it('should return null for empty string', () => {
    expect(detectFhirVersion('')).toBeNull();
  });

  it('should return null for null/undefined', () => {
    expect(detectFhirVersion(null as any)).toBeNull();
    expect(detectFhirVersion(undefined as any)).toBeNull();
  });

  it('should return null for unsupported version "2.0.0"', () => {
    expect(detectFhirVersion('2.0.0')).toBeNull();
  });

  it('should return null for future version "6.0.0"', () => {
    expect(detectFhirVersion('6.0.0')).toBeNull();
  });

  it('should return null for DSTU2 "1.0.2"', () => {
    expect(detectFhirVersion('1.0.2')).toBeNull();
  });
});
