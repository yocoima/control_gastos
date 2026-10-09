import { describe, expect, it } from 'vitest';
import {
  calculateFinancialMetrics,
  createDeterministicDiagnosis
} from '../worker/src/financialMetrics.js';

describe('métricas del asesor financiero', () => {
  it('no vuelve a sumar los gastos compartidos al gasto personal', () => {
    const metrics = calculateFinancialMetrics({
      income: 1965869,
      personalExpenses: 2035098
    });

    expect(metrics.balance).toBe(-69229);
    expect(metrics.deficitPercentage).toBe(3.5);
    expect(metrics.savingsRecommended).toBe(0);
    expect(metrics.savingsPercentage).toBe(0);

    const diagnosis = createDeterministicDiagnosis(metrics, 1211055);
    expect(diagnosis).toContain('$2.035.098');
    expect(diagnosis).toContain('$69.229');
    expect(diagnosis).toContain('no se suma nuevamente');
    expect(diagnosis).not.toContain('3.246.153');
  });

  it('limita el ahorro recomendado al superávit disponible', () => {
    expect(calculateFinancialMetrics({ income: 1000000, personalExpenses: 950000 }))
      .toMatchObject({ balance: 50000, savingsRecommended: 50000, savingsPercentage: 5 });
    expect(calculateFinancialMetrics({ income: 1000000, personalExpenses: 500000 }))
      .toMatchObject({ balance: 500000, savingsRecommended: 200000, savingsPercentage: 20 });
  });
});
