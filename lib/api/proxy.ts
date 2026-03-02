// Exported for file-upload proxies (e.g. google-takeout) that cannot use proxyToBackend
// because they need to buffer and size-check multipart bodies before forwarding.
export const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000';

export async function proxyToBackend(
  request: Request,
  path: string
): Promise<Response> {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${path}${url.search}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const res = await fetch(backendUrl, init);
  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
}
