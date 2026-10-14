const fs = require('fs');
const html = fs.readFileSync('canva_dump.html', 'utf8');

// Find the template dictionary
const templateMap = {};

// Regex to find "template-id":{"A?":"O","A":{"A":{"A?":"A","A":"TEXT"}...
// Or broader regex:
const regex = /"([a-z0-9_-]+)":\{"A\?":"O","A":\{"A":\{"A\?":"A","A":"([^"]+)"\}/g;
let match;
while ((match = regex.exec(html)) !== null) {
  templateMap[match[1]] = match[2];
}

console.log('Extracted template map:');
console.log(JSON.stringify(templateMap, null, 2));

// Also check for image templates
const imgRegex = /"([a-z0-9_-]+)":\{"A\?":"O","A":\{"A":\{"A\?":"M","A":"([^"]+)"\}/g;
while ((match = imgRegex.exec(html)) !== null) {
  templateMap[match[1]] = match[2];
}
console.log('Total keys:', Object.keys(templateMap).length);
fs.writeFileSync('scratch/canva_template_data.json', JSON.stringify(templateMap, null, 2));

