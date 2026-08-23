// One-off data repair: the seed wrote placeholder (non-pdfme) JSON into the
// template schema columns, which made renderPdf() throw and surface as
// INTERNAL_ERROR on PDF download (cards + certificates). Replaces those
// malformed rows with minimal-but-valid pdfme templates.
import pg from 'pg';

const conn = process.env.DATABASE_URL || 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos';

const CARD_TEMPLATE = {
  basePdf: { width: 86, height: 54, padding: [0, 0, 0, 0] },
  schemas: [
    [{ name: 'nom', type: 'text', position: { x: 10, y: 10 }, width: 66, height: 10, content: '{nom}', fontName: 'Roboto', fontSize: 12, alignment: 'left' }],
  ],
};

const CERT_SCHEMA = [
  [{ name: 'nom', type: 'text', position: { x: 30, y: 60 }, width: 150, height: 12, content: '{nom}', fontName: 'Roboto', fontSize: 16, alignment: 'center' }],
];
const CERT_BASE = { width: 210, height: 297, padding: [0, 0, 0, 0] };

const client = new pg.Client({ connectionString: conn });

async function main() {
  await client.connect();

  // Catch both the original malformed shape ({fields}/{layout}/{page}) AND the
  // 1D pdfme shape (schemas[0] is an object, not an array) from the earlier repair.
  const cards = await client.query(
    `UPDATE document_template_versions
       SET schema_json = $1::jsonb
     WHERE schema_json ? 'fields'
        OR jsonb_typeof(schema_json->'schemas'->0) = 'object'`,
    [JSON.stringify(CARD_TEMPLATE)],
  );
  console.log(`document_template_versions repaired: ${cards.rowCount}`);

  const defs = await client.query(
    `UPDATE certificate_definition_versions
       SET template_schema = $1::jsonb, pdfme_base_pdf = $2::jsonb
     WHERE template_schema ? 'layout' OR pdfme_base_pdf ? 'page'
        OR jsonb_typeof(template_schema->0) = 'object'`,
    [JSON.stringify(CERT_SCHEMA), JSON.stringify(CERT_BASE)],
  );
  console.log(`certificate_definition_versions repaired: ${defs.rowCount}`);

  const tpls = await client.query(
    `UPDATE certificate_template_versions
       SET template_schema = $1::jsonb, pdfme_base_pdf = $2::jsonb
     WHERE template_schema ? 'fields' OR pdfme_base_pdf ? 'page'
        OR jsonb_typeof(template_schema->0) = 'object'`,
    [JSON.stringify(CERT_SCHEMA), JSON.stringify(CERT_BASE)],
  );
  console.log(`certificate_template_versions repaired: ${tpls.rowCount}`);

  await client.end();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
