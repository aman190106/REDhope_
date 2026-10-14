const fs = require('fs');
const html = fs.readFileSync('canva_dump.html', 'utf8');

// Search for hero-title or template values
const idx = html.indexOf('hero-title');
if (idx !== -1) {
  console.log('Context around hero-title:');
  console.log(html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 500)));
} else {
  console.log('hero-title not found in canva_dump.html');
}

// Let's also check if canva_codelet has any template values or data attributes
const codelet = fs.readFileSync('canva_codelet.html', 'utf8');
const codeletIdx = codelet.indexOf('hero-title');
console.log('codelet hero-title idx:', codeletIdx);

