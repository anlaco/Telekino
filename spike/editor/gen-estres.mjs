// Genera un .qvi grande para medir el canvas: N sumas encadenadas.
import { writeFileSync } from 'node:fs';
const N = Number(process.argv[2] || 200);

const nodes = [{ id: 'c', type: 'control', ref: 'x' }, { id: 'k', type: 'const', value: 1.0 }];
const wires = [];
let prev = 'c';
for (let i = 0; i < N; i++) {
  nodes.push({ id: `s${i}`, type: 'add' });
  wires.push({ from: [prev, 'out'], to: [`s${i}`, 'a'] });
  wires.push({ from: ['k', 'out'], to: [`s${i}`, 'b'] });
  prev = `s${i}`;
}
nodes.push({ id: 'o', type: 'indicator', ref: 'r' });
wires.push({ from: [prev, 'out'], to: ['o', 'in'] });

writeFileSync(process.argv[3], JSON.stringify({
  qvi: 1,
  meta: { name: `estres-${N}`, description: `${N} sumas encadenadas: mide el canvas, no el compilador.` },
  'front-panel': [
    { id: 'x', kind: 'control', label: 'X', default: 0.0 },
    { id: 'r', kind: 'indicator', label: 'Resultado' },
  ],
  diagram: { nodes, wires },
}, null, 1));
console.log(`${N} sumas → ${process.argv[3]}`);
