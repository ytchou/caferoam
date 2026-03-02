import { BACKEND_URL } from '@/lib/api/proxy';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get('Authorization');

  // Reject oversized requests early via Content-Length header before buffering
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
    return Response.json(
      { detail: 'File exceeds 10MB limit' },
      { status: 413 }
    );
  }

  // Buffer the body and double-check the actual size
  const bodyBuffer = await request.arrayBuffer();
  if (bodyBuffer.byteLength > MAX_FILE_SIZE) {
    return Response.json(
      { detail: 'File exceeds 10MB limit' },
      { status: 413 }
    );
  }

  const contentType = request.headers.get('Content-Type');
  const headers: HeadersInit = {};

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  // Forward Content-Type as-is so the boundary parameter reaches the backend
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  const res = await fetch(`${BACKEND_URL}/admin/shops/import/google-takeout`, {
    method: 'POST',
    headers,
    body: bodyBuffer,
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
}
