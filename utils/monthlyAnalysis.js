import { calculateInstallmentStatus, calculateMyPart, normalizeText, parseRawNumber } from './finance.js';

const excludedTypes = ['pago tc', 'transferencia', 'transferencia interna', 'prestamo', 'deuda'];
export const monthInChile = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
};

export function summarizeMonth(key, record, fixedExpenses = [], plans = []) {
  const fixed = fixedExpenses.filter(item => item.startMonth && item.startMonth <= key && (!item.endMonth || item.endMonth >= key))
    .map(item => ({ ...item, source: 'Fijo' }));
  const installments = plans.filter(item => item.startMonth).flatMap(item => {
    const status = calculateInstallmentStatus(item, key);
    return status.isActive ? [{ ...item, ...status, amount: status.monthlyAmount, source: 'Cuota' }] : [];
  });
  const items = [...(record.movements || []).map(item => ({ ...item, source: 'Movimiento' })), ...fixed, ...installments];
  const result = { key, income: 0, expenses: 0, scheduled: 0, categories: {}, items, review: [], cardUnreconciled: 0 };
  const knownTypes = ['ingreso', 'individual', 'compartido', 'yo debo', ...excludedTypes];
  const seen = new Set();
  for (const item of items) {
    const type = normalizeText(item.type);
    const amount = parseRawNumber(item.amount);
    const signature = `${normalizeText(item.concept)}|${amount}|${type}`;
    if (seen.has(signature)) result.review.push(`Posible duplicado: ${item.concept || 'Sin detalle'} (${item.source}).`);
    seen.add(signature);
    if (!knownTypes.includes(type)) result.review.push(`Revisar tipo «${item.type || 'vacío'}»: ${item.concept || 'Sin detalle'}.`);
    if (type === 'yo debo') result.review.push(`Verificar que «${item.concept || 'Yo debo'}» no repita una compra ya registrada.`);
    if (item.isExcluded || excludedTypes.includes(type)) continue;
    if (type === 'ingreso') { result.income += amount; continue; }
    const expense = calculateMyPart(item);
    result.expenses += expense;
    if (item.source !== 'Movimiento') result.scheduled += expense;
    const category = item.category || 'Sin categoría';
    result.categories[category] = (result.categories[category] || 0) + expense;
  }
  const cardItems = (record.tcBatches || []).flatMap(batch => batch.items || []).filter(item => !item.isExcluded && parseRawNumber(item.amount) > 0 && normalizeText(item.type) !== 'pago tc');
  result.cardUnreconciled = cardItems.reduce((sum, item) => sum + parseRawNumber(item.amount), 0);
  if (cardItems.length) result.review.push(`${cardItems.length} compras de cargas TC fuera del total: conciliar con movimientos y cuotas antes de sumarlas.`);
  result.balance = result.income - result.expenses;
  result.hasData = items.length > 0 || cardItems.length > 0;
  return result;
}

export function summarizeHistory(months, selectedKeys) {
  const selected = months.filter(month => selectedKeys.includes(month.key) && month.hasData);
  if (!selected.length) return null;
  const mean = field => selected.reduce((sum, month) => sum + month[field], 0) / selected.length;
  const expenses = selected.map(month => month.expenses).sort((a, b) => a - b);
  const mid = Math.floor(expenses.length / 2);
  const categories = {};
  for (const month of selected) for (const [category, amount] of Object.entries(month.categories)) {
    categories[category] = (categories[category] || 0) + amount / selected.length;
  }
  return {
    count: selected.length, income: mean('income'), expenses: mean('expenses'), balance: mean('balance'),
    median: expenses.length % 2 ? expenses[mid] : (expenses[mid - 1] + expenses[mid]) / 2,
    maxExpenses: Math.max(...expenses), categories,
    reviewCount: selected.reduce((sum, month) => sum + month.review.length, 0)
  };
}
