/**
 * Environment Configuration
 *
 * OAuth2/OIDC endpoints and FHIR server configurations
 * Based on Keycloak realms for different environments
 *
 * NOTE: This application runs exclusively in Electron
 */

export type Environment = 'development' | 'local' | 'acceptance' | 'production';

export interface EnvironmentConfig {
  name: string;
  displayName: string;
  fhirServer: string;
  authServer: string;
  tokenEndpoint: string;
  realm: string;
  grantType: 'client_credentials';
  scope: string;
}

export const ENVIRONMENTS: Record<Environment, EnvironmentConfig> = {
  development: {
    name: 'development',
    displayName: 'Development',
    fhirServer: 'https://fhir-adapcare.dev.carebeat-connector.nl',
    authServer: 'https://keycloak.dev.carebeat-connector.nl',
    tokenEndpoint: 'https://keycloak.dev.carebeat-connector.nl/realms/adapcare-careconnector/protocol/openid-connect/token',
    realm: 'adapcare-careconnector',
    grantType: 'client_credentials',
    scope: 'user/*.cruds'
  },

  local: {
    name: 'local',
    displayName: 'Local',
    fhirServer: 'http://localhost:8080/fhir',
    authServer: 'http://localhost:8081',
    tokenEndpoint: 'http://localhost:8081/realms/adapcare-careconnector/protocol/openid-connect/token',
    realm: 'adapcare-careconnector',
    grantType: 'client_credentials',
    scope: 'user/*.cruds'
  },

  acceptance: {
    name: 'acceptance',
    displayName: 'Acceptance',
    fhirServer: 'https://fhir.acc.carebeat-connector.nl/fhir',
    authServer: 'https://keycloak.acc.carebeat-connector.nl',
    tokenEndpoint: 'https://keycloak.acc.carebeat-connector.nl/realms/adapcare-careconnector/protocol/openid-connect/token',
    realm: 'adapcare-careconnector',
    grantType: 'client_credentials',
    scope: 'user/*.cruds'
  },

  production: {
    name: 'production',
    displayName: 'Production',
    fhirServer: 'https://fhir.carebeat-connector.nl/fhir',
    authServer: 'https://keycloak.carebeat-connector.nl',
    tokenEndpoint: 'https://keycloak.carebeat-connector.nl/realms/adapcare-careconnector/protocol/openid-connect/token',
    realm: 'adapcare-careconnector',
    grantType: 'client_credentials',
    scope: 'user/*.cruds'
  }
};

/**
 * Get environment configuration
 */
export const getEnvironmentConfig = (env: Environment): EnvironmentConfig =>ENVIRONMENTS[env]

/**
 * Get all available environments
 */
export const getAvailableEnvironments = (): Environment[] => Object.keys(ENVIRONMENTS) as Environment[]
