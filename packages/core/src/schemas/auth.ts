// Better Auth models for the OAuth authorization server.
// Field keys must stay the Better Auth field names (the Drizzle adapter indexes columns by them);
// SQL names are snake_case and tables carry an `auth_` prefix to avoid colliding with Telegram `users`.
// Regenerate from `getAuthTables` when Better Auth or its plugins change; the linked Telegram account carries the Telegram user ID.
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const authUserTable = pgTable('auth_users', {
  id: text().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
})

export const authSessionTable = pgTable('auth_sessions', {
  id: text().primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => authUserTable.id, { onDelete: 'cascade' }),
}, table => [
  index('auth_session_user_id_index').on(table.userId),
])

export const authAccountTable = pgTable('auth_accounts', {
  id: text().primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => authUserTable.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, table => [
  index('auth_account_user_id_index').on(table.userId),
])

export const authVerificationTable = pgTable('auth_verifications', {
  id: text().primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
}, table => [
  index('auth_verification_identifier_index').on(table.identifier),
])

export const authJwksTable = pgTable('auth_jwks', {
  id: text().primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  alg: text('alg'),
  crv: text('crv'),
})

export const authOauthClientTable = pgTable('auth_oauth_clients', {
  id: text().primaryKey(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'),
  clientDiscoveryId: text('client_discovery_id'),
  disabled: boolean('disabled').default(false),
  skipConsent: boolean('skip_consent'),
  enableEndSession: boolean('enable_end_session'),
  subjectType: text('subject_type'),
  scopes: text('scopes').array(),
  clientCredentialsScopes: text('client_credentials_scopes').array().default([]),
  userId: text('user_id').references(() => authUserTable.id),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  name: text('name'),
  uri: text('uri'),
  icon: text('icon'),
  contacts: text('contacts').array(),
  tos: text('tos'),
  policy: text('policy'),
  softwareId: text('software_id'),
  softwareVersion: text('software_version'),
  softwareStatement: text('software_statement'),
  redirectUris: text('redirect_uris').array().notNull(),
  postLogoutRedirectUris: text('post_logout_redirect_uris').array(),
  backchannelLogoutUri: text('backchannel_logout_uri'),
  backchannelLogoutSessionRequired: boolean('backchannel_logout_session_required'),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
  applicationType: text('application_type'),
  jwks: text('jwks'),
  jwksUri: text('jwks_uri'),
  grantTypes: text('grant_types').array(),
  responseTypes: text('response_types').array(),
  requirePKCE: boolean('require_p_k_c_e'),
  dpopBoundAccessTokens: boolean('dpop_bound_access_tokens').default(false),
  referenceId: text('reference_id'),
  metadata: jsonb('metadata'),
}, table => [
  index('auth_oauth_client_user_id_index').on(table.userId),
])

export const authOauthResourceTable = pgTable('auth_oauth_resources', {
  id: text().primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('access_token_ttl'),
  refreshTokenTtl: integer('refresh_token_ttl'),
  signingAlgorithm: text('signing_algorithm'),
  signingKeyId: text('signing_key_id'),
  allowedScopes: text('allowed_scopes').array(),
  customClaims: jsonb('custom_claims'),
  dpopBoundAccessTokensRequired: boolean('dpop_bound_access_tokens_required').default(false),
  disabled: boolean('disabled').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  policyVersion: integer('policy_version').default(1),
  metadata: jsonb('metadata'),
})

export const authOauthClientResourceTable = pgTable('auth_oauth_client_resources', {
  id: text().primaryKey(),
  clientId: text('client_id').notNull().references(() => authOauthClientTable.clientId, { onDelete: 'cascade' }),
  resourceId: text('resource_id').notNull().references(() => authOauthResourceTable.identifier, { onDelete: 'cascade' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, table => [
  index('auth_oauth_client_resource_client_id_index').on(table.clientId),
  index('auth_oauth_client_resource_resource_id_index').on(table.resourceId),
  uniqueIndex('auth_oauth_client_resource_client_id_resource_id_unique_index').on(table.clientId, table.resourceId),
])

export const authOauthRefreshTokenTable = pgTable('auth_oauth_refresh_tokens', {
  id: text().primaryKey(),
  token: text('token').notNull().unique(),
  clientId: text('client_id').notNull().references(() => authOauthClientTable.clientId),
  sessionId: text('session_id').references(() => authSessionTable.id, { onDelete: 'set null' }),
  userId: text('user_id').notNull().references(() => authUserTable.id),
  referenceId: text('reference_id'),
  authorizationCodeId: text('authorization_code_id'),
  resources: text('resources').array(),
  requestedUserInfoClaims: text('requested_user_info_claims').array(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
  revoked: timestamp('revoked', { withTimezone: true }),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
  rotationReplayResponse: text('rotation_replay_response'),
  rotationReplayExpiresAt: timestamp('rotation_replay_expires_at', { withTimezone: true }),
  authTime: timestamp('auth_time', { withTimezone: true }),
  confirmation: jsonb('confirmation'),
  scopes: text('scopes').array().notNull(),
}, table => [
  index('auth_oauth_refresh_token_client_id_index').on(table.clientId),
  index('auth_oauth_refresh_token_session_id_index').on(table.sessionId),
  index('auth_oauth_refresh_token_user_id_index').on(table.userId),
  index('auth_oauth_refresh_token_authorization_code_id_index').on(table.authorizationCodeId),
])

export const authOauthAccessTokenTable = pgTable('auth_oauth_access_tokens', {
  id: text().primaryKey(),
  token: text('token').unique(),
  clientId: text('client_id').notNull().references(() => authOauthClientTable.clientId),
  sessionId: text('session_id').references(() => authSessionTable.id, { onDelete: 'set null' }),
  userId: text('user_id').references(() => authUserTable.id),
  referenceId: text('reference_id'),
  authorizationCodeId: text('authorization_code_id'),
  resources: text('resources').array(),
  requestedUserInfoClaims: text('requested_user_info_claims').array(),
  refreshId: text('refresh_id').references(() => authOauthRefreshTokenTable.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
  revoked: timestamp('revoked', { withTimezone: true }),
  confirmation: jsonb('confirmation'),
  scopes: text('scopes').array().notNull(),
}, table => [
  index('auth_oauth_access_token_client_id_index').on(table.clientId),
  index('auth_oauth_access_token_session_id_index').on(table.sessionId),
  index('auth_oauth_access_token_user_id_index').on(table.userId),
  index('auth_oauth_access_token_authorization_code_id_index').on(table.authorizationCodeId),
  index('auth_oauth_access_token_refresh_id_index').on(table.refreshId),
])

export const authOauthConsentTable = pgTable('auth_oauth_consents', {
  id: text().primaryKey(),
  clientId: text('client_id').notNull().references(() => authOauthClientTable.clientId),
  userId: text('user_id').references(() => authUserTable.id),
  referenceId: text('reference_id'),
  resources: text('resources').array(),
  requestedUserInfoClaims: text('requested_user_info_claims').array(),
  scopes: text('scopes').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, table => [
  index('auth_oauth_consent_client_id_index').on(table.clientId),
  index('auth_oauth_consent_user_id_index').on(table.userId),
])

export const authOauthClientAssertionTable = pgTable('auth_oauth_client_assertions', {
  id: text().primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const authDeviceCodeTable = pgTable('auth_device_codes', {
  id: text().primaryKey(),
  deviceCode: text('device_code').notNull(),
  userCode: text('user_code').notNull(),
  userId: text('user_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: text('status').notNull(),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  pollingInterval: integer('polling_interval'),
  clientId: text('client_id'),
  scope: text('scope'),
  resources: text('resources').array(),
  oauthClientId: text('oauth_client_id'),
}, table => [
  uniqueIndex('auth_device_code_device_code_unique_index').on(table.deviceCode),
  uniqueIndex('auth_device_code_user_code_unique_index').on(table.userCode),
])

/** Better Auth model name to table, passed to the Drizzle adapter. */
export const authSchema = {
  user: authUserTable,
  session: authSessionTable,
  account: authAccountTable,
  verification: authVerificationTable,
  jwks: authJwksTable,
  oauthClient: authOauthClientTable,
  oauthResource: authOauthResourceTable,
  oauthClientResource: authOauthClientResourceTable,
  oauthRefreshToken: authOauthRefreshTokenTable,
  oauthAccessToken: authOauthAccessTokenTable,
  oauthConsent: authOauthConsentTable,
  oauthClientAssertion: authOauthClientAssertionTable,
  deviceCode: authDeviceCodeTable,
}
