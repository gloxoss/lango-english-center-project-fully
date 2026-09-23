import { APIError } from 'better-auth/api';
import { ResendEmailProvider } from '@/features/broadcast/providers/resend-email-provider';

// Delivery for 2FA email codes. Real email through Resend when the platform key
// is configured; otherwise production refuses clearly (the user still has the
// authenticator app and backup codes) instead of pretending a code was sent.

export function isOtpEmailConfigured(): boolean {
  return Boolean(process.env.PLATFORM_RESEND_API_KEY || process.env.RESEND_API_KEY);
}

export async function deliverOtpEmail(to: string, otp: string): Promise<'sent' | 'log_only'> {
  const apiKey = process.env.PLATFORM_RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new APIError('SERVICE_UNAVAILABLE', {
        message: 'L\'envoi du code par email n\'est pas configuré. Utilisez votre application d\'authentification ou un code de secours.',
      });
    }
    return 'log_only';
  }

  const result = await new ResendEmailProvider().send({
    channel: 'email',
    to,
    subject: 'Votre code de connexion SchoolOS',
    bodyText: `Votre code de vérification SchoolOS est : ${otp}\nIl expire dans 3 minutes. Si vous n'avez pas demandé ce code, ignorez ce message.`,
    config: { apiKey, fromAddress: process.env.PLATFORM_EMAIL_FROM || undefined },
  });
  if (!result.ok) {
    throw new APIError('SERVICE_UNAVAILABLE', {
      message: 'Le code n\'a pas pu être envoyé par email. Réessayez ou utilisez votre application d\'authentification.',
    });
  }
  return 'sent';
}
