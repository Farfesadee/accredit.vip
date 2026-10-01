export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

function extractValidationMessage(err: { detail?: unknown }): string | null {
  if (Array.isArray(err.detail)) {
    const parts = err.detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const e = item as { loc?: unknown[]; msg?: string; type?: string };
        if (!e.msg) return null;
        if (e.type === "extra_forbidden") return null;
        return e.msg;
      })
      .filter((m): m is string => Boolean(m));
    if (parts.length > 0) {
      const unique = [...new Set(parts)];
      return unique.length === 1 ? unique[0] : unique.join(". ");
    }
  }
  return null;
}

export async function apiClient<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };

  const token = typeof window !== "undefined" ? sessionStorage.getItem("accreditation_token") : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method: opts.method || "GET",
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("The request took too long. Your action may have gone through — please check before trying again.");
      }
      throw new Error("Unable to reach the server. Please check your connection and try again.");
    }

    if (res.status === 401) {
      if (onUnauthorized) onUnauthorized();
      const errBody = await res.json().catch(() => ({ detail: "Session expired" }));
      throw new Error(typeof errBody.detail === "string" ? errBody.detail : "Session expired");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail =
        typeof err.detail === "string"
          ? err.detail
          : err.detail?.message || extractValidationMessage(err) || "Request failed";
      throw new Error(detail);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}
