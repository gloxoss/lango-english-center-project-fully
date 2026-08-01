import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { checkLockout, clearFailedLogins, recordFailedLogin } from '@/libs/auth/lockout';
import { db } from '@/libs/DB';
import { serverEnv } from '@/libs/env/server';
import * as schema from '@/models/Schema';

const SIGN_IN_PATH = '/sign-in/email';

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
  emailAndPassword: {
    enabled: true,
    // School accounts are provisioned by an authorized administrator. Public
    // sign-up would let users bypass tenant onboarding and role assignment.
    disableSignUp: true,
  },
  hooks: {
    // Closes the long-standing gap where user.failedLoginCount / lockedUntil
    // existed and could be cleared by an admin, but nothing ever set them.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) {
        return;
      }
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (!email) {
        return;
      }
      const minutes = await checkLockout(email);
      if (minutes > 0) {
        throw new APIError('TOO_MANY_REQUESTS', {
          code: 'ACCOUNT_LOCKED',
          message: `Compte verrouillé après trop de tentatives. Réessayez dans ${minutes} minute(s).`,
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) {
        return;
      }
      const userId = ctx.context.newSession?.user?.id;
      if (userId) {
        await clearFailedLogins(userId);
        return;
      }
      // No session created => the attempt failed. Count it against the email.
      // Unknown emails simply update 0 rows, so this leaks no account existence.
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (email) {
        await recordFailedLogin(email);
      }
    }),
  },
  plugins: [twoFactor(), nextCookies()],
});
