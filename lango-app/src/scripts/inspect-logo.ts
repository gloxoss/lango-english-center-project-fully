import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const uploadsDir = process.env.UPLOADS_DIR || '/app/uploads';
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  const logoPath = path.resolve(uploadsDir, tenantId, 'logo.jpg');
  
  if (fs.existsSync(logoPath)) {
    const buf = fs.readFileSync(logoPath);
    console.log(`logo.jpg byte length: ${buf.length}`);
    console.log(`First 16 bytes:`, buf.subarray(0, 16));
    // Let's copy to artifacts so we can see what it is
    const artifactDest = path.join('C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7', 'inspected_logo.jpg');
    fs.writeFileSync(artifactDest, buf);
    console.log(`Copied to ${artifactDest}`);
  } else {
    console.log('logo.jpg not found at', logoPath);
  }
}

main().catch(console.error);
