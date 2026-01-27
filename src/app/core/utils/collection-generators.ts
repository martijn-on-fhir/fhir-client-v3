/**
 * Collection Export Generators
 *
 * Utility functions to generate Postman, OpenAPI, and Insomnia collections
 * from FHIR queries.
 */

import {
  CollectionExportFormat,
  CollectionExportOptions,
  ExportQueryItem,
  PostmanCollection,
  PostmanItem,
  PostmanUrl,
  OpenApiSpec,
  OpenApiPathItem,
  OpenApiOperation,
  InsomniaExport,
  InsomniaResource
} from '../models/collection-export.model';

/**
 * Generate a unique ID for Insomnia resources
 */
const generateId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * Parse a query path into components
 */
const parseQueryPath = (path: string): { basePath: string; queryParams: Record<string, string> } => {
  const [basePath, queryString] = path.split('?');
  const queryParams: Record<string, string> = {};

  if (queryString) {
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      queryParams[key] = value;
    });
  }

  return { basePath, queryParams };
};

/**
 * Extract resource type from path
 */
const extractResourceType = (path: string): string => {
  const { basePath } = parseQueryPath(path);
  const segments = basePath.split('/').filter(Boolean);

  return segments[0] || 'Unknown';
};

/**
 * Group queries by resource type
 */
const groupByResourceType = (queries: ExportQueryItem[]): Record<string, ExportQueryItem[]> => {
  const grouped: Record<string, ExportQueryItem[]> = {};

  for (const query of queries) {
    const resourceType = query.resourceType || extractResourceType(query.path);

    if (!grouped[resourceType]) {
      grouped[resourceType] = [];
    }
    grouped[resourceType].push(query);
  }

  return grouped;
};

/**
 * Convert FHIR path to OpenAPI path format
 * e.g., /Patient/123 -> /Patient/{id}
 */
const convertToOpenApiPath = (path: string): string => {
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return '/';
  }

  // Resource type is first segment
  const resourceType = segments[0];

  if (segments.length === 1) {
    return `/${resourceType}`;
  }

  // If second segment looks like an ID, replace with {id}
  const secondSegment = segments[1];
  if (secondSegment && !secondSegment.startsWith('$') && !secondSegment.startsWith('_')) {
    segments[1] = '{id}';
  }

  return '/' + segments.join('/');
};

/**
 * Generate operation ID for OpenAPI
 */
const generateOperationId = (query: ExportQueryItem): string => {
  const resourceType = query.resourceType || extractResourceType(query.path);
  const method = query.method.toLowerCase();
  const { basePath } = parseQueryPath(query.path);
  const segments = basePath.split('/').filter(Boolean);

  // Handle operations like $everything
  if (segments.some(s => s.startsWith('$'))) {
    const operation = segments.find(s => s.startsWith('$'));

    return `${method}${resourceType}${operation?.replace('$', '_')}`;
  }

  // Handle _history
  if (segments.includes('_history')) {
    return `${method}${resourceType}History`;
  }

  // Single resource
  if (segments.length === 2) {
    return `${method}${resourceType}ById`;
  }

  // Search/list
  return `${method}${resourceType}`;
};

/**
 * Generate Postman Collection v2.1
 */
export const generatePostmanCollection = (
  queries: ExportQueryItem[],
  options: CollectionExportOptions
): PostmanCollection => {
  const baseUrl = options.baseUrl || '{{baseUrl}}';

  // Group queries by resource type
  const groupedQueries = groupByResourceType(queries);

  const items: PostmanItem[] = [];

  // Create folders for each resource type
  for (const [resourceType, typeQueries] of Object.entries(groupedQueries)) {
    const folderItems: PostmanItem[] = typeQueries.map(query => {
      const { basePath, queryParams } = parseQueryPath(query.path);
      const fullUrl = `${baseUrl}${query.path}`;

      const url: PostmanUrl = {
        raw: fullUrl,
        host: [baseUrl.replace(/^https?:\/\//, '')],
        path: basePath.split('/').filter(Boolean),
        query: Object.entries(queryParams).map(([key, value]) => ({
          key,
          value
        }))
      };

      const item: PostmanItem = {
        name: query.name,
        request: {
          method: query.method,
          header: [
            { key: 'Accept', value: 'application/fhir+json' },
            { key: 'Content-Type', value: 'application/fhir+json' }
          ],
          url,
          description: query.description
        }
      };

      // Add body for POST/PUT
      if (query.body && (query.method === 'POST' || query.method === 'PUT' || query.method === 'PATCH')) {
        item.request.body = {
          mode: 'raw',
          raw: typeof query.body === 'string' ? query.body : JSON.stringify(query.body, null, 2),
          options: { raw: { language: 'json' } }
        };
      }

      return item;
    });

    // Add as folder if multiple resource types, otherwise flat
    if (Object.keys(groupedQueries).length > 1) {
      items.push({
        name: resourceType,
        request: {
          method: 'GET',
          header: [],
          url: { raw: '', host: [], path: [] }
        },
        // @ts-expect-error - Postman uses item array for folders
        item: folderItems
      });
    } else {
      items.push(...folderItems);
    }
  }

  const collection: PostmanCollection = {
    info: {
      name: options.collectionName,
      description: `FHIR API Collection exported from FHIR Client MX\nBase URL: ${baseUrl}`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: items,
    variable: [
      { key: 'baseUrl', value: options.baseUrl || 'https://your-fhir-server.com/fhir', type: 'string' }
    ]
  };

  return collection;
};

/**
 * Generate OpenAPI 3.0 Specification
 */
export const generateOpenApiSpec = (
  queries: ExportQueryItem[],
  options: CollectionExportOptions
): OpenApiSpec => {
  const baseUrl = options.baseUrl || 'https://your-fhir-server.com/fhir';

  const paths: Record<string, OpenApiPathItem> = {};

  // Group queries and build paths
  for (const query of queries) {
    const { basePath, queryParams } = parseQueryPath(query.path);

    // Convert path to OpenAPI format (e.g., /Patient/{id})
    const openApiPath = convertToOpenApiPath(basePath);

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    const method = query.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    const resourceType = query.resourceType || extractResourceType(query.path);

    const operation: OpenApiOperation = {
      summary: query.name,
      description: query.description,
      operationId: generateOperationId(query),
      tags: [resourceType],
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/fhir+json': {
              schema: { type: 'object' }
            }
          }
        },
        '400': { description: 'Bad request' },
        '401': { description: 'Unauthorized' },
        '404': { description: 'Resource not found' }
      }
    };

    // Add query parameters
    if (Object.keys(queryParams).length > 0) {
      operation.parameters = Object.entries(queryParams).map(([name, value]) => ({
        name,
        in: 'query' as const,
        required: false,
        schema: { type: 'string' },
        description: `Example: ${value}`
      }));
    }

    // Add path parameters
    const pathParams = openApiPath.match(/\{(\w+)\}/g);
    if (pathParams) {
      operation.parameters = operation.parameters || [];
      for (const param of pathParams) {
        const paramName = param.replace(/[{}]/g, '');
        operation.parameters.push({
          name: paramName,
          in: 'path' as const,
          required: true,
          schema: { type: 'string' },
          description: `${resourceType} ${paramName}`
        });
      }
    }

    // Add request body for POST/PUT
    if (query.body && (method === 'post' || method === 'put' || method === 'patch')) {
      operation.requestBody = {
        content: {
          'application/fhir+json': {
            schema: { type: 'object' },
            example: query.body
          }
        }
      };
    }

    paths[openApiPath][method] = operation;
  }

  const spec: OpenApiSpec = {
    openapi: '3.0.3',
    info: {
      title: options.collectionName,
      description: 'FHIR API specification exported from FHIR Client MX',
      version: '1.0.0'
    },
    servers: [
      { url: baseUrl, description: 'FHIR Server' }
    ],
    paths
  };

  // Add security scheme if auth is included
  if (options.includeAuth) {
    spec.components = {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    };
    spec.security = [{ bearerAuth: [] }];
  }

  return spec;
};

/**
 * Generate Insomnia v4 Export
 */
export const generateInsomniaExport = (
  queries: ExportQueryItem[],
  options: CollectionExportOptions
): InsomniaExport => {
  const baseUrl = options.baseUrl || '{{ base_url }}';
  const resources: InsomniaResource[] = [];

  // Create workspace
  const workspaceId = generateId('wrk');
  resources.push({
    _id: workspaceId,
    _type: 'workspace',
    parentId: null,
    name: options.collectionName,
    description: 'FHIR API Collection exported from FHIR Client MX'
  });

  // Create base environment
  const envId = generateId('env');
  resources.push({
    _id: envId,
    _type: 'environment',
    parentId: workspaceId,
    name: 'Base Environment',
    data: {
      base_url: options.baseUrl || 'https://your-fhir-server.com/fhir'
    }
  });

  // Group queries by resource type
  const groupedQueries = groupByResourceType(queries);

  // Create request groups (folders) and requests
  for (const [resourceType, typeQueries] of Object.entries(groupedQueries)) {
    // Create folder for resource type
    const folderId = generateId('fld');
    resources.push({
      _id: folderId,
      _type: 'request_group',
      parentId: workspaceId,
      name: resourceType,
      description: `${resourceType} operations`
    });

    // Create requests
    for (const query of typeQueries) {
      const { basePath, queryParams } = parseQueryPath(query.path);
      const requestId = generateId('req');

      const request: InsomniaResource = {
        _id: requestId,
        _type: 'request',
        parentId: folderId,
        name: query.name,
        description: query.description,
        method: query.method,
        url: `${baseUrl}${basePath}`,
        headers: [
          { name: 'Accept', value: 'application/fhir+json' },
          { name: 'Content-Type', value: 'application/fhir+json' }
        ],
        parameters: Object.entries(queryParams).map(([name, value]) => ({
          name,
          value
        }))
      };

      // Add body for POST/PUT
      if (query.body && (query.method === 'POST' || query.method === 'PUT' || query.method === 'PATCH')) {
        request.body = {
          mimeType: 'application/json',
          text: typeof query.body === 'string' ? query.body : JSON.stringify(query.body, null, 2)
        };
      }

      resources.push(request);
    }
  }

  return {
    _type: 'export',
    __export_format: 4,
    __export_date: new Date().toISOString(),
    __export_source: 'fhir-client-mx',
    resources
  };
};

/**
 * Generate collection based on format
 */
export const generateCollection = (
  queries: ExportQueryItem[],
  options: CollectionExportOptions
): string => {
  let result: PostmanCollection | OpenApiSpec | InsomniaExport;

  switch (options.format) {
    case 'postman':
      result = generatePostmanCollection(queries, options);
      break;
    case 'openapi':
      result = generateOpenApiSpec(queries, options);
      break;
    case 'insomnia':
      result = generateInsomniaExport(queries, options);
      break;
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }

  return JSON.stringify(result, null, 2);
};

/**
 * Get file extension for format
 */
export const getFileExtension = (format: CollectionExportFormat): string => {
  switch (format) {
    case 'postman':
      return 'postman_collection.json';
    case 'openapi':
      return 'openapi.json';
    case 'insomnia':
      return 'insomnia.json';
    default:
      return 'json';
  }
};
