/**
 * Electron API Type Definitions
 *
 * This file extends the Window interface to include the electronAPI
 * that is exposed via the preload script.
 */

declare global {
  interface Window {
    electronAPI?: {
      // Event listeners
      on?: (channel: string, callback: (...args: any[]) => void) => void;
      off?: (channel: string, callback?: (...args: any[]) => void) => void;

      auth?: {
        startLogin: (clientId: string, clientSecret: string, environment: any) => Promise<{ success: boolean }>;
        getToken: () => Promise<any>;
        logout: () => Promise<{ success: boolean }>;
        checkAuth: () => Promise<boolean>;
        refreshToken: () => Promise<any>;
      };
      metadata?: {
        save: (metadata: any) => Promise<{ success: boolean }>;
        get: () => Promise<any | null>;
        clear: () => Promise<{ success: boolean }>;
      };
      file?: {
        openFile: () => Promise<{ path: string; content: string } | { error: string } | null>;
        saveFile: (content: string, defaultFileName?: string) => Promise<{ path: string; success: boolean } | { error: string } | null>;
      };
      shell?: {
        openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      };
      profileCache?: {
        getProfile: (title: string) => Promise<any | null>;
        setProfile: (title: string, data: any) => Promise<{ success: boolean }>;
        clear: () => Promise<{ success: boolean }>;
        stats: () => Promise<{ fileCount: number; totalSize: number }>;
      };
      log?: {
        error: (...args: any[]) => void;
        warn: (...args: any[]) => void;
        info: (...args: any[]) => void;
        debug: (...args: any[]) => void;
        verbose: (...args: any[]) => void;
      };
      logs?: {
        getPaths: () => Promise<{ mainLog: string; rendererLog: string } | { error: string }>;
        read: (options?: { tail?: number }) => Promise<
          | {
              logs: Array<{
                source: string;
                raw: string;
                timestamp: string | null;
                level: 'debug' | 'info' | 'warn' | 'error' | null;
                process: string | null;
                component: string | null;
                message: string;
              }>;
            }
          | { error: string }
        >;
        watch: () => Promise<{ success: boolean } | { error: string }>;
        unwatch: () => Promise<{ success: boolean } | { error: string }>;
        export: () => Promise<{ success: boolean; path?: string } | { error: string; canceled?: boolean }>;
      };
      terminology?: {
        lookup: (code: string, system: string) => Promise<any>;
        expand: (url: string, filter?: string) => Promise<any>;
        validate: (code: string, system: string, valueSetUrl: string) => Promise<any>;
      };
      certificates?: {
        getAll: () => Promise<{
          success: boolean;
          certificates?: Array<{
            id: string;
            name: string;
            domain: string;
            enabled: boolean;
            commonName?: string;
            issuer?: string;
            validFrom?: number;
            validTo?: number;
            serialNumber?: string;
            createdAt: number;
            updatedAt: number;
            hasPrivateKey: boolean;
            hasPassphrase: boolean;
            hasCaCertificate: boolean;
          }>;
          error?: string;
        }>;
        save: (entry: {
          name: string;
          domain: string;
          clientCertificate: string;
          privateKey: string;
          caCertificate?: string;
          passphrase?: string;
          metadata?: {
            commonName?: string;
            issuer?: string;
            validFrom?: number;
            validTo?: number;
            serialNumber?: string;
          };
        }) => Promise<{ success: boolean; certificate?: any; error?: string }>;
        update: (
          id: string,
          updates: {
            name?: string;
            domain?: string;
            enabled?: boolean;
            clientCertificate?: string;
            privateKey?: string;
            caCertificate?: string;
            passphrase?: string;
            metadata?: any;
          }
        ) => Promise<{ success: boolean; certificate?: any; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        import: (type: 'pfx' | 'certificate' | 'key' | 'all') => Promise<{
          success: boolean;
          canceled?: boolean;
          filePath?: string;
          fileType?: string;
          needsPassphrase?: boolean;
          data?: {
            type: string;
            pem?: string;
            clientCertificate?: string;
            privateKey?: string;
            caCertificate?: string;
            metadata?: any;
          };
          error?: string;
        }>;
        parsePfx: (
          filePath: string,
          passphrase: string
        ) => Promise<{
          success: boolean;
          data?: {
            type: string;
            clientCertificate?: string;
            privateKey?: string;
            caCertificate?: string;
            metadata?: any;
          };
          error?: string;
        }>;
        validate: (data: {
          clientCertificate: string;
          privateKey?: string;
          passphrase?: string;
        }) => Promise<{
          success: boolean;
          valid: boolean;
          metadata?: any;
          isExpired?: boolean;
          isNotYetValid?: boolean;
          warnings?: string[];
          error?: string;
        }>;
        validateStored: (
          id: string
        ) => Promise<{
          success: boolean;
          valid: boolean;
          metadata?: any;
          isExpired?: boolean;
          isNotYetValid?: boolean;
          warnings?: string[];
          error?: string;
        }>;
        testConnection: (
          id: string,
          testUrl: string
        ) => Promise<{
          success: boolean;
          status?: number;
          statusText?: string;
          headers?: { server?: string; contentType?: string };
          error?: string;
          code?: string;
        }>;
        testConnectionWithData: (params: {
          testUrl: string;
          clientCertificate: string;
          privateKey: string;
          caCertificate?: string;
          passphrase?: string;
        }) => Promise<{
          success: boolean;
          status?: number;
          statusText?: string;
          headers?: { server?: string; contentType?: string };
          error?: string;
          code?: string;
        }>;
      };
      mtls?: {
        hasCertificate: (hostname: string) => Promise<{
          hasCertificate: boolean;
          enabled: boolean;
        }>;
        request: (options: {
          url: string;
          method?: string;
          headers?: Record<string, string>;
          data?: any;
          timeout?: number;
        }) => Promise<{
          success: boolean;
          status?: number;
          statusText?: string;
          headers?: Record<string, any>;
          data?: any;
          error?: string;
          code?: string;
        }>;
        getCertificateInfo: (hostname: string) => Promise<{
          found: boolean;
          certificate?: {
            id: string;
            name: string;
            domain: string;
            enabled: boolean;
            commonName?: string;
            issuer?: string;
            validFrom?: number;
            validTo?: number;
          };
          error?: string;
        }>;
      };
      onShowAbout?: (callback: () => void) => () => void;
      onOpenSettings?: (callback: () => void) => () => void;
      onToggleSidebar?: (callback: () => void) => () => void;
      onOpenFile?: (callback: () => void) => () => void;
      onSaveFile?: (callback: () => void) => () => void;
      onOpenVisualBuilder?: (callback: () => void) => () => void;
      onToggleTheme?: (callback: () => void) => () => void;
      onLogsUpdated?: (callback: () => void) => () => void;
    };
  }
}

export {};
