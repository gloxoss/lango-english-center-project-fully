import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { getTheme, upsertTheme } from '@/features/website/services/website-service';

const hexColor = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hexadécimale attendue (#RRGGBB)');
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const themeUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  siteTitle: z.string().trim().max(255).optional(),
  address: optionalText(2000),
  phone: optionalText(50),
  email: z.email().max(255).optional().nullable(),
  workingHours: optionalText(255),
  footerAboutText: optionalText(2000),
  copyrightText: optionalText(500),
  socialFacebook: optionalText(500),
  socialTwitter: optionalText(500),
  socialYoutube: optionalText(500),
  socialLinkedin: optionalText(500),
  socialInstagram: optionalText(500),
  socialPinterest: optionalText(500),
  colorPrimary: hexColor.optional(),
  colorMenuBackground: hexColor.optional(),
  colorButtonHover: hexColor.optional(),
  colorText: hexColor.optional(),
  colorTextSecondary: hexColor.optional(),
  colorFooterBackground: hexColor.optional(),
  colorFooterText: hexColor.optional(),
  colorCopyrightBackground: hexColor.optional(),
  colorCopyrightText: hexColor.optional(),
  borderRadius: z.number().int().min(0).max(48).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.read');

    const theme = await getTheme(tenantId);
    return NextResponse.json({ success: true, data: theme });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'school-website-cms');
    await requireCapability(context, 'website.theme.manage');

    const body = await parseJson(request, themeUpdateSchema);
    const theme = await upsertTheme(tenantId, body);

    return NextResponse.json({ success: true, data: theme });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
