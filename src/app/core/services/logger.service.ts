/**
 * Logger Service - Angular version
 *
 * Centralized logging with automatic sensitive data sanitization
 * Uses electron-log via IPC for file persistence
 *
 * Features:
 * - Automatic token/password redaction
 * - Component-scoped logging
 * - File persistence with rotation
 * - Console output in development
 */

import { Injectable } from '@angular/core';

/**
 * Sensitive data patterns to redact from logs
 */
const SENSITIVE_PATTERNS = {
  access_token: /access_token["\s:=]+"?([^,\s}"]+)"?/gi,
  client_secret: /client_secret["\s:=]+"?([^,\s}"]+)"?/gi,
  refresh_token: /refresh_token["\s:=]+"?([^,\s}"]+)"?/gi,
  password: /password["\s:=]+"?([^,\s}"]+)"?/gi,
  authorization: /authorization["\s:=]+"?(?:Bearer\s+)?([^,\s}"\n]+)"?/gi,
};

/**
 * Sensitive keys to redact from objects
 */
const SENSITIVE_KEYS = [
  'access_token',
  'accessToken',
  'client_secret',
  'clientSecret',
  'refresh_token',
  'refreshToken',
  'password',
  'authorization',
  'Authorization',
  'secret',
];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private isDevelopment = !window.location.href.includes('app.asar');

  /**
   * Sanitize a string by redacting sensitive data patterns
   */
  private sanitizeString(str: string): string {

    let sanitized = str;

    Object.entries(SENSITIVE_PATTERNS).forEach(([key, pattern]) => {
      sanitized = sanitized.replace(pattern, `${key}=[REDACTED]`);
    });

    return sanitized;
  }

  /**
   * Recursively sanitize an object by redacting sensitive keys
   */
  private sanitizeObject(obj: any): any {

    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle strings
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    // Handle objects
    if (typeof obj === 'object') {
      const sanitized: any = {};

      Object.keys(obj).forEach((key) => {
        if (SENSITIVE_KEYS.includes(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeObject(obj[key]);
        }
      });

      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize all arguments before logging
   */
  private sanitizeArgs(...args: any[]): any[] {

    return args.map((arg) => {

      if (typeof arg === 'string') {
        return this.sanitizeString(arg);
      } else if (typeof arg === 'object') {
        return this.sanitizeObject(arg);
      }
      return arg;
    });
  }

  /**
   * Format log message with timestamp and level
   */
  private formatMessage(level: LogLevel, ...args: any[]): string {

    const timestamp = new Date().toISOString();
    const sanitized = this.sanitizeArgs(...args);
    const message = sanitized.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Log using electron-log (with console fallback)
   */
  private logToConsole(level: LogLevel, ...args: any[]): void {

    const sanitized = this.sanitizeArgs(...args);
    const electronLog = (window as any).electronAPI?.log;

    if (this.isDevelopment || level === 'warn' || level === 'error') {

      if (electronLog) {
        // Use electron-log
        switch (level) {
          case 'debug':
            electronLog.debug(...sanitized);
            break;
          case 'info':
            electronLog.info(...sanitized);
            break;
          case 'warn':
            electronLog.warn(...sanitized);
            break;
          case 'error':
            electronLog.error(...sanitized);
            break;
        }
      } else {
        // Fallback to console (e.g., during tests or in browser)
        switch (level) {
          case 'debug':
            console.debug(...sanitized);
            break;
          case 'info':
            console.log(...sanitized);
            break;
          case 'warn':
            console.warn(...sanitized);
            break;
          case 'error':
            console.error(...sanitized);
            break;
        }
      }
    }
  }

  /**
   * Debug level logging
   */
  debug(...args: any[]): void {
    this.logToConsole('debug', ...args);
  }

  /**
   * Info level logging
   */
  info(...args: any[]): void {
    this.logToConsole('info', ...args);
  }

  /**
   * Warning level logging
   */
  warn(...args: any[]): void {
    this.logToConsole('warn', ...args);
  }

  /**
   * Error level logging
   */
  error(...args: any[]): void {
    this.logToConsole('error', ...args);
  }

  /**
   * Create a component-scoped logger with prefix
   */
  component(componentName: string) {
    const prefix = `[${componentName}]`;

    return {
      debug: (...args: any[]) => this.debug(prefix, ...args),
      info: (...args: any[]) => this.info(prefix, ...args),
      warn: (...args: any[]) => this.warn(prefix, ...args),
      error: (...args: any[]) => this.error(prefix, ...args),
    };
  }
}
