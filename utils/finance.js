export const parseRawNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  const sign = cleaned.includes('-') ? -1 : 1;
  const unsigned = cleaned.replace(/-/g, '');
  if (!unsigned) return 0;
  const lastDot = unsigned.lastIndexOf('.');
  const lastComma = unsigned.lastIndexOf(',');
  const lastSeparator = Math.max(lastDot, lastComma);
  let normalized = unsigned.replace(/[.,]/g, '');
  if (lastSeparator !== -1) {
    const integerPart = unsigned.slice(0, lastSeparator);
    const decimalPart = unsigned.slice(lastSeparator + 1);
    const mixed = lastDot !== -1 && lastComma !== -1;
    if (/^\d{1,2}$/.test(decimalPart) && (mixed || decimalPart.length < 3)) {
      normalized = `${integerPart.replace(/[.,]/g, '')}.${decimalPart}`;
    }
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed * sign : 0;
};

export const normalizeText = (value) => (value ?? '')
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export const isFinancialType = (type, expected) => normalizeText(type) === normalizeText(expected);

export const calculateMyPart = (movement) => {
  const amount = parseRawNumber(movement.amount);
  if (isFinancialType(movement.type, 'Ingreso') || isFinancialType(movement.type, 'Deuda') || isFinancialType(movement.type, 'Préstamo')) return 0;
  if (movement.myPart !== undefined) return parseRawNumber(movement.myPart);
  return isFinancialType(movement.type, 'Compartido') ? amount / 2 : amount;
};

export const calculateDebtContribution = (movement) => {
  if (movement.karlaIsPaid ?? movement.isPaid) return 0;
  const amount = parseRawNumber(movement.amount);
  if (isFinancialType(movement.type, 'Compartido')) return amount / 2;
  if (isFinancialType(movement.type, 'Deuda') || isFinancialType(movement.type, 'Préstamo')) return amount;
  if (isFinancialType(movement.type, 'Yo debo')) return -amount;
  return 0;
};

export const calculateTotals = (movements) => movements.reduce((totals, movement) => {
  const amount = parseRawNumber(movement.amount);
  if (isFinancialType(movement.type, 'Ingreso')) totals.income += amount;
  else {
    totals.indiv += calculateMyPart(movement);
    if (isFinancialType(movement.type, 'Compartido')) totals.shared += amount;
  }
  totals.debt += calculateDebtContribution(movement);
  return totals;
}, { income: 0, indiv: 0, shared: 0, debt: 0 });

export const calculateInstallmentStatus = (plan, targetMonthKey) => {
  const [year, month] = targetMonthKey.split('-').map(Number);
  const [startYear, startMonth] = plan.startMonth.split('-').map(Number);
  const installmentNumber = ((year - startYear) * 12) + (month - startMonth) + 1;
  const count = Math.max(1, parseInt(plan.installments, 10) || 1);
  const total = parseRawNumber(plan.totalAmount);
  const base = total > 0 ? Math.floor(total / count) : parseRawNumber(plan.monthlyAmount);
  const monthlyAmount = total > 0 && installmentNumber === count ? total - (base * (count - 1)) : base;
  return {
    installmentNumber,
    isActive: installmentNumber >= 1 && installmentNumber <= count,
    isFinished: installmentNumber > count,
    isPaid: (plan.paidMonths || []).includes(targetMonthKey),
    monthlyAmount,
    myPart: isFinancialType(plan.type, 'Compartido') ? monthlyAmount / 2 : (isFinancialType(plan.type, 'Ingreso') ? 0 : monthlyAmount)
  };
};

export const getOpenCreditCardContribution = (movement) => (
  movement?.paidWithCreditCard && movement.creditCardSettled !== true
    ? parseRawNumber(movement.amount)
    : 0
);

export const adjustCreditCardDebt = (currentDebt, previousMovement, nextMovement) => Math.max(
  0,
  parseRawNumber(currentDebt)
    + getOpenCreditCardContribution(nextMovement)
    - getOpenCreditCardContribution(previousMovement)
);

