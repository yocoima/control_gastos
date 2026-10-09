import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseClient.js';
import { monthInChile, summarizeHistory, summarizeMonth } from '../utils/monthlyAnalysis.js';

const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export default function MonthlyAnalysis({ uid }) {
  const [records, setRecords] = useState(null);
  const [fixed, setFixed] = useState(null);
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');
  const [excluded, setExcluded] = useState([]);
  const [incomeOverride, setIncomeOverride] = useState('');
  const currentKey = monthInChile();
  useEffect(() => {
    setRecords(null); setFixed(null); setPlans(null); setError(''); setExcluded([]); setIncomeOverride('');
    const path = ['artifacts', 'gastos-chile-v2', 'users', uid];
    const onError = () => setError('No se pudo cargar todo el historial. Vuelve a iniciar sesión o revisa tu conexión.');
    const stops = [
      onSnapshot(collection(db, ...path, 'monthly_records'), snapshot => setRecords(Object.fromEntries(snapshot.docs.map(item => {
        const data = item.data();
        const { evidence, ...rent } = data.pyramidRent || {};
        return [item.id, { movements: data.movements || [], tcBatches: data.tcBatches || [], balances: data.balances || null, pyramidRent: rent }];
      }))), onError),
      onSnapshot(doc(db, ...path, 'config', 'fixed_expenses'), snapshot => setFixed(snapshot.data()?.expenses || []), onError),
      onSnapshot(doc(db, ...path, 'config', 'installments'), snapshot => setPlans(snapshot.data()?.plans || []), onError)
    ];
    return () => stops.forEach(stop => stop());
  }, [uid]);
  const months = useMemo(() => records && fixed && plans ? [...new Set([...Object.keys(records), currentKey])]
    .filter(key => /^\d{4}-(0[1-9]|1[0-2])$/.test(key) && key <= currentKey).sort()
    .map(key => summarizeMonth(key, records[key] || {}, fixed, plans)) : [], [records, fixed, plans, currentKey]);
  const selected = months.filter(month => month.key < currentKey && month.hasData && !excluded.includes(month.key)).map(month => month.key);
  const stats = summarizeHistory(months, selected);
  const current = months.find(month => month.key === currentKey);
  const expectedIncome = incomeOverride === '' ? stats?.income : Number(incomeOverride);
  const estimatedExpenses = stats && current ? Math.max(stats.expenses, current.expenses) : null;
  const projectedBalance = estimatedExpenses !== null ? expectedIncome - estimatedExpenses : null;
  const download = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), currentKey, selectedMonths: selected, records, fixedExpenses: fixed, installmentPlans: plans }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `analisis-gastos-${currentKey}.json`; link.click(); URL.revokeObjectURL(url);
  };
  return <details className="bg-white rounded-[2rem] border border-slate-200 p-5 mb-8">
    <summary className="font-black text-slate-800 cursor-pointer">Análisis de todos los meses · promedio y disponible</summary>
    {error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : !records || !fixed || !plans ? <p className="mt-4">Cargando historial…</p> : <div className="mt-4 space-y-4 text-sm">
      <p>Base provisional: meses anteriores con datos. Desmarca los meses incompletos. El mes actual ({currentKey}) se muestra aparte y no reduce el promedio. Los meses sin registros no se cuentan como gasto cero.</p>
      <p className="text-amber-800 bg-amber-50 rounded-xl p-3">Los gastos fijos y cuotas históricos se reconstruyen con la configuración vigente: si cambiaste o eliminaste un plan, el pasado puede estar incompleto. Las cargas TC pendientes de conciliación no están incluidas. Revisa estos puntos antes de usar el saldo como dinero disponible.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap"><thead><tr>{['Base', 'Mes', 'Ingresos', 'Gasto personal¹', 'De fijos/cuotas', 'Saldo mensual', 'TC por conciliar²'].map(label => <th key={label} className="p-2 border-b">{label}</th>)}</tr></thead>
          <tbody>{months.map(month => <tr key={month.key} className="border-b">
            <td className="p-2">{month.key < currentKey && month.hasData ? <input aria-label={`Incluir ${month.key} en promedio`} type="checkbox" checked={!excluded.includes(month.key)} onChange={e => setExcluded(prev => e.target.checked ? prev.filter(key => key !== month.key) : [...prev, month.key])} /> : '—'}</td>
            <td className="p-2">{month.key}{month.key === currentKey ? ' · en curso' : !month.hasData ? ' · sin datos' : ''}</td>
            {[month.income, month.expenses, month.scheduled, month.balance, month.cardUnreconciled].map((value, index) => <td key={index} className={`p-2 ${value < 0 ? 'text-red-700' : ''}`}>{money(value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">¹ Tu parte de los compartidos ya está incluida; incluye obligaciones programadas aunque estén pendientes de pago. ² Importe bruto, puede repetir compras registradas y contener gastos compartidos; no se suma automáticamente.</p>
      {stats ? <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[
          ['Ingreso promedio', stats.income], ['Gasto promedio', stats.expenses], ['Saldo promedio', stats.balance], ['Mediana del gasto', stats.median]
        ].map(([label, value]) => <div key={label} className="bg-slate-50 rounded-xl p-3"><p>{label}</p><strong className={value < 0 ? 'text-red-700' : 'text-slate-900'}>{money(value)}</strong></div>)}</div>
        <p>Base: {stats.count} meses ({selected.join(', ')}). El promedio conserva gastos extraordinarios; la mediana muestra un mes típico, pero no reserva dinero para esos gastos.</p>
        {stats.count < 3 && <p className="text-amber-800">Hay menos de tres meses en la base: la estimación todavía es poco representativa.</p>}
        <label className="block">Ingreso total esperado este mes (CLP; opcional)
          <input type="number" min="0" step="1" value={incomeOverride} onChange={e => setIncomeOverride(e.target.value)} placeholder={String(Math.round(stats.income))} className="block border rounded-lg p-2 mt-1 w-full sm:w-72" />
        </label>
        <p>Escenario de cierre: ingreso {incomeOverride === '' ? 'promedio histórico' : 'indicado'} de <strong>{money(expectedIncome)}</strong> − gasto estimado de <strong>{money(estimatedExpenses)}</strong> = <strong className={projectedBalance < 0 ? 'text-red-700' : 'text-emerald-700'}>{money(projectedBalance)}</strong>.</p>
        <p className="text-xs text-slate-500">El gasto estimado es el mayor entre el promedio histórico y lo registrado/programado este mes. No extrapola por día ni garantiza cubrir gastos nuevos. No es saldo bancario libre: faltan conciliar la TC, fechas de cobro y pago, préstamos, ahorro reservado y obligaciones no registradas.</p>
        <details><summary className="cursor-pointer font-bold">Promedio por categoría</summary><ul className="mt-2 space-y-1">{Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).map(([category, amount]) => <li key={category}>{category}: {money(amount)}</li>)}</ul></details>
      </> : <p>Selecciona al menos un mes anterior con datos completos para calcular promedios.</p>}
      <details><summary className="cursor-pointer font-bold">Revisiones pendientes ({months.reduce((sum, month) => sum + month.review.length, 0)})</summary>
        <ul className="mt-2 space-y-1">{months.flatMap(month => month.review.map((message, index) => <li key={`${month.key}-${index}`}>{month.key}: {message}</li>))}</ul>
        <p className="mt-2">No se eliminan posibles duplicados automáticamente. Los pagos TC, transferencias internas y préstamos por cobrar se excluyen del gasto. “Yo debo” se incluye según la regla actual de la aplicación. Ingresos extraordinarios o reembolsos marcados como ingreso requieren revisión. El módulo de arriendo se lleva aparte y no se agrega aquí automáticamente.</p>
      </details>
      <button type="button" onClick={download} className="bg-slate-800 text-white rounded-xl px-4 py-2">Exportar datos de todos los meses</button>
      <p className="text-xs text-slate-500">El archivo incluye movimientos, cargas TC, saldos, datos de arriendo y configuración de fijos/cuotas; omite las colecciones de evidencias. Puedes compartirlo para revisar el detalle. Estos cálculos no modifican tus registros.</p>
    </div>}
  </details>;
}
