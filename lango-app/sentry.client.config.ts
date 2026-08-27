import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: false,
    environment: process.env.NODE_ENV || 'development',

    // CNDP / Law 09-08 Moroccan Privacy Compliance: PII Scrubbing
    beforeSend(event) {
      if (event.user) {
        // Strip student/guardian PII, keep only non-identifying technical id
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }

      if (event.request) {
        // Scrub request headers containing authorization or cookies
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
          delete event.request.headers['x-tenant-id'];
        }
        // Never send form/JSON body payloads containing student/payment inputs
        delete event.request.data;
      }

      return event;
    },
  });
}
