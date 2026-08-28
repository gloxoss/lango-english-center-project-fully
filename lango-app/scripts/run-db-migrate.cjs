// Migration runner passed to pglite-server via `--run` (db-server:memory /
// db-server:file). pglite-server injects DATABASE_URL pointing at the
// in-memory Postgres-wire server into this subprocess, so drizzle-kit migrate
// applies the schema to it. Referenced by package.json; its absence made
// `build-local` (and therefore the CI build job) fail — W3 report defect #10.
const { execSync } = require('node:child_process');

execSync('npx drizzle-kit migrate', { stdio: 'inherit' });
