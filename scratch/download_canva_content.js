const fs = require('fs');
const https = require('https');

const codeletUrl = 'https://cmp9rhcpsryvvrt2.canvacode.com/codelet/eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..DAxuW8-jMRZ6LrH0.gU5X54SWlkkT2L8A8Pcve9sXg2lBFdsL-2UDwTvdNKmgIEhd_BFxfpzlmQV8BaesKus9T9xhBWQSXLc4I8vIDKCVa1CunNV9E8lbP-KIx9Y-9Y1DXih1pCTPYb9Gp8LHSdpLm_DM9fS2m1kq-zbOinaIUd6S1ol7podl8Zd6QnVAwz1qAT5fsntEGa9JF_DDS2xSRff3v5ZzJemfJhyiTKdrNJrAW_K-6lvgGIEHLZIySK6kUL27gu9o0CmzSlXcLWcPpR-T6DGAndNQq_jXYF2A2f9pWCWShSW4aoNNL-3eNRl4qLrE1clcnxiDig.vgzbJq28PezZ_fcLxaEcBA/index.html';

function downloadFile(url, dest, cb) {
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log('Redirecting to:', res.headers.location);
      return downloadFile(res.headers.location, dest, cb);
    }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close(cb);
    });
  }).on('error', err => {
    console.error('Error downloading:', err);
  });
}

console.log('Downloading codelet...');
downloadFile(codeletUrl, 'canva_codelet.html', () => {
  console.log('Downloaded canva_codelet.html, size:', fs.statSync('canva_codelet.html').size);
});

// Also download the screen image
const screenUrl = 'https://www.canva.com/design/DAHXgZ9Teu8/wVhRqwJ0Wif3tQnJOrNciw/screen';
downloadFile(screenUrl, 'canva_screen.jpg', () => {
  console.log('Downloaded canva_screen.jpg, size:', fs.statSync('canva_screen.jpg').size);
});

