import {CommonModule} from '@angular/common';
import {Component, signal, inject, computed, Output, EventEmitter} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
  ServerProfile,
  AuthType,
  AuthConfig,
  PROFILE_COLORS,
  DEFAULT_PROFILE
} from '../../../core/models/server-profile.model';
import {CertificateService} from '../../../core/services/certificate.service';
import {ServerProfileService} from '../../../core/services/server-profile.service';
import {ToastService} from '../../../core/services/toast.service';

/**
 * Custom header key-value pair for form editing
 */
interface CustomHeaderEntry {
  key: string;
  value: string;
}

/**
 * Form data for creating/editing server profiles
 */
interface ProfileFormData {
  name: string;
  fhirServerUrl: string;
  authType: AuthType;
  color: string;
  // OAuth2 fields
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  scope: string;
  // Basic auth fields
  username: string;
  password: string;
  // Bearer token field
  bearerToken: string;
  // mTLS field
  mtlsCertificateId: string;
  // Custom headers
  customHeaders: CustomHeaderEntry[];
}

/**
 * Server Profile Dialog Component
 *
 * Dialog for creating and editing FHIR server profiles.
 * Supports multiple authentication types with dynamic form fields.
 */
@Component({
  selector: 'app-server-profile-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './server-profile-dialog.component.html',
  styleUrls: ['./server-profile-dialog.component.scss']
})
export class ServerProfileDialogComponent {
  private profileService = inject(ServerProfileService);
  private certificateService = inject(CertificateService);
  private toastService = inject(ToastService);

  @Output() profileSaved = new EventEmitter<ServerProfile>();

  // Dialog state
  isOpen = signal(false);
  mode = signal<'add' | 'edit'>('add');
  editingProfileId = signal<string | null>(null);

  // Form state
  formData = signal<ProfileFormData>(this.getEmptyFormData());

  // Loading/error state
  loading = signal(false);
  testing = signal(false);
  error = signal<string | null>(null);

  // Available options
  readonly colors = PROFILE_COLORS;
  readonly authTypes: {value: AuthType; label: string; icon: string}[] = [
    {value: 'none', label: 'Geen authenticatie', icon: 'fa-unlock'},
    {value: 'basic', label: 'Basic Auth', icon: 'fa-user-lock'},
    {value: 'bearer', label: 'Bearer Token', icon: 'fa-key'},
    {value: 'oauth2', label: 'OAuth2 Client Credentials', icon: 'fa-shield-alt'},
    {value: 'mtls', label: 'mTLS (Client Certificate)', icon: 'fa-certificate'}
  ];

  // Expose certificates for mTLS dropdown
  readonly certificates = this.certificateService.certificates;

  // Computed
  readonly dialogTitle = computed(() =>
    this.mode() === 'add' ? 'Server toevoegen' : 'Server bewerken'
  );

  readonly canSave = computed(() => {
    const form = this.formData();

    if (!form.name.trim() || !form.fhirServerUrl.trim()) {
return false;
}

    // Validate auth-specific fields
    switch (form.authType) {
      case 'basic':
        return !!form.username && !!form.password;
      case 'bearer':
        return !!form.bearerToken;
      case 'oauth2':
        return !!form.clientId && !!form.clientSecret && !!form.tokenEndpoint;
      case 'mtls':
        return !!form.mtlsCertificateId;
      case 'none':
      default:
        return true;
    }
  });

  /**
   * Open dialog for adding a new profile
   */
  openAdd(): void {
    this.mode.set('add');
    this.editingProfileId.set(null);
    this.formData.set(this.getEmptyFormData());
    this.error.set(null);
    this.isOpen.set(true);

    // Load certificates for mTLS dropdown
    this.certificateService.loadCertificates();
  }

  /**
   * Open dialog for editing an existing profile
   */
  openEdit(profile: ServerProfile): void {
    this.mode.set('edit');
    this.editingProfileId.set(profile.id);
    this.formData.set(this.profileToFormData(profile));
    this.error.set(null);
    this.isOpen.set(true);

    // Load certificates for mTLS dropdown
    this.certificateService.loadCertificates();
  }

  /**
   * Close the dialog
   */
  close(): void {
    this.isOpen.set(false);
    this.formData.set(this.getEmptyFormData());
    this.error.set(null);
  }

  /**
   * Save the profile
   */
  async save(): Promise<void> {
    if (!this.canSave()) {
return;
}

    this.loading.set(true);
    this.error.set(null);

    try {
      const form = this.formData();
      const profileData = this.formDataToProfile(form);

      if (this.mode() === 'add') {
        const newProfile = await this.profileService.addProfile(profileData);
        this.toastService.success(`Server "${newProfile.name}" toegevoegd`);
        this.profileSaved.emit(newProfile);
      } else {
        const id = this.editingProfileId();

        if (id) {
          await this.profileService.updateProfile(id, profileData);
          this.toastService.success(`Server "${profileData.name}" bijgewerkt`);
          this.profileSaved.emit({...profileData, id} as ServerProfile);
        }
      }

      this.close();
    } catch (err) {
      this.error.set(String(err));
      this.toastService.error('Fout bij opslaan', String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Test connection to the server
   */
  async testConnection(): Promise<void> {
    const form = this.formData();

    if (!form.fhirServerUrl) {
      this.toastService.warning('Voer een FHIR server URL in');

      return;
    }

    this.testing.set(true);
    this.error.set(null);

    try {
      // Build the metadata endpoint URL
      const baseUrl = form.fhirServerUrl.replace(/\/$/, '');
      const metadataUrl = `${baseUrl}/metadata`;

      // Build headers based on auth type
      const headers: Record<string, string> = {
        'Accept': 'application/fhir+json'
      };

      if (form.authType === 'basic' && form.username && form.password) {
        headers['Authorization'] = `Basic ${btoa(`${form.username}:${form.password}`)}`;
      } else if (form.authType === 'bearer' && form.bearerToken) {
        headers['Authorization'] = `Bearer ${form.bearerToken}`;
      }

      // For OAuth2, we would need to get a token first
      if (form.authType === 'oauth2') {
        if (!form.clientId || !form.clientSecret || !form.tokenEndpoint) {
          this.toastService.warning('Vul alle OAuth2 velden in om te testen');

          return;
        }

        // Try to get a token first
        try {
          const tokenResponse = await this.getOAuth2Token(
            form.tokenEndpoint,
            form.clientId,
            form.clientSecret,
            form.scope || undefined
          );

          if (tokenResponse?.access_token) {
            headers['Authorization'] = `Bearer ${tokenResponse.access_token}`;
          } else {
            throw new Error('Geen access token ontvangen');
          }
        } catch (tokenErr) {
          this.toastService.error('OAuth2 authenticatie mislukt', String(tokenErr));

          return;
        }
      }

      // For mTLS, we need to use the Electron proxy
      if (form.authType === 'mtls') {
        const result = await this.testMtlsConnection(metadataUrl, form.mtlsCertificateId);

        if (result.success) {
          this.toastService.success(`Verbinding geslaagd! Status: ${result.status}`);
        } else {
          this.toastService.error('Verbinding mislukt', result.error || 'Onbekende fout');
        }

        return;
      }

      // Make the test request
      const response = await fetch(metadataUrl, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        const serverName = data.software?.name || data.implementation?.description || 'FHIR Server';
        this.toastService.success(`Verbinding geslaagd!`, `${serverName} (${data.fhirVersion || 'Unknown version'})`);
      } else {
        this.toastService.error(`Verbinding mislukt`, `Status: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
        this.toastService.error('Verbinding mislukt', 'Server niet bereikbaar of CORS blokkade');
      } else {
        this.toastService.error('Verbinding mislukt', message);
      }
    } finally {
      this.testing.set(false);
    }
  }

  /**
   * Get OAuth2 token via Electron IPC
   */
  private async getOAuth2Token(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    scope?: string
  ): Promise<{access_token: string; expires_in: number} | null> {
    if ((window as any).electronAPI?.auth?.oauth2Login) {
      return (window as any).electronAPI.auth.oauth2Login(tokenEndpoint, clientId, clientSecret, scope);
    }

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
      return response.json();
    }
    throw new Error(`Token request failed: ${response.status}`);
  }

  /**
   * Test mTLS connection via Electron IPC
   */
  private async testMtlsConnection(
    url: string,
    certificateId: string
  ): Promise<{success: boolean; status?: number; error?: string}> {
    if ((window as any).electronAPI?.certificates?.testConnection) {
      return (window as any).electronAPI.certificates.testConnection(certificateId, url);
    }

    return {success: false, error: 'mTLS niet beschikbaar in browser modus'};
  }

  /**
   * Select a color
   */
  selectColor(color: string): void {
    this.formData.update(f => ({...f, color}));
  }

  /**
   * Update form field
   */
  updateField<K extends keyof ProfileFormData>(field: K, value: ProfileFormData[K]): void {
    this.formData.update(f => ({...f, [field]: value}));
  }

  /**
   * Add a new custom header entry
   */
  addCustomHeader(): void {
    this.formData.update(f => ({
      ...f,
      customHeaders: [...f.customHeaders, {key: '', value: ''}]
    }));
  }

  /**
   * Remove a custom header entry by index
   */
  removeCustomHeader(index: number): void {
    this.formData.update(f => ({
      ...f,
      customHeaders: f.customHeaders.filter((_, i) => i !== index)
    }));
  }

  /**
   * Update a custom header entry
   */
  updateCustomHeader(index: number, field: 'key' | 'value', value: string): void {
    this.formData.update(f => ({
      ...f,
      customHeaders: f.customHeaders.map((h, i) =>
        i === index ? {...h, [field]: value} : h
      )
    }));
  }

  /**
   * Get empty form data
   */
  private getEmptyFormData(): ProfileFormData {
    return {
      name: '',
      fhirServerUrl: '',
      authType: 'none',
      color: DEFAULT_PROFILE.color || PROFILE_COLORS[2],
      clientId: '',
      clientSecret: '',
      tokenEndpoint: '',
      scope: '',
      username: '',
      password: '',
      bearerToken: '',
      mtlsCertificateId: '',
      customHeaders: []
    };
  }

  /**
   * Convert profile to form data
   */
  private profileToFormData(profile: ServerProfile): ProfileFormData {
    // Convert customHeaders Record to array
    const customHeaders: CustomHeaderEntry[] = profile.customHeaders
      ? Object.entries(profile.customHeaders).map(([key, value]) => ({key, value}))
      : [];

    return {
      name: profile.name,
      fhirServerUrl: profile.fhirServerUrl,
      authType: profile.authType,
      color: profile.color || PROFILE_COLORS[2],
      clientId: profile.authConfig?.clientId || '',
      clientSecret: profile.authConfig?.clientSecret || '',
      tokenEndpoint: profile.authConfig?.tokenEndpoint || '',
      scope: profile.authConfig?.scope || '',
      username: profile.authConfig?.username || '',
      password: profile.authConfig?.password || '',
      bearerToken: profile.authConfig?.bearerToken || '',
      mtlsCertificateId: profile.mtlsCertificateId || '',
      customHeaders
    };
  }

  /**
   * Convert form data to profile data
   */
  private formDataToProfile(form: ProfileFormData): Omit<ServerProfile, 'id'> {
    const authConfig: AuthConfig = {};

    switch (form.authType) {
      case 'basic':
        authConfig.username = form.username;
        authConfig.password = form.password;
        break;
      case 'bearer':
        authConfig.bearerToken = form.bearerToken;
        break;
      case 'oauth2':
        authConfig.clientId = form.clientId;
        authConfig.clientSecret = form.clientSecret;
        authConfig.tokenEndpoint = form.tokenEndpoint;

        if (form.scope) {
          authConfig.scope = form.scope;
        }
        break;
    }

    // Convert customHeaders array to Record (filter out empty entries)
    const customHeaders: Record<string, string> = {};
    form.customHeaders
      .filter(h => h.key.trim() && h.value.trim())
      .forEach(h => {
        customHeaders[h.key.trim()] = h.value.trim();
      });

    return {
      name: form.name.trim(),
      fhirServerUrl: form.fhirServerUrl.trim().replace(/\/$/, ''),
      authType: form.authType,
      color: form.color,
      authConfig: Object.keys(authConfig).length > 0 ? authConfig : undefined,
      mtlsCertificateId: form.authType === 'mtls' ? form.mtlsCertificateId : undefined,
      customHeaders: Object.keys(customHeaders).length > 0 ? customHeaders : undefined
    };
  }

  /**
   * Get certificate name by ID
   */
  getCertificateName(id: string): string {
    const cert = this.certificates().find(c => c.id === id);

    return cert?.name || 'Onbekend certificaat';
  }
}
