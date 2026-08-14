import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { consumeDocumentNumber } from '@/libs/finance/document-number';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { moneyInput } from '@/libs/finance/validation';
import { classes, classSections, guardians, guardianStudents, invoiceEvents, invoiceItems, invoices, payments, sections, user } from '@/models/Schema';

const createInvoiceSchema = z.object({
  studentId: z.string().min(1),
  amount: moneyInput,
  discountAmount: z.number().min(0).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  note: z.string().trim().max(500).optional(),
}).strict();

// overdue is derived at read time (never stored): an unpaid/partially-paid
// invoice whose due date has passed reads as overdue.
function deriveEffectiveStatus(status: string, dueDate: string, paidAmount: number, netAmount: number): string {
  const today = new Date().toISOString().slice(0, 10);
  if ((status === 'pending' || status === 'partial') && dueDate < today && paidAmount < netAmount) {
    return 'overdue';
  }
  return status;
}

async function getInvoiceDetail(tenantId: string, id: string) {
  const [row] = await db
    .select({
      invoice: invoices,
      studentName: user.name,
      studentPhone: user.phone,
      studentEmail: user.email,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(invoices)
    .innerJoin(user, eq(invoices.studentId, user.id))
    .leftJoin(classSections, eq(user.classSectionId, classSections.id))
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    return null;
  }

  const [items, paymentRows, guardianRows] = await Promise.all([
    db.select().from(invoiceItems).where(and(eq(invoiceItems.invoiceId, id), eq(invoiceItems.tenantId, tenantId))),
    db.select().from(payments).where(and(eq(payments.invoiceId, id), eq(payments.tenantId, tenantId))).orderBy(desc(payments.paymentDate)),
    db
      .select({ firstName: guardians.firstName, lastName: guardians.lastName, phone: guardians.phone, email: guardians.email, relationshipType: guardianStudents.relationshipType })
      .from(guardianStudents)
      .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
      .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, row.invoice.studentId))),
  ]);

  return {
    ...row.invoice,
    effectiveStatus: deriveEffectiveStatus(row.invoice.status, row.invoice.dueDate, row.invoice.paidAmount, row.invoice.netAmount),
    studentName: row.studentName,
    studentPhone: row.studentPhone,
    studentEmail: row.studentEmail,
    className: row.className ? `${row.className}${row.sectionName ? ` ${row.sectionName}` : ''}` : null,
    items,
    payments: paymentRows,
    guardian: guardianRows[0] ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { searchParams } = new URL(request.url);

    const id = searchParams.get('id');
    if (id) {
      const detail = await getInvoiceDetail(tenantId, id);
      if (!detail) {
        return NextResponse.json({ success: false, message: 'Facture non trouvée' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const studentId = searchParams.get('studentId');

    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        studentId: invoices.studentId,
        studentName: user.name,
        className: classes.name,
        sectionName: sections.name,
        amount: invoices.amount,
        discountAmount: invoices.discountAmount,
        netAmount: invoices.netAmount,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
        dueDate: invoices.dueDate,
        issueDate: invoices.issueDate,
        note: invoices.note,
      })
      .from(invoices)
      .innerJoin(user, eq(invoices.studentId, user.id))
      .leftJoin(classSections, eq(user.classSectionId, classSections.id))
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .where(studentId ? and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId)) : eq(invoices.tenantId, tenantId));

    // One extra query to resolve a primary-guardian display name per student,
    // same "resolve names in one extra query, not N+1" pattern as
    // /api/dashboard/summary.
    const studentIds = [...new Set(rows.map(r => r.studentId))];
    const guardianByStudent = new Map<string, string>();
    if (studentIds.length > 0) {
      const guardianRows = await db
        .select({
          studentId: guardianStudents.studentId,
          firstName: guardians.firstName,
          lastName: guardians.lastName,
          isPrimaryContact: guardianStudents.isPrimaryContact,
        })
        .from(guardianStudents)
        .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
        .where(and(eq(guardianStudents.tenantId, tenantId), inArray(guardianStudents.studentId, studentIds)));

      for (const g of guardianRows) {
        const existing = guardianByStudent.has(g.studentId);
        if (!existing || g.isPrimaryContact) {
          guardianByStudent.set(g.studentId, `${g.firstName} ${g.lastName}`.trim());
        }
      }
    }

    const data = rows.map(r => ({
      ...r,
      effectiveStatus: deriveEffectiveStatus(r.status, r.dueDate, r.paidAmount, r.netAmount),
      className: r.className ? `${r.className}${r.sectionName ? ` ${r.sectionName}` : ''}` : null,
      guardianName: guardianByStudent.get(r.studentId) ?? null,
    }));

    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, createInvoiceSchema);

    // Verify student belongs to tenant
    const [student] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas.');
    }

    // Money in BigInt cents — no float arithmetic ever reaches the ledger.
    const amountCents = moneyToCents(body.amount);
    const discountCents = body.discountAmount ? moneyToCents(String(body.discountAmount)) : BigInt(0);
    if (discountCents > amountCents) {
      throw new ApiError(400, 'DISCOUNT_EXCEEDS_AMOUNT', 'La remise ne peut pas dépasser le montant de la facture.');
    }
    const netAmountCents = amountCents - discountCents;

    // Number + insert + event ledger are one atomic transaction.
    const { number: invoiceNumber, invoice } = await db.transaction(async (tx) => {
      const number = await consumeDocumentNumber(tx, { tenantId, prefix: `INV-${new Date().getFullYear()}-` });
      const [created] = await tx
        .insert(invoices)
        .values({
          tenantId,
          studentId: body.studentId,
          invoiceNumber: number,
          amount: Number(centsToMoney(amountCents)),
          discountAmount: Number(centsToMoney(discountCents)),
          netAmount: Number(centsToMoney(netAmountCents)),
          paidAmount: 0,
          status: 'pending',
          dueDate: body.dueDate,
          note: body.note || null,
        })
        .returning();
      if (!created) {
        throw new ApiError(500, 'INVOICE_INSERT_FAILED', 'Facture non enregistrée.');
      }
      await tx.insert(invoiceEvents).values({
        tenantId,
        invoiceId: created.id,
        eventType: 'created',
        payload: {
          invoiceNumber: number,
          amountCents: amountCents.toString(),
          discountCents: discountCents.toString(),
          netAmountCents: netAmountCents.toString(),
        },
        actorUserId: context.userId,
      });
      return { number, invoice: created };
    });

    recordAudit(context, 'create', 'invoice', invoice.id);

    return NextResponse.json({
      success: true,
      data: invoice,
      message: `Facture N° ${invoiceNumber} créée avec succès pour ${student.name}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
