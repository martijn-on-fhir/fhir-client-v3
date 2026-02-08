import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServerProfile } from '../models/server-profile.model';
import { FhirService } from './fhir.service';
import { LoggerService } from './logger.service';
import { ServerProfileService } from './server-profile.service';
import { SubscriptionService } from './subscription.service';

const createMockLoggerService = () => {
  const noopLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  return {
    component: jest.fn(() => noopLogger)
  };
};

describe('SubscriptionService', () => {
  const setup = (fhirVersion?: string) => {
    const activeProfile = fhirVersion
      ? signal<ServerProfile | null>({
          id: 'test-id',
          name: 'Test',
          fhirServerUrl: 'http://test',
          authType: 'none',
          fhirVersion: fhirVersion as any
        })
      : signal<ServerProfile | null>(null);

    TestBed.configureTestingModule({
      providers: [
        SubscriptionService,
        { provide: FhirService, useValue: {} },
        { provide: ServerProfileService, useValue: { activeProfile } },
        { provide: LoggerService, useValue: createMockLoggerService() }
      ]
    });

    return TestBed.inject(SubscriptionService);
  };

  afterEach(() => TestBed.resetTestingModule());

  describe('fhirVersion', () => {
    it('should return null when no active profile', () => {
      const service = setup();
      expect(service.fhirVersion()).toBeNull();
    });

    it('should return R4 when active profile has fhirVersion R4', () => {
      const service = setup('R4');
      expect(service.fhirVersion()).toBe('R4');
    });

    it('should return STU3 when active profile has fhirVersion STU3', () => {
      const service = setup('STU3');
      expect(service.fhirVersion()).toBe('STU3');
    });
  });

  describe('initial state', () => {
    it('should have empty subscriptions array', () => {
      const service = setup();
      expect(service.subscriptions()).toEqual([]);
    });

    it('should have loading as false', () => {
      const service = setup();
      expect(service.loading()).toBe(false);
    });

    it('should have error as null', () => {
      const service = setup();
      expect(service.error()).toBeNull();
    });
  });
});
