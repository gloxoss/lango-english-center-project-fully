import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { enforceEmailPasswordLockout, trackEmailPasswordResult } from '@/libs/auth/lockout';
import { captureSignInLoginEvent } from '@/features/settings/services/login-events-service';
import { scopeSignInToTenant } from '@/libs/auth/tenant-scope';
import { listApprovedDomains } from '@/features/platform/services/domains-service';
import { db } from '@/libs/DB';
import { serverEnv } from '@/libs/env/server';
import * as schema from '@/models/Schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'student',
        input: false,
      },
      tenantId: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  secret: serverEnv.BETTER_AUTH_SECRET,
  baseURL: serverEnv.BETTER_AUTH_URL,
  // A branded custom domain (e.g. atlas.schoolos.ma) must be a trusted origin,
  // otherwise better-auth rejects the sign-in POST with INVALID_ORIGIN before
  // any hook runs. Loaded from approved tenant_domains rows; on a DB error we
  // fail open to the base URL alone (branded sign-in degrades to the default,
  // but the platform login keeps working).
  trustedOrigins: async () => {
    try {
      const domains = await listApprovedDomains();
      return domains.flatMap((d) => [`http://${d}`, `https://${d}`]);
    } catch (error) {
      console.error('Failed to load tenant domains for trustedOrigins:', error);
      return [];
    }
  },
  emailAndPassword: {
    enabled: true,
    // School accounts are provisioned by an authorized administrator. Public
    // sign-up would let users bypass tenant onboarding and role assignment.
    disableSignUp: true,
  },
  // Per-account brute-force protection is already handled by lockout.ts
  // (failedLoginCount / lockedUntil), so the IP-keyed limiter below only needs
  // to blunt floods. Better Auth's default special rule is 3 requests / 10s on
  // /sign-in — keyed by IP, which falsely locks out a school office where
  // several staff share one public IP. Raise it; a single account is still
  // locked out by lockout.ts, not by this limiter.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 30 },
    },
  },
  hooks: {
    // Closes the long-standing gap where user.failedLoginCount / lockedUntil
    // existed and could be cleared by an admin, but nothing ever set them.
    before: createAuthMiddleware(async (ctx) => {
      await enforceEmailPasswordLockout(ctx);
      await scopeSignInToTenant(ctx);
    }),
    after: createAuthMiddleware(async (ctx) => {
      await trackEmailPasswordResult(ctx);
      await captureSignInLoginEvent(ctx);
    }),
  },
  plugins: [
    twoFactor({
      otpOptions: {
        // Log-only email delivery (no SMTP gateway, same convention as SMS).
        // Records the code so the verify script can prove delivery and complete
        // a login with the emailed code. Replace with a real email provider in
        // production; do NOT keep writing plaintext OTPs to disk there.
        sendOTP: async ({ user, otp }) => {
          const tenantId = (user as { tenantId?: string | null }).tenantId ?? null;
          console.log(`[2FA OTP] user=${user.id} email=${user.email} code=${otp}`);
          await db
            .insert(schema.twoFactorOtps)
            .values({
              userId: user.id,
              tenantId,
              email: user.email,
              otp,
              expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
            })
            .onConflictDoNothing();
        },
      },
    }),
    nextCookies(),
  ],
});
