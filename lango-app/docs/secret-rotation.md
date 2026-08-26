# SchoolOS — Secret Rotation Runbook

This document describes the zero-downtime procedure to rotate production secrets (`DATABASE_URL` password and `BETTER_AUTH_SECRET`).

---

## 1. Rotating Database Credentials (`DATABASE_URL`)

### Step 1: Create Secondary Database User/Password
1. Connect to PostgreSQL cluster as administrator.
2. Create or update password for application user:
   ```sql
   ALTER USER schoolos_app WITH PASSWORD 'NewStrongSecretPassword123!';
   ```

### Step 2: Update Environment Variable
1. Update `.env.production` or system environment store with new connection string:
   ```env
   DATABASE_URL=postgresql://schoolos_app:NewStrongSecretPassword123!@db:5432/schoolos?sslmode=disable
   ```

### Step 3: Rolling Container Restart
1. Re-deploy or restart application container:
   ```bash
   docker compose up -d --no-deps app
   ```
2. Confirm healthy status:
   ```bash
   docker compose logs app --tail=50
   ```

---

## 2. Rotating Better Auth Secret (`BETTER_AUTH_SECRET`)

### Step 1: Generate New Secret
Generate a cryptographic 32-byte secret:
```bash
openssl rand -hex 32
```

### Step 2: Update Environment Store
Update `BETTER_AUTH_SECRET` in `.env.production` and restart the application service. Existing users will be required to re-authenticate as token validation keys rotate.

### Step 3: Verify Sign-in Flow
Verify sign-in with seeded account (`y.elamrani@atlas.ma`) to confirm auth provider accepts the new secret.
