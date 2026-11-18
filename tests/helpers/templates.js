const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');

function trovaHtml(dir, base) {
  let out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out = out.concat(trovaHtml(p, base));
    } else if (e.name.endsWith('.html') && e.name !== 'index.html') {
      out.push(path.relative(base, p).split(path.sep).join('/'));
    }
  });
  return out;
}

// Mette tutti i template in $templateCache, così templateUrl funziona senza HTTP
function caricaTemplates($templateCache) {
  trovaHtml(SRC, SRC).forEach((url) => {
    $templateCache.put(url, fs.readFileSync(path.join(SRC, url), 'utf8'));
  });
}

module.exports = { caricaTemplates };
