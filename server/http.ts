/**
 * Conversion between Node.js IncomingMessage/ServerResponse and the standard
 * fetch Request/Response types, so the Node adapter can consume the same
 * shared auth-core service as the Cloudflare worker.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

/** Reads the full request body as a Uint8Array (bounded to avoid abuse). */
export function readRequestBody(request: IncomingMessage, maxBytes = 64 * 1024): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    request.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Request body too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    request.on("error", reject);
  });
}

/** Builds a standard Request from a Node request. */
export async function toFetchRequest(
  request: IncomingMessage,
  response: ServerResponse,
  bodyAllowed: boolean,
): Promise<Request> {
  const protocol = request.headers["x-forwarded-proto"]?.toString().split(",")[0]?.trim() ?? "http";
  const host = request.headers.host ?? `localhost:${response.socket?.localPort ?? 8080}`;
  const rawUrl = request.url ?? "/";
  const url = `${protocol}://${host}${rawUrl}`;

  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.set(name, value);
    }
  }
  // Expose the peer address so the shared auth service can rate limit by IP
  // even when no proxy headers are present.
  const peer = request.socket.remoteAddress ?? "unknown";
  if (!headers.has("x-forwarded-for") && !headers.has("cf-connecting-ip")) {
    headers.set("x-real-ip", peer);
  }

  const method = request.method ?? "GET";
  const hasBody = bodyAllowed && method !== "GET" && method !== "HEAD";
  const body = hasBody ? await readRequestBody(request) : undefined;

  return new Request(url, {
    method,
    headers,
    body,
    // Node fetch requires duplex: "half" when a body stream is present; we
    // always pass a fully buffered body.
  });
}

/** Writes a standard Response onto a Node ServerResponse. */
export async function writeFetchResponse(response: Response, serverResponse: ServerResponse): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    // Set-Cookie is handled separately (see below); forEach collapses
    // multiple Set-Cookie headers into one comma-joined value.
    if (name.toLowerCase() === "set-cookie") return;
    headers[name] = value;
  });
  // getSetCookie is available on Headers in Node 20+ and preserves multiple
  // Set-Cookie headers.
  const setCookies = response.headers.getSetCookie?.() ?? [];
  // IMPORTANT: setHeader must run BEFORE writeHead — writeHead flushes the
  // header block, and setHeader afterwards throws ERR_HTTP_HEADERS_SENT.
  if (setCookies.length > 0) {
    serverResponse.setHeader("set-cookie", setCookies);
  }
  serverResponse.writeHead(response.status, headers);

  if (response.body === null) {
    serverResponse.end();
    return;
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  serverResponse.end(Buffer.from(buffer));
}
