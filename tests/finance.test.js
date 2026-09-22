import { describe, expect, it } from 'vitest';
import {
  adjustCreditCardDebt,
  calculateDebtContribution,
  calculateInstallmentStatus,
  calculateTotals,
  parseRawNumber
} from '../utils/finance.js';

describe('cálculos financieros', () => {
  it('interpreta montos chilenos y decimales', () => {
    expect(parseRawNumber('$ 1.234.567')).toBe(1234567);
    expect(parseRawNumber('-12.500')).toBe(-12500);
    expect(parseRawNumber('1.234,50')).toBe(1234.5);
  });

  it('calcula ingresos, gastos compartidos y deuda', () => {
    const totals = calculateTotals([
      { amount: 1_000_000, type: 'Ingreso' },
      { amount: 100_000, type: 'Individual' },
      { amount: 80_000, type: 'Compartido' },
      { amount: 30_000, type: 'Préstamo' },
      { amount: 10_000, type: 'Yo debo' }
    ]);
    expect(totals).toEqual({ income: 1_000_000, indiv: 150_000, shared: 80_000, debt: 60_000 });
  });

  it('excluye de la deuda registros pagados', () => {
    expect(calculateDebtContribution({ amount: 50_000, type: 'Compartido', isPaid: true })).toBe(0);
  });

  it('distribuye el residuo en la última cuota sin alterar el total', () => {
    const plan = { totalAmount: 100_000, installments: 3, startMonth: '2026-01', type: 'Individual' };
    const amounts = ['2026-01', '2026-02', '2026-03'].map(month => calculateInstallmentStatus(plan, month).monthlyAmount);
    expect(amounts).toEqual([33_333, 33_333, 33_334]);
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(100_000);
  });

  it('ajusta la deuda TC al editar, desmarcar o liquidar una compra', () => {
    const oldMovement = { amount: 50_000, paidWithCreditCard: true, creditCardSettled: false };
    expect(adjustCreditCardDebt(50_000, oldMovement, { ...oldMovement, amount: 70_000 })).toBe(70_000);
    expect(adjustCreditCardDebt(50_000, oldMovement, { ...oldMovement, paidWithCreditCard: false })).toBe(0);
    expect(adjustCreditCardDebt(0, { ...oldMovement, creditCardSettled: true }, { ...oldMovement, amount: 80_000, creditCardSettled: true })).toBe(0);
  });
});

