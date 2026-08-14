import { db } from '@/libs/DB';
import { SerialService } from './serial-service';
import { evaluateRule } from './evaluators';
import {
  issuedCertificates,
  certificateRequests,
  certificateDefinitionVersions,
} from '@/features/certificates/models/certificates-schema';
import { eq, and } from 'drizzle-orm';

export class CertificateService {
  /**
   * Evaluates eligibility and issues a real certificate.
   */
  static async issueCertificate(params: {
    tenantId: string;
    definitionId: string;
    versionId: string;
    recipientId: string;
    issuedBy: string;
    ruleType: string;
    ruleParams: Record<string, any>;
  }): Promise<{ success: boolean; certificateId?: string; reason?: string; token?: string }> {
    const { tenantId, definitionId, versionId, recipientId, issuedBy, ruleType, ruleParams } = params;

    // 1. Evaluate Eligibility (Pure function, gets snapshot)
    const evaluation = await evaluateRule(tenantId, recipientId, ruleType, ruleParams);
    
    if (!evaluation.eligible) {
      return { success: false, reason: evaluation.reason };
    }

    // 2. Issue inside a transaction (with retry for serial concurrency)
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        return await db.transaction(async (tx) => {
          // Re-verify definition version exists and belongs to tenant
          const version = await tx.select()
            .from(certificateDefinitionVersions)
            .where(
              and(
                eq(certificateDefinitionVersions.tenantId, tenantId),
                eq(certificateDefinitionVersions.id, versionId)
              )
            )
            .limit(1);
            
          if (version.length === 0) {
            throw new Error('Version de définition invalide ou introuvable');
          }

          // Generate transaction-safe serial and verification token
          const serialNumber = await SerialService.generateSerial(tx, tenantId);
          const { token, hash } = await SerialService.generateVerificationToken();

          const [newCertificate] = await tx.insert(issuedCertificates).values({
            tenantId,
            definitionId,
            versionId,
            recipientId,
            serialNumber,
            verificationTokenHash: hash,
            fileExt: 'pdf',
            status: 'valid',
            evidenceSnapshot: evaluation.evidenceSnapshot,
            issuedBy,
          }).returning();

          if (!newCertificate) {
            throw new Error('Erreur lors de la création du certificat');
          }

          // In a real implementation, we would return the raw `token` here 
          // so the caller can embed it in a QR code.
          return { success: true, certificateId: newCertificate.id, token };
        });
      } catch (error: any) {
        // Postgres unique violation on our specific serial index
        if (error.code === '23505' && error.constraint === 'issued_certificates_tenant_serial_idx') {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error('Le système est trop occupé pour générer un numéro de série unique. Veuillez réessayer.');
          }
          // Loop continues and retries the transaction
        } else {
          throw error;
        }
      }
    }

    return { success: false, reason: 'Erreur inattendue' };
  }
}
