export interface HealthResponse {
  status: 'ok'
}

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

export async function getHealth(): Promise<HealthResponse> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/health`)
  const payload: unknown = await response.json()

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload) ?? `API request failed with status ${response.status}`,
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
