import { describe, expect, it } from 'vitest';
import { monthInChile, summarizeHistory, summarizeMonth } from '../utils/monthlyAnalysis.js';

describe('análisis histórico', () => {
  it('incluye compras TC y la parte compartida una vez, separando transferencias y préstamos', () => {
    const month = summarizeMonth('2026-08', { movements: [
      { type: 'Ingreso', amount: 1000 },
      { type: 'Compartido', amount: 200 },
      { type: 'Individual', category: 'Tarjeta Crédito', amount: 300 },
      { type: 'Pago TC', amount: 300 },
      { type: 'Transferencia interna', amount: 500 },
      { type: 'Préstamo', amount: 100 }
    ] });
    expect(month.expenses).toBe(400);
    expect(month.balance).toBe(600);
  });
  it('mantiene las cargas de tarjeta por conciliar fuera del gasto sin perder la alerta', () => {
    const month = summarizeMonth('2026-08', { tcBatches: [{ items: [
      { type: 'Individual', amount: 200 }, { type: 'Pago TC', amount: -200 },
      { amount: 100, isExcluded: true }
    ] }] });
    expect(month.expenses).toBe(0);
    expect(month.cardUnreconciled).toBe(200);
    expect(month.review).toHaveLength(1);
  });
  it('respeta vigencias de fijos y el residuo de la última cuota', () => {
    const fixed = [{ amount: 600, type: 'Compartido', startMonth: '2026-02', endMonth: '2026-03' }];
    const plans = [{ totalAmount: 100, installments: 3, startMonth: '2026-01', type: 'Individual' }];
    expect(summarizeMonth('2026-01', {}, fixed, plans).expenses).toBe(33);
    expect(summarizeMonth('2026-03', {}, fixed, plans).expenses).toBe(334);
    expect(summarizeMonth('2026-04', {}, fixed, plans).expenses).toBe(0);
  });
  it('promedia todos los meses seleccionados, incluidos ceros por categoría, sin incorporar el mes parcial', () => {
    const months = [
      summarizeMonth('2026-07', { movements: [{ type: 'Individual', amount: 100, category: 'Comida' }] }),
      summarizeMonth('2026-08', { movements: [{ type: 'Individual', amount: 300, category: 'Viajes' }] }),
      summarizeMonth('2026-09', { movements: [{ type: 'Individual', amount: 10 }] }),
      summarizeMonth('2026-06', {})
    ];
    const stats = summarizeHistory(months, ['2026-06', '2026-07', '2026-08']);
    expect(stats).toMatchObject({ count: 2, expenses: 200, balance: -200, median: 200, categories: { Comida: 50, Viajes: 150 } });
    expect(summarizeHistory(months, [])).toBeNull();
  });
  it('advierte posibles duplicados sin borrarlos silenciosamente', () => {
    const month = summarizeMonth('2026-08', { movements: [{ concept: 'Arriendo', type: 'Individual', amount: 500 }] },
      [{ concept: 'Arriendo', type: 'Individual', amount: 500, startMonth: '2026-01' }]);
    expect(month.expenses).toBe(1000);
    expect(month.review[0]).toContain('Posible duplicado');
  });
  it('usa el mes chileno cerca del cambio de mes UTC', () => {
    expect(monthInChile(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09');
  });
});
