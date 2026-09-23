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

  static async seedDefaultTemplates(tenantId: string, createdById: string) {
    const defaultTemplates = [
      {
        title: "Compréhension de l'Écrit & Analyse Textuelle",
        content: "1. Quel est le thème principal et la thèse développée par l'auteur dans le document joint ?\n2. Relevez dans le texte trois arguments et leurs exemples respectifs.\n3. Expliquez le sens des expressions soulignées selon le contexte.\n4. Rédigez un paragraphe synthétique résumant la conclusion de l'auteur.",
        tags: ['Compréhension', 'Lecture', 'Analyse'],
      },
      {
        title: 'Production Écrite - Essai Argumentatif Structuré',
        content: "Rédigez un essai argumentatif structuré de 200 à 250 mots sur la thématique étudiée en cours.\nVotre devoir doit obligatoirement comporter :\n- Une introduction avec accroche, définition du sujet et problématique\n- Un développement en 2 parties avec connecteurs logiques, arguments et exemples concrets\n- Une conclusion synthétique avec ouverture du sujet.",
        tags: ['Production Écrite', 'Essai', 'Argumentation'],
      },
      {
        title: 'Exercice de Grammaire, Conjugaison & Syntaxe',
        content: "1. Conjuguez les verbes entre parenthèses aux temps appropriés (Passé Composé, Imparfait, Subjonctif).\n2. Transformez les phrases actives données à la voix passive en veillant aux accords.\n3. Accordez correctement les participes passés et expliquez la règle grammaticale appliquée.",
        tags: ['Grammaire', 'Conjugaison', 'Syntaxe'],
      },
      {
        title: 'Vocabulaire, Lexique & Expressions en Contexte',
        content: "1. Donnez la définition et au moins un antonyme et un synonyme pour chaque mot de la liste.\n2. Réemployez chaque terme dans une phrase originale et signifiante illustrant son sens exact.\n3. Identifiez les familles de mots dérivées pour les trois premiers termes.",
        tags: ['Vocabulaire', 'Lexique', 'Pratique'],
      },
      {
        title: 'Devoir de Synthèse & Contrôle Continu',
        content: "Devoir complet d'évaluation continue : prenez connaissance de l'énoncé joint (document PDF/Word) et traitez l'ensemble des parties (Compréhension, Analyse de la langue, et Expression écrite) en respectant le temps imparti.",
        tags: ['Contrôle Continu', 'Synthèse', 'Évaluation'],
      },
    ];

    const inserted = [];
    for (const tpl of defaultTemplates) {
      const [row] = await db
        .insert(teacherQuestionBankItems)
        .values({
          tenantId,
          createdById,
          title: tpl.title,
          content: tpl.content,
          tags: tpl.tags,
        })
        .returning();
      if (row) inserted.push(row);
    }
    return inserted;
  }
}
