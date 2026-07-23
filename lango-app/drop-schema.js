const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Schema dropped and recreated.');
  } catch (error) {
    console.error('Failed to drop schema:', error);
  } finally {
    pool.end();
  }
}

run();
