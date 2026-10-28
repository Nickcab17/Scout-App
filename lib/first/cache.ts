
type Cached = { payload: unknown; lastModified: string | null; syncedAt: string; stored: boolean; stale?: boolean; warning?: string };
type CacheState = Map<string, Cached>;
const globalCache = globalThis as typeof globalThis & { __biobuzzFirstCache?: CacheState };
const memory = globalCache.__biobuzzFirstCache ?? (globalCache.__biobuzzFirstCache = new Map());

export function firstCredentials() {
  const username = process.env.FTC_EVENTS_USERNAME;
  const authorizationKey = process.env.FTC_EVENTS_AUTHORIZATION_KEY;
  return username && authorizationKey ? { username, authorizationKey } : null;
}

export class FirstApiError extends Error {
  readonly status: number;
  readonly retryAfter?: string;
  readonly upstreamStatus?: number;
  readonly upstreamIssue?: string;

  constructor(message: string, status: number, retryAfter?: string, upstreamStatus?: number, upstreamIssue?: string) {
    super(message);
    this.name = "FirstApiError";
    this.status = status;
    this.retryAfter = retryAfter;
    this.upstreamStatus = upstreamStatus;
    this.upstreamIssue = upstreamIssue;
  }
}

export async function getFirstJson(options: {
  key: string; season: number; eventCode?: string; level?: string; url: string; refresh: boolean;
}): Promise<Cached> {
  const previous = memory.get(options.key);
  if (previous) memory.set(options.key, previous);
  const credentials = firstCredentials();
  if (!credentials) {
    if (previous) return { ...previous, stale: true, warning: "FTC Events no está configurado. Se muestra la última descarga correcta; solicita acceso y configura las credenciales en el servidor." };
    throw new FirstApiError("FTC Events no está configurado. Solicita acceso en ftc-events.firstinspires.org/services/API/register y define FTC_EVENTS_USERNAME y FTC_EVENTS_AUTHORIZATION_KEY en el servidor.", 503);
  }
  const age = previous ? Date.now() - Date.parse(previous.syncedAt) : Infinity;
  if (previous && !options.refresh && age < 60_000) return previous;

  const headers = new Headers({
    Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.authorizationKey}`).toString("base64")}`,
    Accept: "application/json",
  });
  if (previous?.lastModified) headers.set("If-Modified-Since", previous.lastModified);
  let response: Response;
  try {
    response = await fetch(options.url, { headers, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  } catch {
    if (previous) return { ...previous, stale: true, warning: "No se pudo conectar con FIRST. Se muestra la última descarga correcta; la actualización falló." };
    throw new FirstApiError("No se pudo conectar con FIRST. Se conserva la última descarga correcta.", 504);
  }
  if (response.status === 304 && previous) {
    const now = new Date().toISOString();
    const value = { ...previous, syncedAt: now };
    value.stored = false;
    memory.set(options.key, value);
    return value;
  }
  if (response.status === 401 || response.status === 403) {
    if (previous) return { ...previous, stale: true, warning: "FIRST rechazó las credenciales. Se muestra la última descarga correcta; revisa FTC_EVENTS_USERNAME y FTC_EVENTS_AUTHORIZATION_KEY." };
    throw new FirstApiError("FIRST rechazó las credenciales configuradas. Revisa el usuario y token de FTC Events.", 502);
  }
  if (response.status === 429) {
    if (previous) return { ...previous, stale: true, warning: "FIRST limitó temporalmente las solicitudes. Se muestra la última descarga correcta." };
    throw new FirstApiError("FIRST limitó temporalmente las solicitudes. Intenta de nuevo más tarde.", 429, response.headers.get("retry-after") ?? undefined);
  }
  if (!response.ok) {
    if (response.status === 404) throw new FirstApiError("FIRST no encontró ese evento para la temporada seleccionada.", 404);
    if (response.status >= 500 && previous) return { ...previous, stale: true, warning: "FTC Events no está disponible. Se muestra la última descarga correcta; no se pudo actualizar." };
    if (response.status >= 500) throw new FirstApiError("FTC Events no está disponible en este momento. Se conserva la última descarga correcta.", 502);
    const errorBody = (await response.text().catch(() => "")).toLowerCase();
    const upstreamIssue = errorBody.includes("invalid season") ? "invalid_season"
      : errorBody.includes("malformed parameter") ? "malformed_parameter"
      : errorBody.includes("missing parameter") ? "missing_parameter"
      : errorBody.includes("invalid api version") ? "invalid_api_version"
      : response.status === 400 ? "bad_request" : "upstream_error";
    throw new FirstApiError("FIRST rechazó la consulta solicitada.", 502, undefined, response.status, upstreamIssue);
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch {
    if (previous) return { ...previous, stale: true, warning: "FIRST devolvió una respuesta no válida. Se muestra la última descarga correcta; la actualización falló." };
    throw new FirstApiError("FIRST devolvió una respuesta que no se pudo interpretar. Se conserva la última descarga correcta.", 502);
  }
  const value: Cached = {
    payload, lastModified: response.headers.get("last-modified"), syncedAt: new Date().toISOString(), stored: false,
  };
  value.stored = false;
  memory.set(options.key, value);
  return value;
}
