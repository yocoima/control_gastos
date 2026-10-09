const toNonNegativeCLP = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
};

const roundPercentage = value => Math.round(value * 10) / 10;

export const calculateFinancialMetrics = ({ income, personalExpenses }) => {
  const normalizedIncome = toNonNegativeCLP(income);
  const normalizedExpenses = toNonNegativeCLP(personalExpenses);
  const balance = normalizedIncome - normalizedExpenses;
  const expensePercentage = normalizedIncome > 0
    ? roundPercentage((normalizedExpenses / normalizedIncome) * 100)
    : 0;
  const deficitPercentage = normalizedIncome > 0 && balance < 0
    ? roundPercentage((Math.abs(balance) / normalizedIncome) * 100)
    : 0;
  const savingsRecommended = balance > 0
    ? Math.min(balance, Math.round(normalizedIncome * 0.2))
    : 0;
  const savingsPercentage = normalizedIncome > 0
    ? roundPercentage((savingsRecommended / normalizedIncome) * 100)
    : 0;

  return {
    income: normalizedIncome,
    personalExpenses: normalizedExpenses,
    balance,
    expensePercentage,
    deficitPercentage,
    savingsRecommended,
    savingsPercentage
  };
};

const formatCLP = value => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
}).format(value);

export const createDeterministicDiagnosis = (metrics, sharedExpenses = 0) => {
  const sharedReference = toNonNegativeCLP(sharedExpenses);
  const sharedExplanation = sharedReference > 0
    ? ` El total compartido de ${formatCLP(sharedReference)} es informativo y no se suma nuevamente, porque tu parte ya está incluida en el gasto personal.`
    : '';

  if (metrics.balance < 0) {
    return `Tus gastos personales del mes (${formatCLP(metrics.personalExpenses)}) superan tus ingresos (${formatCLP(metrics.income)}) en ${formatCLP(Math.abs(metrics.balance))}, equivalente al ${metrics.deficitPercentage}% de tus ingresos.${sharedExplanation}`;
  }
  if (metrics.balance > 0) {
    return `Tus ingresos del mes (${formatCLP(metrics.income)}) superan tus gastos personales (${formatCLP(metrics.personalExpenses)}) en ${formatCLP(metrics.balance)}. Tus gastos representan el ${metrics.expensePercentage}% de tus ingresos.${sharedExplanation}`;
  }
  return `Tus ingresos y gastos personales del mes están equilibrados en ${formatCLP(metrics.income)}.${sharedExplanation}`;
};
