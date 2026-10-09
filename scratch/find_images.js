const fs = require('fs');
const html = fs.readFileSync('canva_dump.html', 'utf8');

function findAround(str) {
  const i = html.indexOf(str);
  if (i !== -1) {
    console.log(`Around ${str}:`);
    console.log(html.substring(Math.max(0, i - 100), Math.min(html.length, i + 300)));
  }
}

findAround('hero-image');
findAround('trust-image');

