import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getPortalManifest } from '@/libs/api/portal-manifest';

// GET /api/portal/manifest — returns navigation, quick actions, and widgets
// filtered by the authenticated user's permissions.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const manifest = await getPortalManifest(context);

    return NextResponse.json({ success: true, data: manifest });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
