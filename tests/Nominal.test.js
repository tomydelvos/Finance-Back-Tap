const test = require('node:test');
const assert = require('node:assert');
const { muat } = require('./muat');
const { parseNominal } = muat();

const ok = { '25000': 25000, '25.000': 25000, '25,000': 25000,
  'Rp 25.000': 25000, 'Rp25.000,-': 25000, '25.000,00': 25000, '25rb': 25000,
  '25 rb': 25000, '25k': 25000, '1,5jt': 1500000, '1.5jt': 1500000, '2jt': 2000000,
  '500': 500, ' 75.500 ': 75500, '1000000000': 1000000000 };
for (const [inp, exp] of Object.entries(ok))
  test(`terima ${JSON.stringify(inp)}`, () => assert.strictEqual(parseNominal(inp), exp));
for (const inp of ['', null, '0', '-5000', 'abc', '1000000001', '12,5'])
  test(`tolak ${JSON.stringify(inp)}`, () => assert.strictEqual(parseNominal(inp), null));
test('angka number', () => assert.strictEqual(parseNominal(25000), 25000));
