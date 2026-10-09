const fs = require('fs');
const https = require('https');

const options = {
  hostname: 'www.canva.com',
  path: '/design/DAHXgZ9Teu8/wVhRqwJ0Wif3tQnJOrNciw/view',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('canva_dump.html', data);
    console.log('Dumped HTML length:', data.length);
    const ogImage = data.match(/<meta property="og:image" content="([^"]+)"/);
    const ogTitle = data.match(/<meta property="og:title" content="([^"]+)"/);
    const ogDesc = data.match(/<meta property="og:description" content="([^"]+)"/);
    console.log('og:title:', ogTitle ? ogTitle[1] : null);
    console.log('og:image:', ogImage ? ogImage[1] : null);
    console.log('og:desc:', ogDesc ? ogDesc[1] : null);
    
    // Search for image URLs or design JSON in data
    const urls = data.match(/https:\/\/[^"'\\<> ]+\.(?:png|jpg|jpeg|webp)/g) || [];
    console.log('Found image URLs:', [...new Set(urls)]);
  });
}).on('error', err => console.error(err));

