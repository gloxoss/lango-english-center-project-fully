import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

function getHash(filename: string) {
  const content = fs.readFileSync(path.join(process.cwd(), 'migrations', filename), 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

console.log('0057_add_admission_model_enhancement.sql:', getHash('0057_add_admission_model_enhancement.sql'));
console.log('0066_certificate_event_rosters.sql:', getHash('0066_certificate_event_rosters.sql'));
console.log('0067_card_and_admit_card_management.sql:', getHash('0067_card_and_admit_card_management.sql'));
