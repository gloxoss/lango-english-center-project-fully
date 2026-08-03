import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { enforceEmailPasswordLockout, trackEmailPasswordResult } from '@/libs/auth/lockout';
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
      await enforceEmailPasswordLockout(ctx);
    }),
    after: createAuthMiddleware(async (ctx) => {
      await trackEmailPasswordResult(ctx);
    }),
  },
  plugins: [twoFactor(), nextCookies()],
});
