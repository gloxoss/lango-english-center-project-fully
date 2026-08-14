import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    await requireCapability(context, 'settings.read');
    requireTenant(context);

    const csvContent = [
      'Nom complet,Date naissance,Téléphone tuteur,Classe,Solde initial',
      'Yassine Alami,2014-05-12,+212661234567,CM2-A,0.00',
      'Salma Benkirane,2015-08-20,+212662345678,CM1-B,0.00',
      'Omar Bennani,2013-11-03,+212663456789,6EME-1,0.00',
    ].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="SchoolOS_Modele_Migration.csv"',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
