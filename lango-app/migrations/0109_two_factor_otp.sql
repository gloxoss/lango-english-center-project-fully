-- 0109_two_factor_otp.sql
-- 2FA email-OTP fallback (plan #3, future-implementation/two-factor-authentication).
-- The app has no real email gateway (same log-only delivery convention as SMS).
-- sendOTP therefore records the code here for auditability + test-provider
-- retrieval, so the verify script can complete a login with the emailed code.
-- Real deployments must replace the sink with an actual email provider.

CREATE TABLE IF NOT EXISTS two_factor_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  otp varchar(10) NOT NULL,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS two_factor_otps_user_idx ON two_factor_otps(user_id);
CREATE INDEX IF NOT EXISTS two_factor_otps_tenant_idx ON two_factor_otps(tenant_id);
