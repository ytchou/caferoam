import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api/proxy';

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/admin/shops');
}

export async function POST(request: NextRequest) {
  return proxyToBackend(request, '/admin/shops');
}
