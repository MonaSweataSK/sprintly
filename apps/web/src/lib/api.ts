export interface HealthResponse {
  status: 'ok'
}

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'USER'
}

export interface OtpRequestResponse {
  message: string
  expiresInSeconds: number
  resendAfterSeconds: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/v1`

function getErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || !('message' in payload)) {
    return undefined
  }

  const message = payload.message
  if (typeof message === 'string') {
    return message
  }
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ')
  }
  return undefined
}

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    return undefined
  }
  return response.json()
}

async function send(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${apiBase}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
}

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  allowSessionRenewal = true,
): Promise<T> {
  let response = await send(path, init)

  if (
    response.status === 401 &&
    allowSessionRenewal &&
    path !== '/auth/refresh' &&
    path !== '/auth/verify-otp' &&
    path !== '/auth/request-otp' &&
    path !== '/auth/logout'
  ) {
    const refresh = await send('/auth/refresh', { method: 'POST' })
    if (refresh.ok) {
      response = await send(path, init)
    }
  }

  const payload = await readPayload(response)
  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload) ?? `API request failed with status ${response.status}`,
      response.status,
    )
  }
  return payload as T
}

export async function requestOtp(email: string): Promise<OtpRequestResponse> {
  return apiRequest<OtpRequestResponse>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ user: CurrentUser }> {
  return apiRequest<{ user: CurrentUser }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/auth/me')
}

export async function logout(): Promise<void> {
  await apiRequest<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }, false)
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBase.replace(/\/api\/v1$/, '')}/health`)
  const payload: unknown = await readPayload(response)

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload) ?? `API request failed with status ${response.status}`,
      response.status,
    )
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('status' in payload) ||
    payload.status !== 'ok'
  ) {
    throw new Error('The API returned an invalid health response')
  }

  return { status: 'ok' }
}
