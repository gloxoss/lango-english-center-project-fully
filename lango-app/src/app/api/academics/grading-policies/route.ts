import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  getEffectiveValue,
  setSettingValue,
} from '@/libs/settings/registry';

// Grading policy persistence (audit 2026-09-22, P0-3).
//
// The policy page used to write passingScore/eliminatoryScore/weights to
// localStorage and claim success — per-browser values that never reached
// report cards or promotions. The policy now lives in the versioned tenant
// settings registry:
//   academic.passThreshold       — admission threshold (promotions + report cards read it)
//   academic.eliminatoryScore    — eliminatory subject mark
//   academic.evaluationWeights   — official evaluation weighting (sums to 100)
// so every consumer reads one server-side source of truth.

const evaluationRuleSchema = z.object({
  name: z.string().min(1).max(120),
  weight: z.number().min(0).max(100),
  description: z.string().max(255).optional(),
}).strict();

const savePolicySchema = z.object({
  passingScore: z.number().min(0).max(20),
  eliminatoryScore: z.number().min(0).max(20),
  rules: z.array(evaluationRuleSchema).max(20),
  reason: z.string().max(255).optional(),
}).strict();

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.organization.manage');

    const [passThreshold, eliminatoryScore, evaluationWeights, gradingScale] = await Promise.all([
      getEffectiveValue(tenantId, null, 'academic.passThreshold'),
      getEffectiveValue(tenantId, null, 'academic.eliminatoryScore'),
      getEffectiveValue(tenantId, null, 'academic.evaluationWeights'),
      getEffectiveValue(tenantId, null, 'academic.gradingScale'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        passingScore: asNumber(passThreshold.value, 10),
        eliminatoryScore: asNumber(eliminatoryScore.value, 5),
        rules: Array.isArray(evaluationWeights.value) ? evaluationWeights.value : [],
        gradingScale: gradingScale.value === '100' ? '100' : '20',
        version: passThreshold.version,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.organization.manage');
    const body = await parseJson(request, savePolicySchema);

    const totalWeight = body.rules.reduce((sum, r) => sum + r.weight, 0);
    if (Math.round(totalWeight) !== 100) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_WEIGHTS',
          message: `La pondération totale doit être égale à 100% (actuellement ${Math.round(totalWeight * 100) / 100}%).`,
        },
      }, { status: 422 });
    }
    if (body.eliminatoryScore >= body.passingScore) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_THRESHOLDS',
          message: 'La note éliminatoire doit être inférieure au seuil d\'admission.',
        },
      }, { status: 422 });
    }

    const [passThreshold, scale] = await Promise.all([
      getEffectiveValue(tenantId, null, 'academic.passThreshold'),
      getEffectiveValue(tenantId, null, 'academic.gradingScale'),
    ]);

    // Keep the existing CAS version of academic.passThreshold: the value row
    // is shared with the promotions engine, so its version history stays linear.
    await setSettingValue(tenantId, null, 'academic.passThreshold', body.passingScore, context, body.reason, passThreshold.version);
    await setSettingValue(tenantId, null, 'academic.eliminatoryScore', body.eliminatoryScore, context, body.reason);
    await setSettingValue(tenantId, null, 'academic.evaluationWeights', body.rules, context, body.reason);

    recordAudit(context, 'settings_change', 'grading_policy', tenantId, {
      passingScore: body.passingScore,
      eliminatoryScore: body.eliminatoryScore,
      ruleCount: body.rules.length,
      totalWeight,
      gradingScale: scale.value,
      reason: body.reason ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        passingScore: body.passingScore,
        eliminatoryScore: body.eliminatoryScore,
        rules: body.rules,
      },
      message: 'Barème et seuils enregistrés sur le serveur.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
