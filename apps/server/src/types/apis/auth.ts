/**
 * Auth response for sending verification code
 */
export interface SendCodeResponse {
  success: boolean
}

/**
 * Auth request for login
 */
export interface LoginRequest {
  code?: string
  password?: string
}

/**
 * Auth status response
 */
export interface AuthStatusResponse {
  connected: boolean
}

/**
 * Auth response for login/logout
 */
export interface AuthResponse {
  success: boolean
}
