import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { teacherQuestionBankItems } from '../models/assessment-schema';

// Teacher question bank — reusable question/instruction snippets a teacher
// stores and picks into the "Créer un Devoir" dialog. Distinct from the retired
// Academics question bank. Tenant-isolated; created_by_id records attribution.
export class TeacherQuestionBankService {
  static async list(tenantId: string) {
    return db
      .select()
      .from(teacherQuestionBankItems)
      .where(eq(teacherQuestionBankItems.tenantId, tenantId))
      .orderBy(desc(teacherQuestionBankItems.createdAt));
  }

  static async create(params: {
    tenantId: string;
    createdById: string;
    title: string;
    content?: string;
    attachmentUrl?: string;
    tags?: string[];
  }) {
    const [row] = await db
      .insert(teacherQuestionBankItems)
      .values({
        tenantId: params.tenantId,
        createdById: params.createdById,
        title: params.title,
        content: params.content,
        attachmentUrl: params.attachmentUrl,
        tags: params.tags ?? [],
      })
      .returning();

    if (!row) throw new Error('Failed to create question bank item.');
    return row;
  }

  static async update(params: {
    tenantId: string;
    itemId: string;
    title?: string;
    content?: string;
    attachmentUrl?: string;
    tags?: string[];
  }) {
    const [row] = await db
      .update(teacherQuestionBankItems)
      .set({
        ...(params.title !== undefined ? { title: params.title } : {}),
        ...(params.content !== undefined ? { content: params.content } : {}),
        ...(params.attachmentUrl !== undefined ? { attachmentUrl: params.attachmentUrl } : {}),
        ...(params.tags !== undefined ? { tags: params.tags } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(teacherQuestionBankItems.id, params.itemId),
          eq(teacherQuestionBankItems.tenantId, params.tenantId),
        ),
      )
      .returning();

    if (!row) throw new Error('Question bank item not found.');
    return row;
  }

  static async remove(params: { tenantId: string; itemId: string }) {
    const [row] = await db
      .delete(teacherQuestionBankItems)
      .where(
        and(
          eq(teacherQuestionBankItems.id, params.itemId),
          eq(teacherQuestionBankItems.tenantId, params.tenantId),
        ),
      )
      .returning();

    if (!row) throw new Error('Question bank item not found.');
    return row;
  }
}
