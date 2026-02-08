import {Injectable, signal, computed, inject} from '@angular/core';
import {getEnvironmentConfig, Environment} from '../config/environments';
import {
  ServerProfile,
  ServerSession,
  AuthType,
  DEFAULT_PROFILE,
  PROFILE_COLORS,
  detectFhirVersion
} from '../models/server-profile.model';
import {HttpInspectorService} from './http-inspector.service';
import {LoggerService} from './logger.service';
import {PredefinedStateService} from './predefined-state.service';
import {QueryStateService} from './query-state.service';
import {TerminologyStateService} from './terminology-state.service';

/**
 * Server Profile Service
 *
 * Manages FHIR server profiles and sessions
 * Handles different authentication types (none, basic, bearer, oauth2, mtls)
 * Persists profiles via Electron IPC (encrypted storage)
 */
@Injectable({
  providedIn: 'root'
})
export class ServerProfileService {
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('ServerProfileService');
  private queryStateService = inject(QueryStateService);
  private predefinedStateService = inject(PredefinedStateService);
  private terminologyStateService = inject(TerminologyStateService);
  private httpInspectorService = inject(HttpInspectorService);

  // State signals
  private _profiles = signal<ServerProfile[]>([]);
  private _activeProfileId = signal<string | null>(null);
  private _sessions = signal<Map<string, ServerSession>>(new Map());
  private _initialized = signal<boolean>(false);

  // Public readonly signals
  readonly profiles = this._profiles.asReadonly();
  readonly activeProfileId = this._activeProfileId.asReadonly();
  readonly initialized = this._initialized.asReadonly();

  // Computed signals
  readonly activeProfile = computed(() => {
    const id = this._activeProfileId();
    return id ? this._profiles().find(p => p.id === id) ?? null : null;
  });

  readonly hasActiveSession = computed(() => {
    const id = this._activeProfileId();
    if (!id) {
return false;
}
    const session = this._sessions().get(id);
    return session?.isActive ?? false;
  });

  readonly sortedProfiles = computed(() => [...this._profiles()].sort((a, b) =>
      // Sort by lastUsed (most recent first)
       (b.lastUsed ?? 0) - (a.lastUsed ?? 0)
    ));

  constructor() {
    this.initialize();
  }

  /**
   * Initialize service - load profiles from storage
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadProfiles();
      await this.loadSessions();
      await this.loadActiveProfileId();

      // Check if we need to migrate from old SavedAccounts
      if (this._profiles().length === 0) {
        await this.migrateFromSavedAccounts();
      }

      // Auto-select first profile if none is active
      if (!this._activeProfileId() && this._profiles().length > 0) {
        const firstProfile = this._profiles()[0];
        if (firstProfile) {
          await this.switchToProfile(firstProfile.id);
        }
      }

      this._initialized.set(true);
      this.logger.debug('ServerProfileService initialized', {
        profileCount: this._profiles().length,
        activeProfileId: this._activeProfileId()
      });
    } catch (error) {
      this.logger.error('Failed to initialize ServerProfileService:', error);
      this._initialized.set(true); // Still mark as initialized to prevent blocking
    }
  }

  /**
   * Migrate from old SavedAccount format to new ServerProfile format
   * Only runs once when no profiles exist
   */
  private async migrateFromSavedAccounts(): Promise<void> {
    try {
      // Check if we have old saved accounts
      const savedAccounts = await this.getOldSavedAccounts();
      if (!savedAccounts || savedAccounts.length === 0) {
        this.logger.debug('No saved accounts to migrate');
        return;
      }

      this.logger.info(`Migrating ${savedAccounts.length} saved account(s) to server profiles`);

      const profiles: ServerProfile[] = savedAccounts.map((account, index) => {
        // Try to get environment config for token endpoint
        const envConfig = getEnvironmentConfig(account.environment as Environment);

        return {
          id: account.id,
          name: account.name,
          fhirServerUrl: account.fhirUrl || envConfig?.fhirServer || '',
          authType: 'oauth2' as AuthType,
          authConfig: {
            clientId: account.clientId,
            clientSecret: account.clientSecret,
            tokenEndpoint: envConfig?.tokenEndpoint || ''
          },
          color: PROFILE_COLORS[index % PROFILE_COLORS.length],
          lastUsed: account.lastUsed
        };
      });

      // Save migrated profiles
      this._profiles.set(profiles);
      await this.saveProfiles();

      this.logger.info(`Successfully migrated ${profiles.length} profile(s)`);
    } catch (error) {
      this.logger.error('Failed to migrate saved accounts:', error);
    }
  }

  /**
   * Get old saved accounts from storage (for migration)
   */
  private async getOldSavedAccounts(): Promise<any[]> {
    try {
      if ((window as any).electronAPI?.auth?.getSavedAccounts) {
        return await (window as any).electronAPI.auth.getSavedAccounts();
      }
      // Fallback to localStorage
      const stored = localStorage.getItem('fhir_saved_accounts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // ==================== Profile CRUD ====================

  /**
   * Load all profiles from storage
   */
  async loadProfiles(): Promise<void> {
    try {
      if ((window as any).electronAPI?.profiles?.getAll) {
        const profiles = await (window as any).electronAPI.profiles.getAll();
        this._profiles.set(profiles || []);
      } else {
        // Fallback to localStorage for development/web
        const stored = localStorage.getItem('fhir_server_profiles');
        this._profiles.set(stored ? JSON.parse(stored) : []);
      }
    } catch (error) {
      this.logger.error('Failed to load profiles:', error);
      this._profiles.set([]);
    }
  }

  /**
   * Save all profiles to storage
   */
  private async saveProfiles(): Promise<void> {
    try {
      const profiles = this._profiles();
      if ((window as any).electronAPI?.profiles?.save) {
        await (window as any).electronAPI.profiles.save(profiles);
      } else {
        // Fallback to localStorage
        localStorage.setItem('fhir_server_profiles', JSON.stringify(profiles));
      }
    } catch (error) {
      this.logger.error('Failed to save profiles:', error);
    }
  }

  /**
   * Add a new profile
   */
  async addProfile(profile: Omit<ServerProfile, 'id'>): Promise<ServerProfile> {
    const newProfile: ServerProfile = {
      ...DEFAULT_PROFILE,
      ...profile,
      id: crypto.randomUUID(),
      lastUsed: Date.now()
    };

    this._profiles.update(profiles => [...profiles, newProfile]);
    await this.saveProfiles();

    this.logger.info('Profile added:', {id: newProfile.id, name: newProfile.name});
    return newProfile;
  }

  /**
   * Update an existing profile
   */
  async updateProfile(id: string, updates: Partial<ServerProfile>): Promise<void> {
    this._profiles.update(profiles =>
      profiles.map(p => p.id === id ? {...p, ...updates} : p)
    );
    await this.saveProfiles();
    this.logger.info('Profile updated:', {id});
  }

  /**
   * Delete a profile and its session
   */
  async deleteProfile(id: string): Promise<void> {
    this._profiles.update(profiles => profiles.filter(p => p.id !== id));
    await this.clearSession(id);
    await this.saveProfiles();

    // If deleted profile was active, clear active
    if (this._activeProfileId() === id) {
      await this.setActiveProfileId(null);
    }

    this.logger.info('Profile deleted:', {id});
  }

  /**
   * Get a profile by ID
   */
  getProfile(id: string): ServerProfile | undefined {
    return this._profiles().find(p => p.id === id);
  }

  // ==================== Session Management ====================

  /**
   * Load sessions from storage
   */
  private async loadSessions(): Promise<void> {
    try {
      if ((window as any).electronAPI?.sessions?.getAll) {
        const sessions = await (window as any).electronAPI.sessions.getAll();
        this._sessions.set(new Map(Object.entries(sessions || {})));
      } else {
        const stored = localStorage.getItem('fhir_server_sessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          this._sessions.set(new Map(Object.entries(parsed)));
        }
      }
    } catch (error) {
      this.logger.error('Failed to load sessions:', error);
    }
  }

  /**
   * Save sessions to storage
   */
  private async saveSessions(): Promise<void> {
    try {
      const sessions = Object.fromEntries(this._sessions());
      if ((window as any).electronAPI?.sessions?.saveAll) {
        await (window as any).electronAPI.sessions.saveAll(sessions);
      } else {
        localStorage.setItem('fhir_server_sessions', JSON.stringify(sessions));
      }
    } catch (error) {
      this.logger.error('Failed to save sessions:', error);
    }
  }

  /**
   * Get session for a profile
   */
  getSession(profileId: string): ServerSession | undefined {
    return this._sessions().get(profileId);
  }

  /**
   * Set session for a profile
   */
  async setSession(profileId: string, session: ServerSession): Promise<void> {
    this._sessions.update(sessions => {
      const newSessions = new Map(sessions);
      newSessions.set(profileId, session);
      return newSessions;
    });
    await this.saveSessions();
  }

  /**
   * Clear session for a profile
   */
  async clearSession(profileId: string): Promise<void> {
    this._sessions.update(sessions => {
      const newSessions = new Map(sessions);
      newSessions.delete(profileId);
      return newSessions;
    });
    await this.saveSessions();
  }

  /**
   * Check if a profile has a valid (non-expired) session
   */
  hasValidSession(profileId: string): boolean {
    const session = this._sessions().get(profileId);
    if (!session?.isActive) {
return false;
}

    // For profiles that don't need tokens (none, basic with stored creds)
    const profile = this.getProfile(profileId);
    if (profile?.authType === 'none') {
return true;
}
    if (profile?.authType === 'basic') {
return true;
}
    if (profile?.authType === 'bearer') {
return !!profile.authConfig?.bearerToken;
}

    // For oauth2, check token expiry
    if (!session.expiresAt) {
return false;
}
    return session.expiresAt > Date.now();
  }

  // ==================== Active Profile ====================

  /**
   * Load active profile ID from storage
   */
  private async loadActiveProfileId(): Promise<void> {
    try {
      if ((window as any).electronAPI?.profiles?.getActive) {
        const id = await (window as any).electronAPI.profiles.getActive();
        this._activeProfileId.set(id);
      } else {
        const stored = localStorage.getItem('fhir_active_profile_id');
        this._activeProfileId.set(stored || null);
      }
    } catch (error) {
      this.logger.error('Failed to load active profile ID:', error);
    }
  }

  /**
   * Set active profile ID
   */
  async setActiveProfileId(id: string | null): Promise<void> {
    this._activeProfileId.set(id);
    try {
      if ((window as any).electronAPI?.profiles?.setActive) {
        await (window as any).electronAPI.profiles.setActive(id);
      } else {
        if (id) {
          localStorage.setItem('fhir_active_profile_id', id);
        } else {
          localStorage.removeItem('fhir_active_profile_id');
        }
      }
    } catch (error) {
      this.logger.error('Failed to save active profile ID:', error);
    }
  }

  /**
   * Switch to a different profile
   * Handles authentication if needed
   */
  async switchToProfile(profileId: string): Promise<boolean> {

    const profile = this.getProfile(profileId);

    if (!profile) {
      this.logger.error('Profile not found:', {profileId});
      return false;
    }

    // Clear results from previous server
    this.queryStateService.clearResult();
    this.predefinedStateService.clearResult();
    this.terminologyStateService.clearResult();
    this.httpInspectorService.clearHistory();

    // Update lastUsed
    await this.updateProfile(profileId, {lastUsed: Date.now()});

    // Check if we have a valid session
    if (this.hasValidSession(profileId)) {
      await this.setActiveProfileId(profileId);
      this.logger.info('Switched to profile (existing session):', {id: profileId, name: profile.name});
      this.detectAndPersistFhirVersion(profileId);
      return true;
    }

    // Need to authenticate
    const authenticated = await this.authenticateProfile(profile);
    if (authenticated) {
      await this.setActiveProfileId(profileId);
      this.logger.info('Switched to profile (new session):', {id: profileId, name: profile.name});
      this.detectAndPersistFhirVersion(profileId);
      return true;
    }

    this.logger.warn('Failed to switch to profile:', {id: profileId});
    return false;
  }

  // ==================== Authentication ====================

  /**
   * Authenticate a profile based on its auth type
   */
  async authenticateProfile(profile: ServerProfile): Promise<boolean> {
    switch (profile.authType) {
      case 'none':
        // No authentication needed
        await this.setSession(profile.id, {
          profileId: profile.id,
          isActive: true
        });
        return true;

      case 'basic':
        // Basic auth - credentials are sent with each request
        if (profile.authConfig?.username && profile.authConfig?.password) {
          await this.setSession(profile.id, {
            profileId: profile.id,
            isActive: true
          });
          return true;
        }
        return false;

      case 'bearer':
        // Static bearer token
        if (profile.authConfig?.bearerToken) {
          await this.setSession(profile.id, {
            profileId: profile.id,
            accessToken: profile.authConfig.bearerToken,
            isActive: true
          });
          return true;
        }
        return false;

      case 'oauth2':
        return this.authenticateOAuth2(profile);

      case 'mtls':
        // mTLS is handled at transport level
        if (profile.mtlsCertificateId) {
          await this.setSession(profile.id, {
            profileId: profile.id,
            isActive: true
          });
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Authenticate using OAuth2 client credentials
   */
  private async authenticateOAuth2(profile: ServerProfile): Promise<boolean> {
    const {clientId, clientSecret, tokenEndpoint, scope} = profile.authConfig || {};

    if (!clientId || !clientSecret || !tokenEndpoint) {
      this.logger.error('OAuth2 config incomplete:', {profileId: profile.id});
      return false;
    }

    try {
      // Use Electron IPC for OAuth2 to bypass CORS
      if ((window as any).electronAPI?.auth?.oauth2Login) {
        const result = await (window as any).electronAPI.auth.oauth2Login(
          tokenEndpoint,
          clientId,
          clientSecret,
          scope
        );

        if (result?.access_token) {
          await this.setSession(profile.id, {
            profileId: profile.id,
            accessToken: result.access_token,
            expiresAt: Date.now() + (result.expires_in * 1000),
            isActive: true
          });
          return true;
        }
      } else {
        // Fallback: direct fetch (may fail due to CORS)
        const params: Record<string, string> = {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        };

        if (scope) {
          params['scope'] = scope;
        }

        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams(params)
        });

        if (response.ok) {
          const data = await response.json();
          await this.setSession(profile.id, {
            profileId: profile.id,
            accessToken: data.access_token,
            expiresAt: Date.now() + (data.expires_in * 1000),
            isActive: true
          });
          return true;
        }
      }
    } catch (error) {
      this.logger.error('OAuth2 authentication failed:', error);
    }

    return false;
  }

  /**
   * Refresh OAuth2 token for a profile
   */
  async refreshOAuth2Token(profileId: string): Promise<boolean> {
    const profile = this.getProfile(profileId);
    if (!profile || profile.authType !== 'oauth2') {
return false;
}

    return this.authenticateOAuth2(profile);
  }

  // ==================== Auth Headers ====================

  /**
   * Get authorization headers for a profile
   */
  async getAuthHeadersForProfile(profileId: string): Promise<Record<string, string>> {
    const profile = this.getProfile(profileId);
    if (!profile) {
return {};
}

    let authHeaders: Record<string, string> = {};

    switch (profile.authType) {
      case 'none':
        break;

      case 'basic': {
        const {username, password} = profile.authConfig || {};
        if (username && password) {
          const credentials = btoa(`${username}:${password}`);
          authHeaders = {'Authorization': `Basic ${credentials}`};
        }
        break;
      }

      case 'bearer': {
        const token = profile.authConfig?.bearerToken;
        if (token) {
          authHeaders = {'Authorization': `Bearer ${token}`};
        }
        break;
      }

      case 'oauth2': {
        const session = this.getSession(profileId);

        // Check if token needs refresh
        if (session?.expiresAt && session.expiresAt < Date.now() + 60000) {
          await this.refreshOAuth2Token(profileId);
        }

        const updatedSession = this.getSession(profileId);
        if (updatedSession?.accessToken) {
          authHeaders = {'Authorization': `Bearer ${updatedSession.accessToken}`};
        }
        break;
      }

      case 'mtls':
        // mTLS is handled at transport level, no auth header needed
        break;
    }

    // Merge custom headers (custom headers take precedence)
    const customHeaders = profile.customHeaders || {};

    return {...authHeaders, ...customHeaders};
  }

  /**
   * Get auth headers for the active profile
   */
  async getActiveAuthHeaders(): Promise<Record<string, string>> {
    const activeId = this._activeProfileId();
    return activeId ? this.getAuthHeadersForProfile(activeId) : {};
  }

  // ==================== FHIR Version Detection ====================

  /**
   * Detect FHIR version from the server's CapabilityStatement and persist it.
   * Runs in the background (fire-and-forget) so it doesn't block profile switching.
   * Only fetches if the profile doesn't already have a fhirVersion.
   * Uses direct fetch to avoid circular dependency with FhirService.
   */
  private async detectAndPersistFhirVersion(profileId: string): Promise<void> {
    const profile = this.getProfile(profileId);
    if (!profile || profile.fhirVersion) {
      return;
    }

    try {
      const baseUrl = profile.fhirServerUrl.replace(/\/$/, '');
      const headers: Record<string, string> = {
        'Accept': 'application/fhir+json',
        ...await this.getAuthHeadersForProfile(profileId)
      };

      const response = await fetch(`${baseUrl}/metadata`, {method: 'GET', headers});
      if (response.ok) {
        const data = await response.json();
        const versionString = data?.fhirVersion;
        if (versionString) {
          const detected = detectFhirVersion(versionString);
          if (detected) {
            await this.updateProfile(profileId, {fhirVersion: detected});
            this.logger.info('Detected FHIR version:', {profileId, fhirVersion: detected});
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to detect FHIR version:', error);
    }
  }

  // ==================== Utilities ====================

  /**
   * Clear all profiles and sessions (for logout/reset)
   */
  async clearAll(): Promise<void> {
    this._profiles.set([]);
    this._sessions.set(new Map());
    this._activeProfileId.set(null);
    await this.saveProfiles();
    await this.saveSessions();
    localStorage.removeItem('fhir_active_profile_id');
  }

  /**
   * Logout from current active profile
   * Clears the session and deactivates the profile
   */
  async logout(): Promise<void> {
    const activeId = this._activeProfileId();
    if (activeId) {
      await this.clearSession(activeId);
    }
    await this.setActiveProfileId(null);
    this.logger.info('Logged out successfully');
  }
}
