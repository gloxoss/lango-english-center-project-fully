require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('select * from "tenants" left join "user" on "user"."tenant_id" = "tenants"."id" limit 1'))
  .then(res => console.log(res.rows))
  .catch(err => console.error(err))
  .finally(() => {
    client.end();
    process.exit(0);
  });
