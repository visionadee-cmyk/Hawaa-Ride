const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function injectIntoHead(html, tags) {
  const headClose = html.indexOf('</head>');
  if (headClose === -1) return html;

  let out = html;
  for (const tag of tags) {
    if (!out.includes(tag)) {
      out = out.slice(0, headClose) + `  ${tag}\n` + out.slice(headClose);
    }
  }
  return out;
}

(function main() {
  const root = path.resolve(__dirname, '..');
  const distDir = path.join(root, 'dist');

  if (!fs.existsSync(distDir)) {
    console.error('[postexport] dist/ not found. Did expo export run?');
    process.exit(1);
  }

  const manifestSrc = path.join(root, 'public', 'manifest.json');
  const logoSrc = path.join(root, 'logo.png');

  if (fs.existsSync(manifestSrc)) {
    copyFile(manifestSrc, path.join(distDir, 'manifest.json'));
    console.log('[postexport] Copied manifest.json');
  } else {
    console.warn('[postexport] public/manifest.json not found, skipping');
  }

  if (fs.existsSync(logoSrc)) {
    copyFile(logoSrc, path.join(distDir, 'logo.png'));
    console.log('[postexport] Copied logo.png');
  } else {
    console.warn('[postexport] logo.png not found, skipping');
  }

  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn('[postexport] dist/index.html not found, skipping head injection');
    return;
  }

  const html = fs.readFileSync(indexPath, 'utf8');

  const tags = [
    '<meta name="application-name" content="Hawaa Ride" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    '<meta name="apple-mobile-web-app-title" content="Hawaa Ride" />',
    '<meta name="theme-color" content="#0B9E3D" />',
    '<link rel="manifest" href="/manifest.json" />',
    '<link rel="apple-touch-icon" href="/logo.png" />',
    '<link rel="icon" href="/logo.png" />',
  ];

  const next = injectIntoHead(html, tags);
  if (next !== html) {
    fs.writeFileSync(indexPath, next, 'utf8');
    console.log('[postexport] Injected manifest/icon meta into dist/index.html');
  } else {
    console.log('[postexport] dist/index.html already had required tags');
  }
})();
