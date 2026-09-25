import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/libs/logger';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function pgErrorCode(error: unknown): string | undefined {
  for (const candidate of [error, (error as { cause?: unknown } | null)?.cause]) {
    if (typeof candidate === 'object' && candidate !== null && 'code' in candidate && typeof (candidate as { code: unknown }).code === 'string') {
      return (candidate as { code: string }).code;
    }
  }
  return undefined;
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError || (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ZodError')) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Données invalides', details: (error as ZodError).issues } },
      { status: 400 },
    );
  }

  const code = pgErrorCode(error);
  if (code) {
    if (code === '23505') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_EXISTS', message: 'Un enregistrement identique existe déjà.' } },
        { status: 409 },
      );
    }
    if (code === '23503') {
      logger.warn({ err: error }, 'PostgreSQL 23503 foreign key violation');
      return NextResponse.json(
        { success: false, error: { code: 'IN_USE', message: 'Cet enregistrement est référencé ailleurs et ne peut pas être supprimé ou modifié ainsi.' } },
        { status: 409 },
      );
    }
    if (code === '23514') {
      // Check constraints and finance integrity triggers (refund/credit-note caps,
      // cross-tenant links) raise 23514. It is a refused operation, not a crash,
      // so it must not surface as "internal error".
      logger.warn({ err: error }, 'PostgreSQL 23514 check violation');
      return NextResponse.json(
        { success: false, error: { code: 'INTEGRITY_RULE', message: 'Opération refusée : elle enfreint une règle d’intégrité (montant ou lien incohérent).' } },
        { status: 422 },
      );
    }
    if (code === '23P01') {
      logger.warn({ err: error }, 'PostgreSQL 23P01 exclusion violation');
      return NextResponse.json(
        { success: false, error: { code: 'SCHEDULE_CONFLICT', message: 'Créneau déjà occupé : ce professeur ou cette classe a déjà un cours à cette heure.' } },
        { status: 409 },
      );
    }
  }

  logger.error({ err: error }, 'Unhandled API error');
  return NextResponse.json(
    {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' },
    },
    { status: 500 },
  );
}
