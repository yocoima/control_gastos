import { describe, expect, it } from 'vitest';
import { createCsv, parseCsv } from '../utils/csv.js';

describe('CSV', () => {
  it('conserva comas, comillas y saltos de línea', () => {
    const rows = [
      ['ID', 'Concepto', 'Monto'],
      ['1', 'Supermercado, oferta "2x1"', '12.500'],
      ['2', 'Detalle\nmultilínea', '5000']
    ];
    expect(parseCsv(createCsv(rows[0], rows.slice(1)))).toEqual(rows);
  });

  it('admite archivos con BOM y finales de línea Windows', () => {
    expect(parseCsv('\uFEFFID,Concepto\r\n1,Café\r\n')).toEqual([
      ['ID', 'Concepto'],
      ['1', 'Café']
    ]);
  });
});

