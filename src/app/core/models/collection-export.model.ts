/**
 * Collection Export Models
 *
 * Types for exporting queries as Postman, OpenAPI, or Insomnia collections
 */

/**
 * Supported collection export formats
 */
export type CollectionExportFormat = 'postman' | 'openapi' | 'insomnia';

/**
 * Source of queries to export
 */
export type CollectionExportSource = 'favorites' | 'history' | 'server-capabilities';

/**
 * Export options for collection generation
 */
export interface CollectionExportOptions {
  /** Export format */
  format: CollectionExportFormat;
  /** Source of queries */
  source: CollectionExportSource;
  /** Collection name */
  collectionName: string;
  /** Include authentication headers */
  includeAuth: boolean;
  /** Base URL to use (defaults to current server) */
  baseUrl?: string;
  /** Include request examples */
  includeExamples: boolean;
}

/**
 * Query item for export
 */
export interface ExportQueryItem {
  /** Query name/description */
  name: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Query path (e.g., /Patient/123 or /Patient?name=Smith) */
  path: string;
  /** Resource type */
  resourceType?: string;
  /** Request body (for POST/PUT) */
  body?: any;
  /** Description */
  description?: string;
}

/**
 * Postman Collection v2.1 format (simplified)
 */
export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

export interface PostmanItem {
  name: string;
  request: {
    method: string;
    header: PostmanHeader[];
    url: PostmanUrl;
    body?: {
      mode: string;
      raw?: string;
      options?: { raw: { language: string } };
    };
    description?: string;
  };
}

export interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanUrl {
  raw: string;
  host: string[];
  path: string[];
  query?: { key: string; value: string }[];
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
}

/**
 * OpenAPI 3.0 format (simplified)
 */
export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  servers: { url: string; description?: string }[];
  paths: Record<string, OpenApiPathItem>;
  components?: {
    securitySchemes?: Record<string, any>;
  };
  security?: any[];
}

export interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    content: Record<string, { schema: any; example?: any }>;
  };
  responses: Record<string, { description: string; content?: any }>;
}

export interface OpenApiParameter {
  name: string;
  in: 'query' | 'path' | 'header';
  required?: boolean;
  schema: { type: string };
  description?: string;
}

/**
 * Insomnia v4 export format (simplified)
 */
export interface InsomniaExport {
  _type: 'export';
  __export_format: number;
  __export_date: string;
  __export_source: string;
  resources: InsomniaResource[];
}

export interface InsomniaResource {
  _id: string;
  _type: 'workspace' | 'request_group' | 'request' | 'environment';
  parentId: string | null;
  name: string;
  description?: string;
  method?: string;
  url?: string;
  body?: {
    mimeType: string;
    text?: string;
  };
  headers?: { name: string; value: string }[];
  parameters?: { name: string; value: string }[];
  data?: Record<string, any>;
}

/**
 * Default export options
 */
export const DEFAULT_COLLECTION_EXPORT_OPTIONS: CollectionExportOptions = {
  format: 'postman',
  source: 'favorites',
  collectionName: 'FHIR API Collection',
  includeAuth: false,
  includeExamples: true
};
