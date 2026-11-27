// Keeps the JSON examples in README.md in sync with the importer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateImport } from './backup';

const readme = readFileSync(join(__dirname, '..', '..', 'README.md'), 'utf8');
const blocks = [...readme.matchAll(/```json\r?\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1] ?? '') as unknown);

describe('README JSON examples', () => {
  it('contains a candidate list and a backup example', () => {
    expect(blocks).toHaveLength(2);
  });

  it('every example is accepted by the importer', () => {
    for (const b of blocks) {
      const r = validateImport(b);
      expect(r.ok, JSON.stringify(r.ok ? [] : r.errors)).toBe(true);
    }
  });

  it('the candidate example yields 2 candidates with defaults', () => {
    const r = validateImport(blocks[0]);
    expect(r.ok && r.data.kind).toBe('candidates');
    if (r.ok) {
      expect(r.data.candidates).toHaveLength(2);
      expect(r.data.candidates[1]).toMatchObject({ done: false, active: true });
    }
  });
});
