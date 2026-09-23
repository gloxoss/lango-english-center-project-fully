import fs from 'node:fs';

for (const lang of ['fr', 'en', 'ar']) {
  const filePath = `locales/${lang}.json`;
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  if (data.students && data.Students) {
    console.log(`${lang}: Merging lowercase students into capital Students...`);
    Object.assign(data.Students, data.students);
    data.students = { ...data.Students };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`${lang}: Successfully merged and saved.`);
  }
}
