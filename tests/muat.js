// Memuat semua file apps-script/*.js (kecuali Kode.js) ke satu konteks vm,
// meniru lingkungan global Apps Script.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function muat() {
  const dir = path.join(__dirname, '..', 'apps-script');
  const ctx = vm.createContext({});
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.js') || f === 'Kode.js') continue;
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

module.exports = { muat };
