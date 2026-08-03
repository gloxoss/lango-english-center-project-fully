import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
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
      { success: false, error: { code: error.code, message: error.message } },
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
      return NextResponse.json(
        { success: false, error: { code: 'IN_USE', message: 'Cet enregistrement est référencé ailleurs et ne peut pas être supprimé ou modifié ainsi.' } },
        { status: 409 },
      );
    }
  }

  console.error('Unhandled API error', error);
  return NextResponse.json(
    {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' },
    },
    { status: 500 },
  );
}
