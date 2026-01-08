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
