'use client'

/** Erreur d'API portant un message affichable et un code machine. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

interface ApiResponse {
  ok: boolean
  error?: string
  code?: string
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
  } catch {
    throw new ApiClientError('Connexion impossible. Vérifiez votre réseau.', 0, 'network')
  }

  let payload: (ApiResponse & T) | null = null
  try {
    payload = (await response.json()) as ApiResponse & T
  } catch {
    payload = null
  }

  if (!response.ok || !payload?.ok) {
    throw new ApiClientError(
      payload?.error ?? 'Une erreur est survenue. Réessayez.',
      response.status,
      payload?.code,
    )
  }

  return payload
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body ?? {}),
}
