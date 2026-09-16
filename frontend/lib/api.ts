import type { Idea } from "./roadmap"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("access_token")
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("refresh_token")
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return
  localStorage.setItem("access_token", access)
  localStorage.setItem("refresh_token", refresh)
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return
  if (token) {
    localStorage.setItem("access_token", token)
  } else {
    localStorage.removeItem("access_token")
  }
}

export function clearTokens() {
  if (typeof window === "undefined") return
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

export class ApiError extends Error {
  status: number
  data: any

  constructor(message: string, status: number, data?: any) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

let isRefreshing = false
let refreshSubscribers: Array<(token: string | null) => void> = []

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach(cb => cb(token))
  refreshSubscribers = []
}

async function performTokenRefresh(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null

  try {
    const response = await fetch(`${API_URL}/api/auth/login/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })

    if (!response.ok) {
      clearTokens()
      return null
    }

    const data = await response.json()
    if (data.access) {
      setAccessToken(data.access)
      return data.access
    }
    clearTokens()
    return null
  } catch {
    clearTokens()
    return null
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  timeout = 10000,
  isRetry = false
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  const token = getAccessToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token && path.startsWith("/api/ideas/")) {
    headers["Authorization"] = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })

    // Handle 401 Unauthorized with silent refresh (once)
    if (response.status === 401 && !isRetry && path.startsWith("/api/ideas/")) {
      clearTimeout(timer)
      let newToken: string | null = null

      if (!isRefreshing) {
        isRefreshing = true
        newToken = await performTokenRefresh()
        isRefreshing = false
        onRefreshed(newToken)
      } else {
        newToken = await new Promise<string | null>(resolve => {
          refreshSubscribers.push(resolve)
        })
      }

      if (newToken) {
        return apiRequest<T>(path, options, timeout, true)
      } else {
        clearTokens()
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth_unauthorized"))
        }
        throw new ApiError("Session expired. Please log in again.", 401)
      }
    }

    // Special handling for 502 on POST /api/ideas/ (which returns the failed Idea object)
    if (response.status === 502 && path === "/api/ideas/") {
      try {
        const failedIdea = await response.json()
        return failedIdea as T
      } catch {
        // Fall back to throwing ApiError below if JSON parsing fails
      }
    }

    if (!response.ok) {
      let errorData: any = null
      try {
        errorData = await response.json()
      } catch {}
      const errorMessage =
        errorData?.detail ||
        errorData?.error ||
        (typeof errorData === "object" ? JSON.stringify(errorData) : null) ||
        `Request failed with status ${response.status}`
      throw new ApiError(errorMessage, response.status, errorData)
    }

    return (await response.json()) as T
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.", 408)
    }
    if (err instanceof ApiError) {
      throw err
    }
    throw new ApiError(err.message || "Network error occurred", 0)
  } finally {
    clearTimeout(timer)
  }
}

// Auth API endpoints
export async function register(username: string, password: string, email?: string) {
  return apiRequest<{ id: number; username: string; email: string }>("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify({ username, password, email: email || "" }),
  })
}

export async function login(username: string, password: string) {
  const data = await apiRequest<{ access: string; refresh: string }>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
  setTokens(data.access, data.refresh)
  return data
}

// Ideas API endpoints
export async function createIdea(input_text: string) {
  // 45 second timeout for synchronous LLM generation + web search endpoint
  return apiRequest<Idea>(
    "/api/ideas/",
    {
      method: "POST",
      body: JSON.stringify({ input_text }),
    },
    45000
  )
}

export async function getIdeas() {
  return apiRequest<Idea[]>("/api/ideas/list/", { method: "GET" })
}

export async function getIdea(id: number | string) {
  return apiRequest<Idea>(`/api/ideas/${id}/`, { method: "GET" })
}
