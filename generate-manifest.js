const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const manifestPath = path.join(dataDir, 'manifest.json');
const swPath = path.join(__dirname, 'service-worker.js');

const manifest = {};
const dataFiles = [];

const subjects = fs.readdirSync(dataDir).filter(f => {
  const fullPath = path.join(dataDir, f);
  return fs.statSync(fullPath).isDirectory();
});

subjects.forEach(subject => {
  const subjectDir = path.join(dataDir, subject);
  const papers = fs.readdirSync(subjectDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      dataFiles.push(`/data/${subject}/${f}`);
      return f.replace('.json', '');
    });

  if (papers.length > 0) {
    manifest[subject] = papers;
  }
});

// Write manifest.json
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Generated ${manifestPath}`);

// Update service-worker.js
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');

  // Increment CACHE_NAME version
  swContent = swContent.replace(/(const CACHE_NAME = 'neaea-vault-v)(\d+)(';)/, (match, p1, p2, p3) => {
    return `${p1}${parseInt(p2) + 1}${p3}`;
  });

  // Update DATA_FILES array
  const dataFilesList = dataFiles.map(f => `  '${f}',`).join('\n');
  const newDataFilesBlock = `// Data files — automatically generated\nconst DATA_FILES = [\n${dataFilesList}\n  '/data/manifest.json',\n];`;

  swContent = swContent.replace(/\/\/ Data files — (?:add new subjects\/papers here|automatically generated)\nconst DATA_FILES = \[\n[\s\S]*?\];/, newDataFilesBlock);

  fs.writeFileSync(swPath, swContent);
  console.log(`Updated ${swPath}`);
}
