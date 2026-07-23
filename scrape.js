const fs = require('fs');
const html = fs.readFileSync('search.html', 'utf8');
const results = [...html.matchAll(/class="result__url" href="([^"]+)"/g)].map(m => m[1]);
console.log(results);
