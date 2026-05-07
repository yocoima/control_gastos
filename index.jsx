import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  ChevronLeft, ChevronRight, Trash2, ReceiptText, ChevronUp, ChevronDown, Eye, EyeOff,
  CheckCircle2, Camera, Loader2, Edit2, Save, Image as ImageIcon, LogOut, Plus,
  CreditCard, Wallet, ArrowRightLeft, Copy, Check, Download, Upload, ShieldCheck, Settings, X, Calculator
} from 'lucide-react';

// --- CONFIGURACIÓN FIREBASE ---
// Reemplaza esto con tu objeto de configuración real de Firebase.
// Puedes encontrarlo en la consola de Firebase, en "Configuración del proyecto" -> "Tus apps" (el script que me acabas de compartir)
const firebaseConfig = {
  apiKey: "AIzaSyBCWEncZRmIC0CInMFiN5XoGvVPSk0bl60",
  authDomain: "control-de-gastos-e858a.firebaseapp.com",
  projectId: "control-de-gastos-e858a",
  storageBucket: "control-de-gastos-e858a.firebasestorage.app",
  messagingSenderId: "788485557323",
  appId: "1:788485557323:web:6842cbfbbe6e4f78b3d1ce"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_COLLECTION_ID = 'gastos-chile-v2'; // Este es el ID de la colección principal para tus datos
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const PYRAMID_RENT_INITIAL_BANK_MONTH_KEY = '2026-05';
const PYRAMID_RENT_INITIAL_BANK_BALANCE = 929932;
const createGeneratedId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getMonthKeyFromDate = (date) => `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
const dateFromMonthKey = (key) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1);
};
const getMonthName = (date) => date.toLocaleString('es-CL', { month: 'long' }).toLowerCase();
const createEmptyPyramidRentWithdrawal = () => ({
  id: createGeneratedId(),
  detail: '',
  amount: 0
});
const createDefaultPyramidRent = (targetMonthKey = null) => ({
  rentIncome: 0,
  dividendExpense: 0,
  quarterlyAdjustment: 0,
  openingBankBalance: targetMonthKey === PYRAMID_RENT_INITIAL_BANK_MONTH_KEY ? PYRAMID_RENT_INITIAL_BANK_BALANCE : 0,
  withdrawals: []
});
export default function App() {
  const [user, setUser] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [movements, setMovements] = useState([]);
  const [balances, setBalances] = useState({ itau: 0, scotia: 0, edenred: 0, tc_deuda: 0 });
  const [tcBatches, setTcBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTCImportModal, setShowTCImportModal] = useState(false);
  const [showTCPaymentModal, setShowTCPaymentModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState([]);
  const [isDebtCollapsed, setIsDebtCollapsed] = useState(true);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [installmentPlans, setInstallmentPlans] = useState([]);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [showProjectionModal, setShowProjectionModal] = useState(false);
  const [projectionItems, setProjectionItems] = useState([]);
  const [projectionType, setProjectionType] = useState('Impuestos');
  const [projectionAmount, setProjectionAmount] = useState('');
  const [projectionResult, setProjectionResult] = useState(null);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [projectionError, setProjectionError] = useState('');
  const [editingProjectionItemId, setEditingProjectionItemId] = useState(null);
  const [editingProjectionItemData, setEditingProjectionItemData] = useState({ type: '', amount: '' });
  const [evidence, setEvidence] = useState([]);
  const [pyramidRent, setPyramidRent] = useState(() => createDefaultPyramidRent(getMonthKeyFromDate(new Date())));
  const [pyramidRentHistory, setPyramidRentHistory] = useState({});
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceViewer, setEvidenceViewer] = useState(null);
  const [editingFixedId, setEditingFixedId] = useState(null);
  const [editingFixedData, setEditingFixedData] = useState({});
  const evidenceInputRef = useRef(null);
  const DEFAULT_TYPES = ['Compartido', 'Individual', 'Yo debo', 'Préstamo', 'Ingreso'];
  const DEFAULT_CATEGORIES = ['Comida', 'Gastos fijos', 'Cuentas', 'Transporte', 'Diversión', 'Sueldo', 'Otros'];
  const PROJECTION_SPECIAL_TYPES = ['Impuestos', 'Cumpleaños', 'Cuotas especiales', 'Viajes', 'Permiso de circulación', 'Vacaciones', 'Gasto extraordinario'];
  const PROJECTION_VARIABLE_CATEGORIES = ['Comida', 'Transporte'];
  const PROJECTION_FIXED_CATEGORIES = ['Gastos fijos', 'Cuentas'];
  const PROJECTION_IGNORED_TYPES = ['Pago TC'];
  const [movTypes, setMovTypes] = useState(DEFAULT_TYPES);
  const [movCategories, setMovCategories] = useState(DEFAULT_CATEGORIES);
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [modalTab, setModalTab] = useState('categorias');
  const [newTypeName, setNewTypeName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [instTotal, setInstTotal] = useState('');
  const [instCount, setInstCount] = useState('');
  
  const camInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const getMonthKey = (date) => getMonthKeyFromDate(date);
  const monthKey = getMonthKey(currentDate);
  const changeMonth = (offset) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [activeTab, setActiveTab] = useState('movimientos');
  const [aiAdvice, setAiAdvice] = useState(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [aiAdviceError, setAiAdviceError] = useState('');

  // --- FORMATEO ---
  const formatCLP = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(val || 0);
  const formatInputNumber = (val) => {
    if (!val && val !== 0) return "";
    const clean = val.toString().replace(/\D/g, "");
    return clean ? new Intl.NumberFormat('es-CL').format(parseInt(clean, 10)) : "";
  };
  const parseRawNumber = (val) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (val === null || val === undefined) return 0;
    const raw = val.toString().trim();
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d,.-]/g, "");
    const sign = cleaned.includes("-") ? -1 : 1;
    const unsigned = cleaned.replace(/-/g, "");
    if (!unsigned) return 0;

    const lastDot = unsigned.lastIndexOf(".");
    const lastComma = unsigned.lastIndexOf(",");
    const lastSeparator = Math.max(lastDot, lastComma);
    let normalized = unsigned.replace(/[.,]/g, "");

    if (lastSeparator !== -1) {
      const integerPart = unsigned.slice(0, lastSeparator);
      const decimalPart = unsigned.slice(lastSeparator + 1);
      const hasMixedSeparators = lastDot !== -1 && lastComma !== -1;
      const looksLikeDecimal = /^\d{1,2}$/.test(decimalPart) && (hasMixedSeparators || decimalPart.length < 3);

      if (looksLikeDecimal) {
        normalized = `${integerPart.replace(/[.,]/g, "")}.${decimalPart}`;
      }
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed * sign : 0;
  };
  const normalizeText = (val) => (val ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const isType = (type, expected) => normalizeText(type) === normalizeText(expected);
  const isIncomeType = (type) => isType(type, 'Ingreso');
  const isSharedType = (type) => isType(type, 'Compartido');
  const isReceivableType = (type) => isType(type, 'Deuda') || isType(type, 'Préstamo');
  const isOwedByMeType = (type) => isType(type, 'Yo debo');
  const isCategory = (category, expected) => normalizeText(category) === normalizeText(expected);
  const includesNormalized = (value, pattern) => normalizeText(value).includes(normalizeText(pattern));
  const isCreditCardProjectionItem = (item) =>
    includesNormalized(item.category, 'tarjeta') ||
    includesNormalized(item.category, 'credito') ||
    PROJECTION_IGNORED_TYPES.some(type => isType(item.type, type));
  const projectionItemLabel = (item) => item.concept || item.title || item.category || 'Sin detalle';
  const isTCCreditOrPayment = (item) => parseRawNumber(item.amount) < 0;

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && u.email === "yocoimadejesus@gmail.com") {
        setUser(u);
      } else if (u) {
        signOut(auth);
        alert("Acceso denegado: Solo el administrador puede ingresar.");
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Error completo:", err);
      alert("Error al iniciar sesión: " + err.message);
    }
  };

  // --- TIPOS ---
  useEffect(() => {
    if (!user) return;
    const configRef = doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'config', 'types');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists() && snap.data().list?.length > 0) setMovTypes(snap.data().list);
    });
    return () => unsub();
  }, [user]);

  const saveTypes = async (newTypes) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'config', 'types'), { list: newTypes });
  };

  const addType = () => {
    const name = newTypeName.trim();
    if (!name || movTypes.includes(name)) return;
    const updated = [...movTypes, name];
    setMovTypes(updated);
    saveTypes(updated);
    setNewTypeName('');
  };

  const deleteType = (name) => {
    if (DEFAULT_TYPES.includes(name)) return;
    const updated = movTypes.filter(t => t !== name);
    setMovTypes(updated);
    saveTypes(updated);
  };

  useEffect(() => {
    if (!user) return;
    const configRef = doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'config', 'categories');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists() && snap.data().list?.length > 0) setMovCategories(snap.data().list);
    });
    return () => unsub();
  }, [user]);

  const saveCategories = async (newCats) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'config', 'categories'), { list: newCats });
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name || movCategories.includes(name)) return;
    const updated = [...movCategories, name];
    setMovCategories(updated);
    saveCategories(updated);
    setNewCategoryName('');
  };

  const deleteCategory = (name) => {
    if (DEFAULT_CATEGORIES.includes(name)) return;
    const updated = movCategories.filter(c => c !== name);
    setMovCategories(updated);
    saveCategories(updated);
  };

  // --- GASTOS FIJOS ---
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'config', 'fixed_expenses');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) setFixedExpenses(snap.data().expenses || []);
    });
    return () => unsub();
  }, [user]);

  const saveFixedExpenses = async (expenses) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'config', 'fixed_expenses'), { expenses });
  };

  const generateFinancialAdvice = async (dashByCat, dashByTyp, tots) => {
    setAiAdviceLoading(true);
    setAiAdviceError('');
    setAiAdvice(null);
    const monthName = currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
    const fmtN = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
    const catLines = dashByCat.map(({ cat, total }) => `  - ${cat}: ${fmtN(total)}`).join('\n');
    const typeLines = dashByTyp.map(({ type, total }) => `  - ${type}: ${fmtN(total)}`).join('\n');
    const saldo = tots.income - tots.indiv;
    const prompt = `Eres un asesor financiero personal experto. Analiza los datos del mes de ${monthName} y entrega consejos claros y accionables en español chileno.

RESUMEN FINANCIERO:
- Ingresos: ${fmtN(tots.income)}
- Mis gastos totales (mi parte): ${fmtN(tots.indiv)}
- Gastos compartidos totales: ${fmtN(tots.shared)}
- Saldo neto del mes: ${fmtN(saldo)}

MIS GASTOS POR CATEGORÍA:
${catLines || '  (sin datos)'}

MIS GASTOS POR TIPO:
${typeLines || '  (sin datos)'}

Responde SOLO con un JSON con esta estructura exacta (sin texto extra):
{
  "diagnostico": "2-3 oraciones evaluando el mes",
  "ahorro_recomendado": <número entero en CLP, sin formato>,
  "ahorro_porcentaje": <número entre 0 y 100>,
  "recomendaciones": ["consejo concreto 1", "consejo concreto 2", "consejo concreto 3"],
  "alertas": ["alerta si aplica"],
  "puntos_positivos": ["aspecto positivo si aplica"]
}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `Error ${response.status}`);
      }
      const result = await response.json();
      setAiAdvice(JSON.parse(result.choices[0].message.content));
    } catch (err) {
      setAiAdviceError(err.name === 'AbortError' ? 'Tiempo de espera agotado. Intenta de nuevo.' : err.message);
    } finally {
      setAiAdviceLoading(false);
    }
  };

  const handleAddFixed = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const newExp = {
      id: Date.now().toString(),
      concept: f.get('concept'),
      amount: parseRawNumber(f.get('amount')),
      type: f.get('type'),
      category: f.get('category'),
      startMonth: f.get('startMonth'),
      endMonth: f.get('endMonth') || null,
      paidMonths: []
    };
    const updated = [...fixedExpenses, newExp];
    setFixedExpenses(updated);
    saveFixedExpenses(updated);
    setShowFixedModal(false);
    e.target.reset();
  };

  const deleteFixedExpense = (id) => {
    const updated = fixedExpenses.filter(e => e.id !== id);
    setFixedExpenses(updated);
    saveFixedExpenses(updated);
  };

  const toggleFixedPaid = (id) => {
    const updated = fixedExpenses.map(exp => {
      if (exp.id !== id) return exp;
      const paidMonths = exp.paidMonths || [];
      return { ...exp, paidMonths: paidMonths.includes(monthKey) ? paidMonths.filter(m => m !== monthKey) : [...paidMonths, monthKey] };
    });
    setFixedExpenses(updated);
    saveFixedExpenses(updated);
  };

  const startEditFixed = (exp) => {
    setEditingFixedId(exp.id);
    setEditingFixedData({ concept: exp.concept, amount: String(exp.amount) });
  };

  const saveFixedEdit = (exp) => {
    const newAmount = parseInt(String(editingFixedData.amount).replace(/\D/g, ''), 10) || 0;
    const newConcept = editingFixedData.concept.trim() || exp.concept;
    const isShared = exp.type === 'Compartido';
    const newMyPart = isShared ? Math.round(newAmount / 2) : newAmount;
    const updated = fixedExpenses.map(e =>
      e.id === exp.id ? { ...e, concept: newConcept, amount: newAmount, myPart: newMyPart } : e
    );
    setFixedExpenses(updated);
    saveFixedExpenses(updated);
    setEditingFixedId(null);
    setEditingFixedData({});
  };

  // --- CUOTAS ---
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'config', 'installments');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setInstallmentPlans(snap.data().plans || []);
    });
    return () => unsub();
  }, [user]);

  const saveInstallmentPlans = async (plans) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'config', 'installments'), { plans });
  };

  const handleAddInstallment = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const totalAmount = parseRawNumber(f.get('totalAmount'));
    const installments = parseInt(f.get('installments'), 10);
    const monthlyAmount = Math.round(totalAmount / installments);
    const newPlan = {
      id: Date.now().toString(),
      concept: f.get('concept'),
      totalAmount,
      monthlyAmount,
      installments,
      startMonth: f.get('startMonth'),
      type: f.get('type'),
      category: f.get('category'),
      paidMonths: []
    };
    const updated = [...installmentPlans, newPlan];
    setInstallmentPlans(updated);
    saveInstallmentPlans(updated);
    setShowInstallmentModal(false);
    setInstTotal('');
    setInstCount('');
    e.target.reset();
  };

  const deleteInstallmentPlan = (id) => {
    const updated = installmentPlans.filter(p => p.id !== id);
    setInstallmentPlans(updated);
    saveInstallmentPlans(updated);
  };

  const toggleInstallmentPaid = (planId) => {
    const updated = installmentPlans.map(plan => {
      if (plan.id !== planId) return plan;
      const paidMonths = plan.paidMonths || [];
      return {
        ...plan,
        paidMonths: paidMonths.includes(monthKey)
          ? paidMonths.filter(m => m !== monthKey)
          : [...paidMonths, monthKey]
      };
    });
    setInstallmentPlans(updated);
    saveInstallmentPlans(updated);
  };

  const getInstallmentStatusForMonth = (plan, targetMonthKey = monthKey) => {
    const [currYear, currMonth] = targetMonthKey.split('-').map(Number);
    const [startYear, startMonthNum] = plan.startMonth.split('-').map(Number);
    const monthsElapsed = (currYear - startYear) * 12 + (currMonth - startMonthNum);
    const installmentNumber = monthsElapsed + 1;
    const isActive = installmentNumber >= 1 && installmentNumber <= plan.installments;
    const isFinished = installmentNumber > plan.installments;
    const isPaid = (plan.paidMonths || []).includes(targetMonthKey);
    const monthlyAmount = parseRawNumber(plan.monthlyAmount);
    const myPart = isSharedType(plan.type) ? monthlyAmount / 2 : (isIncomeType(plan.type) ? 0 : monthlyAmount);
    return { installmentNumber, isActive, isFinished, isPaid, myPart };
  };

  const addEvidence = async (file) => {
    if (!file) return;
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const newItem = { id: Date.now().toString(), imageBase64: base64, uploadedAt: new Date().toLocaleString('es-CL') };
    const updated = [...evidence, newItem];
    setEvidence(updated);
    saveToCloud(movements, balances, tcBatches, updated);
    if (evidenceInputRef.current) evidenceInputRef.current.value = '';
  };

  const deleteEvidence = (id) => {
    const updated = evidence.filter(e => e.id !== id);
    setEvidence(updated);
    saveToCloud(movements, balances, tcBatches, updated);
  };

  const latestAddEvidence = useRef(null);
  latestAddEvidence.current = addEvidence;

  useEffect(() => {
    if (!showEvidence) return;
    const handler = (e) => {
      if (e.target.closest('input, textarea, select')) return;
      const imageItem = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
      if (imageItem) latestAddEvidence.current(imageItem.getAsFile());
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [showEvidence]);

  const getActiveFixedExpensesForMonth = (targetMonthKey) => fixedExpenses.filter(exp => {
    if (exp.startMonth > targetMonthKey) return false;
    if (exp.endMonth && exp.endMonth < targetMonthKey) return false;
    return true;
  }).map(exp => {
    const amount = parseRawNumber(exp.amount);
    return {
      ...exp,
      amount,
      myPart: isSharedType(exp.type) ? amount / 2 : (isIncomeType(exp.type) ? 0 : amount),
      isPaid: (exp.paidMonths || []).includes(targetMonthKey),
      karlaIsPaid: (exp.karlaPaidMonths || []).includes(targetMonthKey)
    };
  });

  const getActiveInstallmentsForMonth = (targetMonthKey) => installmentPlans.map(plan => {
    const status = getInstallmentStatusForMonth(plan, targetMonthKey);
    if (!status.isActive) return null;
    const monthlyAmount = parseRawNumber(plan.monthlyAmount);
    return { ...plan, monthlyAmount, amount: monthlyAmount, ...status };
  }).filter(Boolean);

  const activeFixedExpenses = getActiveFixedExpensesForMonth(monthKey);
  const activeInstallments = getActiveInstallmentsForMonth(monthKey);

  const getPyramidRentCommission = (income) => Math.round(parseRawNumber(income) * 0.06 * 1.19);
  const getPyramidRentWithdrawalsTotal = (record) => (record.withdrawals || []).reduce((sum, item) => sum + parseRawNumber(item.amount), 0);
  const getPyramidRentMonthNet = (record) => {
    const rentIncome = parseRawNumber(record.rentIncome);
    const quarterlyAdjustment = parseRawNumber(record.quarterlyAdjustment);
    const dividendExpense = parseRawNumber(record.dividendExpense);
    return rentIncome + quarterlyAdjustment - getPyramidRentCommission(rentIncome) - dividendExpense;
  };

  const normalizePyramidRentRecord = (record = pyramidRent, targetMonthKey = monthKey) => {
    const defaults = createDefaultPyramidRent(targetMonthKey);
    if (record.entries) {
      const rentEntry = record.entries.find(item => includesNormalized(item.detail, 'arriendo')) || record.entries.find(item => parseRawNumber(item.income) > 0);
      const dividendEntry = record.entries.find(item => includesNormalized(item.detail, 'dividendo'));
      const adjustmentEntry = record.entries.find(item => includesNormalized(item.detail, 'ajuste'));
      return {
        ...defaults,
        rentIncome: parseRawNumber(rentEntry?.income),
        dividendExpense: parseRawNumber(dividendEntry?.expense),
        quarterlyAdjustment: parseRawNumber(adjustmentEntry?.expense),
        openingBankBalance: parseRawNumber(record.openingBankBalance ?? defaults.openingBankBalance),
        withdrawals: []
      };
    }

    return {
      ...defaults,
      rentIncome: parseRawNumber(record.rentIncome),
      dividendExpense: parseRawNumber(record.dividendExpense),
      quarterlyAdjustment: parseRawNumber(record.quarterlyAdjustment),
      openingBankBalance: parseRawNumber(record.openingBankBalance ?? defaults.openingBankBalance),
      withdrawals: (record.withdrawals || []).map(item => ({
        id: item.id || createGeneratedId(),
        detail: item.detail || '',
        amount: parseRawNumber(item.amount)
      }))
    };
  };

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!user || loading) return;
    setLoading(true);
    const docRef = doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'monthly_records', monthKey);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMovements(data.movements || []);
        setBalances(data.balances || { itau: 0, scotia: 0, edenred: 0, tc_deuda: 0 });
        setTcBatches(data.tcBatches || []);
        setEvidence(data.evidence || []);
        setPyramidRent(normalizePyramidRentRecord(data.pyramidRent || {}, monthKey));
        setProjectionItems((data.projection?.items || []).map(item => ({ ...item, amount: parseRawNumber(item.amount) })));
        setProjectionResult(data.projection?.result || null);
      } else {
        setMovements([]);
        setBalances({ itau: 0, scotia: 0, edenred: 0, tc_deuda: 0 });
        setTcBatches([]);
        setEvidence([]);
        setPyramidRent(createDefaultPyramidRent(monthKey));
        setProjectionItems([]);
        setProjectionResult(null);
      }
      setProjectionError('');
      setEditingProjectionItemId(null);
      setEditingProjectionItemData({ type: '', amount: '' });
      setLoading(false);
    }, (err) => setLoading(false));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const recordsRef = collection(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'monthly_records');
    const unsubscribe = onSnapshot(recordsRef, (snap) => {
      const nextHistory = {};
      snap.forEach(docSnap => {
        nextHistory[docSnap.id] = normalizePyramidRentRecord(docSnap.data().pyramidRent || {}, docSnap.id);
      });
      setPyramidRentHistory(nextHistory);
    });
    return () => unsubscribe();
  }, [user, monthKey]);

  const normalizeProjectionRecord = (projection = {}) => ({
    items: (projection.items || []).map(item => ({ ...item, amount: parseRawNumber(item.amount) })),
    result: projection.result || null,
    updatedAt: projection.updatedAt || new Date().toISOString()
  });

  const saveToCloud = async (
    newMovs,
    newBals,
    newBatches = tcBatches,
    newEvidence = evidence,
    newProjection = { items: projectionItems, result: projectionResult },
    newPyramidRent = pyramidRent
  ) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'monthly_records', monthKey), {
        movements: newMovs,
        balances: newBals,
        tcBatches: newBatches,
        evidence: newEvidence,
        pyramidRent: {
          ...normalizePyramidRentRecord(newPyramidRent),
          updatedAt: new Date().toISOString()
        },
        projection: normalizeProjectionRecord(newProjection),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error al guardar en Firebase:", err);
      alert("Error al sincronizar con la base de datos: " + err.message);
    }
  };

  // --- IA Y ACCIONES ---
  const processImage = async (file) => {
    if (!file) return;
    setIsScanning(true);
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 1024;
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width > height) { height = (height / width) * maxSize; width = maxSize; }
            else { width = (width / height) * maxSize; height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        };
        img.onerror = reject;
        img.src = url;
      });

      const prompt = "Analiza esta boleta o factura. Extrae estrictamente un objeto JSON con este formato: {\"concept\": \"nombre del comercio o producto principal\", \"amount\": valor_total_numerico, \"category\": \"una de las categorías permitidas\"}. Categorías: Comida, Gastos fijos, Cuentas, Transporte, Diversión, Otros. Responde SOLO con el JSON, sin texto adicional.";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
            ]
          }],
          response_format: { type: "json_object" }
        })
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `Error ${response.status} en la petición a la IA`);
      }

      const result = await response.json();
      if (!result.choices || result.choices.length === 0) {
        throw new Error("La IA no devolvió resultados. Puede que la imagen sea ilegible.");
      }

      let cleanText = result.choices[0].message?.content || "";
      cleanText = cleanText.replace(/```json|```/g, "").trim();
      const data = JSON.parse(cleanText);
      
      const newMov = {
        id: Date.now().toString(),
        concept: data.concept || "Escaneado",
        amount: data.amount || 0,
        type: 'Compartido',
        category: data.category || "Otros",
        myPart: (data.amount || 0) / 2,
        date: new Date().toLocaleDateString('es-CL'),
        isPaid: false
      };
      const updated = [...movements, newMov];
      setMovements(updated);
      saveToCloud(updated, balances);

    } catch (err) { 
      console.error("Error procesando boleta:", err);
      alert("Error al procesar la boleta: " + err.message);
    } finally { setIsScanning(false); }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const amt = parseRawNumber(f.get('amount'));
    const type = f.get('type');
    const newMov = {
      id: Date.now().toString(),
      concept: f.get('concept'),
      amount: amt,
      type: type,
      category: f.get('category'),
      myPart: isSharedType(type) ? amt / 2 : (isIncomeType(type) ? 0 : amt),
      date: new Date().toLocaleDateString('es-CL'),
      isPaid: false
    };
    const updated = [...movements, newMov];
    setMovements(updated);
    saveToCloud(updated, balances);
    e.target.reset();
  };

  const handleUpdate = (id, field, value) => {
    setMovements(prev => prev.map(m => {
      if (m.id !== id) return m;
      const newObj = { ...m, [field]: value };
      if (field === 'amount' || field === 'type') {
        const amt = field === 'amount' ? parseRawNumber(value) : m.amount;
        const type = field === 'type' ? value : m.type;
        newObj.amount = amt;
        newObj.myPart = isSharedType(type) ? amt / 2 : (isIncomeType(type) ? 0 : amt);
      }
      return newObj;
    }));
  };

  const handlePayTC = (bank) => {
    const amountToPay = balances.tc_deuda;
    const newBalances = { ...balances, [bank]: balances[bank] - amountToPay, tc_deuda: 0 };
    setBalances(newBalances);
    saveToCloud(movements, newBalances);
    setShowTCPaymentModal(false);
  };

  const copyDebtDetails = () => {
    const pending = movements.filter(m => (m.type==='Compartido'||m.type==='Deuda'||m.type==='Préstamo'||m.type==='Yo debo') && !m.isPaid);
    const pendingInst = activeInstallments.filter(inst => (inst.type==='Compartido'||inst.type==='Préstamo'||inst.type==='Yo debo') && !inst.isPaid);
    const pendingFixed = activeFixedExpenses.filter(exp => (exp.type==='Compartido'||exp.type==='Préstamo'||exp.type==='Yo debo') && !exp.karlaIsPaid);
    const movText = pending.map(m => {
      const part = m.type === 'Compartido' ? m.amount / 2 : (m.type === 'Yo debo' ? -m.amount : m.amount);
      return `• ${m.concept}: ${formatCLP(part)}`;
    });
    const instText = pendingInst.map(inst => {
      const part = inst.type === 'Compartido' ? inst.monthlyAmount / 2 : (inst.type === 'Yo debo' ? -inst.monthlyAmount : inst.monthlyAmount);
      return `• ${inst.concept} (cuota ${inst.installmentNumber}/${inst.installments}): ${formatCLP(part)}`;
    });
    const fixedText = pendingFixed.map(exp => {
      const part = exp.type === 'Compartido' ? exp.amount / 2 : (exp.type === 'Yo debo' ? -exp.amount : exp.amount);
      return `• ${exp.concept} (fijo): ${formatCLP(part)}`;
    });
    const text = [...movText, ...instText, ...fixedText].join('\n');
    const movTotal = pending.reduce((acc, m) => acc + (m.type === 'Compartido' ? m.amount / 2 : (m.type === 'Yo debo' ? -m.amount : m.amount)), 0);
    const instTotal2 = pendingInst.reduce((acc, inst) => acc + (inst.type === 'Compartido' ? inst.monthlyAmount / 2 : (inst.type === 'Yo debo' ? -inst.monthlyAmount : inst.monthlyAmount)), 0);
    const fixedTotal = pendingFixed.reduce((acc, exp) => acc + (exp.type === 'Compartido' ? exp.amount / 2 : (exp.type === 'Yo debo' ? -exp.amount : exp.amount)), 0);
    const total = movTotal + instTotal2 + fixedTotal;
    const finalMsg = `📝 *Detalle Deuda - ${currentDate.toLocaleString('es-CL', { month: 'long' })}*\n\n${text}\n\n*Total a pagar: ${formatCLP(total)}*`;
    
    navigator.clipboard.writeText(finalMsg);

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadMockData = () => {
    const mockData = [
      { id: Date.now().toString() + "1", concept: "Sueldo", amount: 1872447, type: "Ingreso", category: "Sueldo", myPart: 0, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "2", concept: "Dividendo lo ovalle", amount: 324248, type: "Individual", category: "Gastos fijos", myPart: 324248, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "3", concept: "TC Viaje", amount: 253691, type: "Compartido", category: "Gastos fijos", myPart: 126845.5, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "4", concept: "Consumo Scotiabank", amount: 211353, type: "Individual", category: "Gastos fijos", myPart: 211353, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "5", concept: "Youtube", amount: 7145, type: "Individual", category: "Gastos fijos", myPart: 7145, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "6", concept: "Mamá", amount: 225000, type: "Individual", category: "Gastos fijos", myPart: 225000, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "7", concept: "Gasto Común", amount: 119580, type: "Compartido", category: "Cuentas", myPart: 59790, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "8", concept: "Luz Enel", amount: 59606, type: "Compartido", category: "Cuentas", myPart: 29803, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "9", concept: "Agua", amount: 28280, type: "Compartido", category: "Cuentas", myPart: 14140, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "10", concept: "Entel + Netflix", amount: 19180, type: "Individual", category: "Gastos fijos", myPart: 19180, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "11", concept: "Gas", amount: 21489, type: "Compartido", category: "Cuentas", myPart: 10744.5, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "12", concept: "Internet Movistar", amount: 19623, type: "Compartido", category: "Cuentas", myPart: 9811.5, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "13", concept: "Autopista Moto", amount: 5100, type: "Individual", category: "Transporte", myPart: 5100, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "14", concept: "Autopista Moto 2", amount: 4962, type: "Individual", category: "Transporte", myPart: 4962, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "15", concept: "Gasolina", amount: 29262, type: "Compartido", category: "Transporte", myPart: 14631, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "16", concept: "Compras Lider", amount: 13476, type: "Compartido", category: "Comida", myPart: 6738, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "17", concept: "Distribuidora Lachina", amount: 48550, type: "Compartido", category: "Comida", myPart: 24275, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "18", concept: "MercadoLibre", amount: 11242, type: "Compartido", category: "Otros", myPart: 5621, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "19", concept: "Ekono Lo Ovalle", amount: 2440, type: "Compartido", category: "Comida", myPart: 1220, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "20", concept: "Yofreguillena", amount: 12600, type: "Compartido", category: "Comida", myPart: 6300, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "21", concept: "Jumbo El Llano", amount: 272833, type: "Compartido", category: "Comida", myPart: 136416.5, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "22", concept: "Carnes Montes", amount: 40760, type: "Compartido", category: "Comida", myPart: 20380, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "23", concept: "Mall Portal El Llano", amount: 2400, type: "Compartido", category: "Otros", myPart: 1200, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "24", concept: "Mport Export", amount: 27160, type: "Compartido", category: "Transporte", myPart: 13580, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "25", concept: "Frutos del Pais", amount: 7300, type: "Compartido", category: "Comida", myPart: 3650, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "26", concept: "Box Franklin Estac.", amount: 1700, type: "Compartido", category: "Otros", myPart: 850, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "27", concept: "Edenred", amount: 159686, type: "Compartido", category: "Gastos fijos", myPart: 79843, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "28", concept: "Quincho Parque", amount: 7000, type: "Préstamo", category: "Diversión", myPart: 7000, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "29", concept: "Medicina Tampax Karla", amount: 7619, type: "Préstamo", category: "Otros", myPart: 7619, date: new Date().toLocaleDateString('es-CL'), isPaid: false },
      { id: Date.now().toString() + "30", concept: "Tag Carro", amount: 10479, type: "Individual", category: "Transporte", myPart: 10479, date: new Date().toLocaleDateString('es-CL'), isPaid: false }
    ];
    
    const updated = [...movements, ...mockData];
    setMovements(updated);
    saveToCloud(updated, balances);
  };

  const toggleBatchExpand = (batchId) => {
    setExpandedBatches(prev => 
      prev.includes(batchId) 
        ? prev.filter(id => id !== batchId) 
        : [...prev, batchId]
    );
  };

  const handleUpdateBatch = (id, field, value) => {
    setTcBatches(prev => prev.map(batch => {
      if (batch.id === id) {
        return { ...batch, [field]: value };
      }
      return batch;
    }));
  };

  const toggleTCItemExclusion = (batchId, itemId) => {
    const updated = tcBatches.map(batch => {
      if (batch.id !== batchId) return batch;
      return {
        ...batch,
        items: batch.items.map(item =>
          item.id === itemId ? { ...item, isExcluded: !item.isExcluded } : item
        )
      };
    });
    setTcBatches(updated);
    saveToCloud(movements, balances, updated);
  };

  const handleTCImport = (e) => {
    e.preventDefault();
    const text = e.target.tcData.value;
    const title = e.target.tcTitle.value;
    const comment = e.target.tcComment.value;
    const rawLines = text.split('\n');
    const items = [];
    const dateRe = /^\d{2}\/\d{2}\/\d{4}/;
    const parseAmount = (str) => parseInt(str.replace(/[$. ]/g, ''), 10) || 0;
    const buildTCItem = ({ date, concept, amount }) => ({
      id: Date.now().toString() + Math.random(),
      date,
      concept,
      amount,
      type: isTCCreditOrPayment({ amount }) ? 'Pago TC' : 'Individual',
      category: 'Tarjeta Crédito',
      myPart: isTCCreditOrPayment({ amount }) ? 0 : amount,
      isPaid: false,
      isExcluded: isTCCreditOrPayment({ amount })
    });

    let i = 0;
    while (i < rawLines.length) {
      const line = rawLines[i];
      const parts = line.split('\t');
      const firstCol = parts[0].trim();

      if (!line.trim() || firstCol.toLowerCase().includes('fecha')) { i++; continue; }

      if (dateRe.test(firstCol)) {
        if (parts.length >= 4 && parts[3].trim()) {
          // Formato estándar: FECHA\tDESC\tCIUDAD\tMONTO
          const rawAmount = parseAmount(parts[3]);
          if (rawAmount !== 0) items.push(buildTCItem({
            date: firstCol,
            concept: parts[1].trim(),
            amount: rawAmount
          }));
          i++;
        } else {
          // Formato multilínea: fecha sola, descripción y monto en líneas siguientes
          const descLines = parts[1]?.trim() ? [parts[1].trim()] : [];
          let rawAmount = null;
          i++;
          while (i < rawLines.length && rawAmount === null) {
            const next = rawLines[i].trim();
            if (!next) { i++; continue; }
            if (dateRe.test(next.split('\t')[0])) break;
            const amountMatch = next.match(/\$\s*(-?[\d.]+)/);
            if (amountMatch) {
              rawAmount = parseInt(amountMatch[1].replace(/\./g, ''), 10);
              i++;
              break;
            }
            descLines.push(next.replace(/\t/g, ' ').trim());
            i++;
          }
          if (rawAmount !== null && rawAmount !== 0) items.push(buildTCItem({
            date: firstCol,
            concept: descLines.join(' ').trim() || 'Sin descripción',
            amount: rawAmount
          }));
        }
      } else {
        i++;
      }
    }

    if (items.length > 0) {
      const newBatch = { id: Date.now().toString(), date: new Date().toLocaleString(), items, title, comment };
      const updatedBatches = [...tcBatches, newBatch];
      setTcBatches(updatedBatches);
      saveToCloud(movements, balances, updatedBatches);
      setShowTCImportModal(false);
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Concepto', 'Monto', 'Tipo', 'Categoria', 'Mi Parte', 'Fecha', 'Pagado'];
    const rows = movements.map(m => [
      m.id, m.concept, m.amount, m.type, m.category, m.myPart, m.date, m.isPaid ? 'Sí' : 'No'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gastos_${monthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importCSV = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const rows = text.split('\n').slice(1);
        const newMovs = rows.filter(r => r.trim()).map(r => {
          const cols = r.split(',');
          return {
            id: cols[0] || Date.now().toString() + Math.random().toString(),
            concept: cols[1] || 'Importado',
            amount: parseRawNumber(cols[2] || 0),
            type: cols[3] || 'Individual',
            category: cols[4] || 'Otros',
            myPart: parseRawNumber(cols[5] || 0),
            date: cols[6] || new Date().toLocaleDateString('es-CL'),
            isPaid: cols[7] === 'Sí'
          };
        });
        const updated = [...movements, ...newMovs];
        setMovements(updated);
        await saveToCloud(updated, balances);
      } catch (error) {
        console.error("Error importando datos:", error);
      }
    };
    reader.readAsText(file);
    if(csvInputRef.current) csvInputRef.current.value = ''; // Resetear el input
  };

  const withSource = (items, source) => items.map(item => ({ ...item, source }));
  const allMovements = [
    ...withSource(movements, 'Movimiento'),
    ...withSource(activeInstallments, 'Cuota'),
    ...withSource(activeFixedExpenses, 'Fijo')
  ];
  const getAmount = (m) => parseRawNumber(m.amount);
  const getMyPart = (m) => {
    const amount = getAmount(m);
    if (isIncomeType(m.type) || isReceivableType(m.type)) return 0;
    if (isSharedType(m.type)) return m.myPart !== undefined ? parseRawNumber(m.myPart) : amount / 2;
    return m.myPart !== undefined ? parseRawNumber(m.myPart) : amount;
  };
  const getProjectionExpenseAmount = (item) => {
    if (isIncomeType(item.type) || isReceivableType(item.type)) return 0;
    if (item.myPart !== undefined) return parseRawNumber(item.myPart);
    return getMyPart(item);
  };

  const addProjectionDetail = (acc, group, item, amount) => {
    acc.details[group].push({
      id: item.id || `${group}-${acc.details[group].length}`,
      concept: projectionItemLabel(item),
      amount,
      source: item.source || 'Movimiento',
      category: item.category || ''
    });
  };

  const getProjectionSummary = (items) => items.reduce((acc, item) => {
    if (isCreditCardProjectionItem(item)) return acc;

    if (isIncomeType(item.type)) {
      acc.income += getAmount(item);
      return acc;
    }

    const amount = getProjectionExpenseAmount(item);
    if (amount <= 0) return acc;

    const category = item.category || '';
    if (item.source === 'Fijo' || item.source === 'Cuota') {
      acc.fixed += amount;
      addProjectionDetail(acc, 'fixed', item, amount);
    } else if (PROJECTION_VARIABLE_CATEGORIES.some(cat => isCategory(category, cat))) {
      acc.variable += amount;
      if (isCategory(category, 'Comida')) {
        acc.food += amount;
        addProjectionDetail(acc, 'food', item, amount);
      }
      if (isCategory(category, 'Transporte')) {
        acc.transport += amount;
        addProjectionDetail(acc, 'transport', item, amount);
      }
    } else if (PROJECTION_FIXED_CATEGORIES.some(cat => isCategory(category, cat))) {
      acc.fixed += amount;
      addProjectionDetail(acc, 'fixed', item, amount);
    } else {
      acc.other += amount;
      addProjectionDetail(acc, 'other', item, amount);
    }

    return acc;
  }, {
    income: 0,
    fixed: 0,
    variable: 0,
    food: 0,
    transport: 0,
    other: 0,
    details: { fixed: [], food: [], transport: [], other: [] }
  });

  const persistProjection = async (items, result) => {
    await saveToCloud(movements, balances, tcBatches, evidence, {
      items,
      result,
      updatedAt: new Date().toISOString()
    }, pyramidRent);
  };

  const savePyramidRentRecord = async (nextRecord) => {
    await saveToCloud(
      movements,
      balances,
      tcBatches,
      evidence,
      { items: projectionItems, result: projectionResult },
      nextRecord
    );
  };

  const updatePyramidRentRecord = async (updater) => {
    const nextRecord = typeof updater === 'function' ? updater(pyramidRent) : updater;
    setPyramidRent(nextRecord);
    await savePyramidRentRecord(nextRecord);
  };

  const updatePyramidRentField = async (field, value) => {
    const nextRecord = { ...pyramidRent, [field]: parseRawNumber(value) };
    setPyramidRent(nextRecord);
    await savePyramidRentRecord(nextRecord);
  };

  const handlePyramidRentFieldChange = (field, value) => {
    setPyramidRent(prev => ({ ...prev, [field]: parseRawNumber(value) }));
  };

  const handlePyramidRentWithdrawalChange = (id, field, value) => {
    const normalizedValue = field === 'detail' ? value : parseRawNumber(value);
    setPyramidRent(prev => ({
      ...prev,
      withdrawals: prev.withdrawals.map(item => item.id === id ? { ...item, [field]: normalizedValue } : item)
    }));
  };

  const savePyramidRent = async () => {
    await savePyramidRentRecord(pyramidRent);
  };

  const addPyramidRentWithdrawal = async () => {
    await updatePyramidRentRecord(prev => ({
      ...prev,
      withdrawals: [...prev.withdrawals, createEmptyPyramidRentWithdrawal()]
    }));
  };

  const deletePyramidRentWithdrawal = async (id) => {
    await updatePyramidRentRecord(prev => ({
      ...prev,
      withdrawals: prev.withdrawals.filter(item => item.id !== id)
    }));
  };

  const addProjectionItem = async (e) => {
    e.preventDefault();
    const amount = parseRawNumber(projectionAmount);
    if (amount <= 0) return;
    const updated = [...projectionItems, { id: Date.now().toString(), type: projectionType, amount }];
    setProjectionItems(updated);
    setProjectionAmount('');
    setProjectionResult(null);
    setProjectionError('');
    await persistProjection(updated, null);
  };

  const removeProjectionItem = async (id) => {
    const updated = projectionItems.filter(item => item.id !== id);
    setProjectionItems(updated);
    setProjectionResult(null);
    if (editingProjectionItemId === id) {
      setEditingProjectionItemId(null);
      setEditingProjectionItemData({ type: '', amount: '' });
    }
    await persistProjection(updated, null);
  };

  const startEditProjectionItem = (item) => {
    setEditingProjectionItemId(item.id);
    setEditingProjectionItemData({ type: item.type, amount: formatInputNumber(item.amount) });
  };

  const cancelEditProjectionItem = () => {
    setEditingProjectionItemId(null);
    setEditingProjectionItemData({ type: '', amount: '' });
  };

  const saveProjectionItemEdit = async (id) => {
    const amount = parseRawNumber(editingProjectionItemData.amount);
    if (amount <= 0) return;
    const updated = projectionItems.map(item =>
      item.id === id ? { ...item, type: editingProjectionItemData.type, amount } : item
    );
    setProjectionItems(updated);
    setProjectionResult(null);
    setProjectionError('');
    cancelEditProjectionItem();
    await persistProjection(updated, null);
  };

  const calculateExpenseProjection = async () => {
    setProjectionLoading(true);
    setProjectionError('');
    try {
      const summary = getProjectionSummary(allMovements);
      const specialTotal = projectionItems.reduce((sum, item) => sum + parseRawNumber(item.amount), 0);

      const income = summary.income;
      const fixed = summary.fixed;
      const food = summary.food;
      const transport = summary.transport;
      const other = summary.other;
      const expenses = fixed + food + transport + other + specialTotal;

      const result = {
        monthName: currentDate.toLocaleString('es-CL', { month: 'long' }),
        monthKey,
        income: Math.round(income),
        expenses: Math.round(expenses),
        balance: Math.round(income - expenses),
        breakdown: {
          fixed: Math.round(fixed),
          food: Math.round(food),
          transport: Math.round(transport),
          other: Math.round(other),
          special: Math.round(specialTotal)
        },
        detailItems: {
          fixed: summary.details.fixed,
          food: summary.details.food,
          transport: summary.details.transport,
          other: summary.details.other
        },
        specialExpenses: projectionItems.map(item => ({ ...item, amount: parseRawNumber(item.amount) })),
        generatedAt: new Date().toISOString()
      };
      setProjectionResult(result);
      await persistProjection(projectionItems, result);
    } catch (err) {
      setProjectionError('No se pudo calcular la proyeccion. Intenta nuevamente.');
    } finally {
      setProjectionLoading(false);
    }
  };

  const totals = allMovements.reduce((acc, m) => {
    const amount = getAmount(m);
    const karlaIsPaid = m.karlaIsPaid !== undefined ? m.karlaIsPaid : m.isPaid;

    if (isIncomeType(m.type)) {
      acc.income += amount;
    } else {
      acc.indiv += getMyPart(m);
      if (isSharedType(m.type)) acc.shared += amount;
    }

    if (!karlaIsPaid) {
      if (isSharedType(m.type) || isReceivableType(m.type))
        acc.debt += (isSharedType(m.type) ? amount / 2 : amount);
      else if (isOwedByMeType(m.type))
        acc.debt -= amount;
    }
    return acc;
  }, { income: 0, indiv: 0, shared: 0, debt: 0 });

  const totalsDetail = allMovements.map((m, index) => {
    const amount = getAmount(m);
    const myPart = getMyPart(m);
    return {
      key: `${m.source || 'item'}-${m.id || index}-${index}`,
      source: m.source || 'Movimiento',
      concept: m.concept || 'Sin detalle',
      type: m.type || 'Sin tipo',
      amount,
      myPart,
      incomeValue: isIncomeType(m.type) ? amount : 0,
      personalValue: isIncomeType(m.type) ? 0 : myPart
    };
  });
  const incomeDetail = totalsDetail.filter(item => item.incomeValue !== 0);
  const personalDetail = totalsDetail.filter(item => item.personalValue !== 0);

  const CHART_COLORS = ['#3b82f6','#8b5cf6','#f97316','#10b981','#ec4899','#f59e0b','#06b6d4','#6366f1','#14b8a6','#f43f5e'];
  const TYPE_COLORS = { 'Compartido': '#3b82f6', 'Individual': '#8b5cf6', 'Yo debo': '#ef4444', 'Préstamo': '#f59e0b', 'Ingreso': '#10b981' };

  const historyItemCount = movements.length + activeInstallments.length + activeFixedExpenses.length;
  const dashMovements = allMovements.filter(m => !isIncomeType(m.type) && getMyPart(m) > 0);

  const dashByCategory = [...movCategories, ...dashMovements.map(m => m.category).filter(c => c && !movCategories.includes(c))]
    .reduce((acc, cat) => {
      const total = dashMovements.filter(m => m.category === cat).reduce((s, m) => s + getMyPart(m), 0);
      if (total > 0) acc.push({ cat, total });
      return acc;
    }, []).sort((a, b) => b.total - a.total);

  const dashByType = movTypes.filter(t => !isIncomeType(t)).reduce((acc, type) => {
    const total = dashMovements.filter(m => isType(m.type, type)).reduce((s, m) => s + getMyPart(m), 0);
    if (total > 0) acc.push({ type, total });
    return acc;
  }, []).sort((a, b) => b.total - a.total);

  const dashTop5 = dashMovements
    .map(m => ({ concept: m.concept, amount: getMyPart(m), type: m.type, category: m.category }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowRightLeft size={10} className="inline ml-1 opacity-20 rotate-90" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={10} className="inline ml-1 text-blue-600" /> : <ChevronDown size={10} className="inline ml-1 text-blue-600" />;
  };

  const sortedMovements = [...movements].sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
    if (!sortConfig.key) return b.id.localeCompare(a.id);
    
    let aVal = a[sortConfig.key === 'Total' ? 'amount' : sortConfig.key === 'Detalle' ? 'concept' : sortConfig.key === 'Tipo' ? 'type' : sortConfig.key === 'Mi Parte' ? 'myPart' : sortConfig.key];
    let bVal = b[sortConfig.key === 'Total' ? 'amount' : sortConfig.key === 'Detalle' ? 'concept' : sortConfig.key === 'Tipo' ? 'type' : sortConfig.key === 'Mi Parte' ? 'myPart' : sortConfig.key];

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalBancos = balances.itau + balances.scotia;
  const liquidezReal = totalBancos - balances.tc_deuda;
  const currentPyramidRentRecord = normalizePyramidRentRecord(pyramidRent);
  const pyramidRentCommission = getPyramidRentCommission(currentPyramidRentRecord.rentIncome);
  const pyramidRentIncome = parseRawNumber(currentPyramidRentRecord.rentIncome) + parseRawNumber(currentPyramidRentRecord.quarterlyAdjustment);
  const pyramidRentExpense = pyramidRentCommission + parseRawNumber(currentPyramidRentRecord.dividendExpense);
  const pyramidRentNet = getPyramidRentMonthNet(currentPyramidRentRecord);
  const pyramidRentWithdrawalsTotal = getPyramidRentWithdrawalsTotal(currentPyramidRentRecord);
  const pyramidRentRecordsByMonth = {
    ...pyramidRentHistory,
    [monthKey]: currentPyramidRentRecord
  };
  const pyramidRentSortedMonthKeys = Object.keys(pyramidRentRecordsByMonth)
    .filter(key => /^\d{4}-\d{2}$/.test(key))
    .sort();
  let runningPyramidUtility = 0;
  const pyramidUtilityByMonth = {};
  let lastAdjustmentMonthKey = null;
  pyramidRentSortedMonthKeys.forEach(key => {
    const record = normalizePyramidRentRecord(pyramidRentRecordsByMonth[key] || {}, key);
    runningPyramidUtility += parseRawNumber(record.openingBankBalance) + getPyramidRentMonthNet(record) - getPyramidRentWithdrawalsTotal(record);
    pyramidUtilityByMonth[key] = runningPyramidUtility;
    if (parseRawNumber(record.quarterlyAdjustment) > 0) {
      lastAdjustmentMonthKey = key;
    }
  });
  const pyramidRentAccumulatedUtility = pyramidUtilityByMonth[monthKey] || 0;
  const monthsSinceAdjustment = lastAdjustmentMonthKey
    ? ((dateFromMonthKey(monthKey).getFullYear() - dateFromMonthKey(lastAdjustmentMonthKey).getFullYear()) * 12)
      + (dateFromMonthKey(monthKey).getMonth() - dateFromMonthKey(lastAdjustmentMonthKey).getMonth())
    : null;
  const pyramidRentNeedsAdjustmentReminder = monthsSinceAdjustment !== null && monthsSinceAdjustment >= 3 && parseRawNumber(currentPyramidRentRecord.quarterlyAdjustment) === 0;
  const pyramidRentMonthLabel = currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
  const pyramidRentRentLabel = `arriendo ${getMonthName(currentDate)}`;

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40}/>
      <p className="font-bold text-slate-500">Sincronizando...</p>
    </div>
  );

  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200 text-center max-w-sm w-full">
        <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-black mb-2">Gastos Pro</h2>
        <p className="text-slate-500 text-sm mb-8 font-medium">Acceso restringido. Por favor inicia sesión.</p>
        <button onClick={handleLogin} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all">
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="G" />
          ENTRAR CON GOOGLE
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans antialiased">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b px-4 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg"><ReceiptText size={22}/></div>
            <h1 className="font-black text-xl tracking-tight hidden sm:block">Gastos Pro</h1>
            
            <input type="file" accept=".csv" ref={csvInputRef} onChange={(e) => importCSV(e.target.files[0])} className="hidden" />
            <button onClick={() => csvInputRef.current?.click()} className="ml-2 p-1.5 bg-white text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1 shadow-sm" title="Importar CSV">
              <Upload size={16} /> <span className="text-[10px] font-black uppercase hidden lg:inline">Importar</span>
            </button>
            <button onClick={exportCSV} className="p-1.5 bg-white text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1 shadow-sm" title="Exportar CSV">
              <Download size={16} /> <span className="text-[10px] font-black uppercase hidden lg:inline">Exportar</span>
            </button>

            <button onClick={() => setShowTypesModal(true)} className="p-1.5 bg-slate-50 text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-1 shadow-sm" title="Gestionar tipos">
              <Settings size={16} /> <span className="text-[10px] font-black uppercase hidden lg:inline">Tipos</span>
            </button>
            <button onClick={() => setShowProjectionModal(true)} className="p-1.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center gap-1 shadow-sm" title="Proyeccion de gastos">
              <Calculator size={16} /> <span className="text-[10px] font-black uppercase hidden lg:inline">Proyeccion</span>
            </button>
            <button onClick={() => signOut(auth)} className="ml-2 p-1.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-all flex items-center gap-1 shadow-sm" title="Cerrar Sesión">
              <LogOut size={16} /> <span className="text-[10px] font-black uppercase hidden lg:inline">Salir</span>
            </button>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft size={20}/></button>
            <div className="px-4 py-1 flex flex-col items-center min-w-[130px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Periodo</span>
              <span className="text-sm font-bold capitalize">{currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' })}</span>
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight size={20}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6">
        {/* Balances e Indicadores */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
          {['itau', 'scotia', 'edenred'].map(b => (
            <div key={b} className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">{b}</label>
              <input type="text" value={formatInputNumber(balances[b])} onChange={(e) => {
                const newBals = {...balances, [b]: parseRawNumber(e.target.value)};
                setBalances(newBals); saveToCloud(movements, newBals);
              }} className="w-full font-bold text-lg outline-none bg-transparent" />
            </div>
          ))}
          <div className="bg-white p-4 rounded-[2rem] border border-red-100 shadow-sm relative group">
            <label className="text-[10px] font-black text-red-400 uppercase block mb-1">Deuda TC</label>
            <div className="flex items-center justify-between">
              <input type="text" value={formatInputNumber(balances.tc_deuda)} onChange={(e) => {
                const newBals = {...balances, tc_deuda: parseRawNumber(e.target.value)};
                setBalances(newBals); saveToCloud(movements, newBals);
              }} className="w-full font-bold text-lg outline-none bg-transparent text-red-600" />
              {balances.tc_deuda > 0 && (
                <button onClick={() => setShowTCPaymentModal(true)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all ml-1"><ArrowRightLeft size={16}/></button>
              )}
            </div>
          </div>
          <div className="bg-slate-100 p-4 rounded-[2rem] border border-slate-200 flex flex-col justify-center">
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Total Bancos</label>
            <div className="text-lg font-bold text-slate-700">{formatCLP(totalBancos)}</div>
          </div>
          <div className={`p-4 rounded-[2rem] flex flex-col justify-center border-2 transition-all ${liquidezReal < 0 ? 'bg-red-600 border-red-700 text-white' : 'bg-blue-600 border-blue-700 text-white'}`}>
            <label className="text-[10px] font-black opacity-70 uppercase block mb-1">Liquidez Real</label>
            <div className="text-lg font-black">{formatCLP(liquidezReal)}</div>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="bg-green-50/50 p-5 rounded-[2rem] border border-green-100">
            <p className="text-[10px] text-green-600 font-black uppercase mb-1">Ingresos</p>
            <p className="text-2xl font-black text-green-700">{formatCLP(totals.income)}</p>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200">
            <p className="text-[10px] text-blue-400 font-black uppercase mb-1">Personal</p>
            <p className="text-2xl font-black text-slate-700">{formatCLP(totals.indiv)}</p>
          </div>
          <div className="bg-orange-50/50 p-5 rounded-[2rem] border border-orange-100">
            <p className="text-[10px] text-orange-600 font-black uppercase mb-1">Compartido</p>
            <p className="text-2xl font-black text-orange-700">{formatCLP(totals.shared)}</p>
          </div>
          <div className="bg-blue-600 p-5 rounded-[2rem] text-white shadow-xl shadow-blue-100 ring-4 ring-white">
            <p className="text-[10px] font-black uppercase mb-1 text-blue-200 tracking-wider">A Cobrar</p>
            <p className="text-2xl font-black">{formatCLP(totals.debt)}</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase text-emerald-700 mb-1">Proyeccion del mes</p>
              {projectionResult ? (
                <p className="text-sm text-slate-600 font-medium">
                  Para <span className="font-black capitalize text-slate-800">{projectionResult.monthName}</span> estimas gastar <span className="font-black text-slate-900">{formatCLP(projectionResult.expenses)}</span>, ingresar <span className="font-black text-green-700">{formatCLP(projectionResult.income)}</span> y quedar con <span className={`font-black ${projectionResult.balance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCLP(projectionResult.balance)}</span>.
                </p>
              ) : (
                <p className="text-sm text-slate-400 font-medium">Sin proyeccion generada para este mes.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {projectionResult && (
                <>
                  <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Gasto</p>
                    <p className="text-sm font-black text-slate-800">{formatCLP(projectionResult.expenses)}</p>
                  </div>
                  <div className="px-3 py-2 bg-green-50 rounded-xl border border-green-100">
                    <p className="text-[9px] font-black text-green-600 uppercase">Ingreso</p>
                    <p className="text-sm font-black text-green-700">{formatCLP(projectionResult.income)}</p>
                  </div>
                  <div className={`px-3 py-2 rounded-xl border ${projectionResult.balance < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className={`text-[9px] font-black uppercase ${projectionResult.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Saldo</p>
                    <p className={`text-sm font-black ${projectionResult.balance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatCLP(projectionResult.balance)}</p>
                  </div>
                </>
              )}
              <button onClick={() => setShowProjectionModal(true)} className="px-4 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all flex items-center gap-2">
                <Calculator size={14}/> {projectionResult ? 'Actualizar' : 'Generar'}
              </button>
            </div>
          </div>
        </div>

        <details open className="bg-white rounded-[2rem] border border-slate-200 shadow-sm mb-8 overflow-hidden">
          <summary className="cursor-pointer select-none px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50/70">
            Detalle cálculo del resumen
          </summary>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            <div className="p-5">
              <div className="flex justify-between items-baseline mb-3">
                <h3 className="text-xs font-black uppercase text-green-700">Ingresos detectados</h3>
                <span className="font-black text-green-700">{formatCLP(totals.income)}</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                {incomeDetail.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Sin ingresos detectados en este periodo</p>
                ) : incomeDetail.map(item => (
                  <div key={item.key} className="py-3 flex justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{item.concept}</p>
                      <p className="text-[9px] font-black uppercase text-slate-400">{item.source} · {item.type}</p>
                    </div>
                    <span className="font-black text-green-700 whitespace-nowrap">{formatCLP(item.incomeValue)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5">
              <div className="flex justify-between items-baseline mb-3">
                <h3 className="text-xs font-black uppercase text-blue-500">Personal detectado</h3>
                <span className="font-black text-slate-700">{formatCLP(totals.indiv)}</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                {personalDetail.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Sin gastos personales detectados en este periodo</p>
                ) : personalDetail.map(item => (
                  <div key={item.key} className="py-3 flex justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{item.concept}</p>
                      <p className="text-[9px] font-black uppercase text-slate-400">{item.source} · {item.type} · Total {formatCLP(item.amount)}</p>
                    </div>
                    <span className="font-black text-slate-700 whitespace-nowrap">{formatCLP(item.personalValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-2xl w-fit">
          <button onClick={() => setActiveTab('movimientos')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'movimientos' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>Movimientos</button>
          <button onClick={() => setActiveTab('dashboard')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'dashboard' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>Dashboard</button>
          <button onClick={() => setActiveTab('arriendo-piramide')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'arriendo-piramide' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>Arriendo Piramide</button>
        </div>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Por categoría y por tipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Por categoría */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6">
                <h3 className="font-black text-slate-800 mb-1">Por Categoría</h3>
                <p className="text-[10px] text-slate-400 uppercase font-black mb-5">Mi parte por categoría</p>
                {dashByCategory.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">Sin datos este mes</p>
                ) : (
                  <div className="space-y-4">
                    {dashByCategory.map(({ cat, total }, i) => {
                      const pct = (total / dashByCategory[0].total) * 100;
                      return (
                        <div key={cat}>
                          <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-sm font-bold text-slate-700">{cat}</span>
                            <span className="text-sm font-black text-slate-800">{formatCLP(total)}</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5 text-right font-medium">{pct.toFixed(0)}% del mayor</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Por tipo */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6">
                <h3 className="font-black text-slate-800 mb-1">Por Tipo</h3>
                <p className="text-[10px] text-slate-400 uppercase font-black mb-5">Mi parte por tipo de movimiento</p>
                {dashByType.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">Sin datos este mes</p>
                ) : (
                  <div className="space-y-4">
                    {dashByType.map(({ type, total }) => {
                      const pct = (total / dashByType[0].total) * 100;
                      const color = TYPE_COLORS[type] || '#64748b';
                      return (
                        <div key={type}>
                          <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-sm font-bold text-slate-700">{type}</span>
                            <span className="text-sm font-black text-slate-800">{formatCLP(total)}</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5 text-right font-medium">{pct.toFixed(0)}% del mayor</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top 5 gastos */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6">
              <h3 className="font-black text-slate-800 mb-1">Top 5 Gastos</h3>
              <p className="text-[10px] text-slate-400 uppercase font-black mb-5">Los mayores gastos del mes (mi parte)</p>
              {dashTop5.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Sin datos este mes</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {dashTop5.map(({ concept, amount, type, category }, i) => {
                    const color = TYPE_COLORS[type] || '#64748b';
                    const maxAmount = dashTop5[0].amount;
                    return (
                      <div key={i} className="py-3 flex items-center gap-4">
                        <span className="text-2xl font-black text-slate-100 w-8 shrink-0 text-center">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="font-bold text-slate-800 truncate pr-3">{concept}</span>
                            <span className="font-black text-slate-800 whitespace-nowrap">{formatCLP(amount)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(amount / maxAmount) * 100}%`, backgroundColor: color }} />
                            </div>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase" style={{ backgroundColor: color + '20', color }}>{type}</span>
                            <span className="text-[9px] text-slate-400 font-medium">{category}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resumen porcentual */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {dashByCategory.slice(0, 4).map(({ cat, total }, i) => {
                const pct = totals.indiv > 0 ? ((total / totals.indiv) * 100).toFixed(1) : '0';
                return (
                  <div key={cat} className="bg-white rounded-[2rem] border border-slate-200 p-5 text-center">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-2">{cat}</p>
                    <p className="text-3xl font-black" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{pct}%</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">{formatCLP(total)}</p>
                  </div>
                );
              })}
            </div>

            {/* Análisis IA */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-black text-slate-800">Asesor Financiero IA</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-black mt-0.5">Recomendaciones personalizadas con inteligencia artificial</p>
                </div>
                <button
                  onClick={() => generateFinancialAdvice(dashByCategory, dashByType, totals)}
                  disabled={aiAdviceLoading || totals.income === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {aiAdviceLoading ? <><Loader2 size={14} className="animate-spin"/> Analizando...</> : '✦ Generar análisis'}
                </button>
              </div>

              {aiAdviceError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 font-medium">{aiAdviceError}</div>
              )}

              {!aiAdvice && !aiAdviceLoading && !aiAdviceError && (
                <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-4xl mb-3">✦</p>
                  <p className="text-slate-400 text-sm font-medium">Presiona el botón para que la IA analice tus ingresos y gastos del mes y te entregue recomendaciones personalizadas.</p>
                </div>
              )}

              {aiAdvice && (
                <div className="mt-5 space-y-5">
                  {/* Diagnóstico */}
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Diagnóstico del mes</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{aiAdvice.diagnostico}</p>
                  </div>

                  {/* Ahorro recomendado */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-center">
                      <p className="text-[9px] font-black text-green-600 uppercase mb-1">Ahorro recomendado</p>
                      <p className="text-2xl font-black text-green-700">{formatCLP(aiAdvice.ahorro_recomendado)}</p>
                      <p className="text-[10px] text-green-500 font-medium mt-0.5">al mes</p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-center">
                      <p className="text-[9px] font-black text-blue-600 uppercase mb-1">Del ingreso</p>
                      <p className="text-2xl font-black text-blue-700">{aiAdvice.ahorro_porcentaje}%</p>
                      <p className="text-[10px] text-blue-500 font-medium mt-0.5">tasa de ahorro</p>
                    </div>
                  </div>

                  {/* Alertas */}
                  {aiAdvice.alertas?.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <p className="text-[9px] font-black text-amber-600 uppercase mb-2">⚠ Puntos de atención</p>
                      <ul className="space-y-1.5">
                        {aiAdvice.alertas.map((a, i) => <li key={i} className="text-sm text-amber-800 flex gap-2"><span className="shrink-0">•</span>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Recomendaciones */}
                  {aiAdvice.recomendaciones?.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Recomendaciones</p>
                      <ul className="space-y-2">
                        {aiAdvice.recomendaciones.map((r, i) => (
                          <li key={i} className="flex gap-3 items-start text-sm text-slate-700 p-3 bg-slate-50 rounded-xl">
                            <span className="font-black text-slate-300 shrink-0">{i + 1}</span>{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Puntos positivos */}
                  {aiAdvice.puntos_positivos?.length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                      <p className="text-[9px] font-black text-green-600 uppercase mb-2">✓ Aspectos positivos</p>
                      <ul className="space-y-1.5">
                        {aiAdvice.puntos_positivos.map((p, i) => <li key={i} className="text-sm text-green-800 flex gap-2"><span className="shrink-0">•</span>{p}</li>)}
                      </ul>
                    </div>
                  )}

                  <p className="text-[9px] text-slate-300 text-center font-medium">Análisis generado por IA · Solo referencial</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'arriendo-piramide' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-fit">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft size={18}/></button>
                <div className="px-4 py-1 flex flex-col items-center min-w-[160px]">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Mes Arriendo</span>
                  <span className="text-sm font-bold capitalize">{pyramidRentMonthLabel}</span>
                </div>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight size={18}/></button>
              </div>
              <div className={`rounded-[1.5rem] border px-4 py-3 text-sm font-medium ${pyramidRentNeedsAdjustmentReminder ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                {pyramidRentNeedsAdjustmentReminder
                  ? `Recordatorio: ya pasaron ${monthsSinceAdjustment} meses desde el ultimo ajuste trimestral.`
                  : lastAdjustmentMonthKey
                    ? `Ultimo ajuste registrado: ${dateFromMonthKey(lastAdjustmentMonthKey).toLocaleString('es-CL', { month: 'long', year: 'numeric' })}.`
                    : 'Aun no hay un ajuste trimestral registrado.'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
                <p className="text-[10px] text-green-600 font-black uppercase mb-1">Ingreso Arriendo</p>
                <p className="text-2xl font-black text-green-700">{formatCLP(pyramidRentIncome)}</p>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
                <p className="text-[10px] text-rose-500 font-black uppercase mb-1">Egreso Arriendo</p>
                <p className="text-2xl font-black text-rose-600">{formatCLP(pyramidRentExpense)}</p>
              </div>
              <div className={`p-5 rounded-[2rem] border shadow-sm ${pyramidRentNet < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className={`text-[10px] font-black uppercase mb-1 ${pyramidRentNet < 0 ? 'text-red-500' : 'text-emerald-600'}`}>Total Mes</p>
                <p className={`text-2xl font-black ${pyramidRentNet < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCLP(pyramidRentNet)}</p>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-blue-100 shadow-sm">
                <p className="text-[10px] text-blue-600 font-black uppercase mb-1">Utilidad</p>
                <p className="text-2xl font-black text-blue-700">{formatCLP(pyramidRentAccumulatedUtility)}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Acumulada hasta este mes, descontando retiros.</p>
                {monthKey >= PYRAMID_RENT_INITIAL_BANK_MONTH_KEY && (
                  <p className="text-[10px] text-slate-400 font-medium">Incluye base inicial de {formatCLP(PYRAMID_RENT_INITIAL_BANK_BALANCE)} desde mayo 2026.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-800">Control mensual de arriendo</h3>
                  <p className="text-xs text-slate-400 font-medium">Registra ingresos y egresos de Piramide para {pyramidRentMonthLabel}. Los honorarios se calculan automatico como 6% + IVA sobre el arriendo.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-6 py-4 text-left">Detalle</th>
                      <th className="px-6 py-4 text-right">Ingreso</th>
                      <th className="px-6 py-4 text-right">Egreso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-bold text-slate-800 capitalize">{pyramidRentRentLabel}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatInputNumber(currentPyramidRentRecord.rentIncome)}
                          onChange={e => handlePyramidRentFieldChange('rentIncome', e.target.value)}
                          onBlur={e => updatePyramidRentField('rentIncome', e.target.value)}
                          className="w-full bg-transparent border-2 border-transparent focus:border-green-200 rounded-xl px-3 py-2 font-medium text-right outline-none text-green-700"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-300">{formatCLP(0)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">honorarios 6% + iva</p>
                        <p className="text-[10px] text-slate-400 font-medium">Calculado sobre el ingreso de arriendo del mes.</p>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-300">{formatCLP(0)}</td>
                      <td className="px-6 py-4 text-right font-black text-rose-600">{formatCLP(pyramidRentCommission)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-bold text-slate-800">pago dividendo</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-300">{formatCLP(0)}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatInputNumber(currentPyramidRentRecord.dividendExpense)}
                          onChange={e => handlePyramidRentFieldChange('dividendExpense', e.target.value)}
                          onBlur={e => updatePyramidRentField('dividendExpense', e.target.value)}
                          className="w-full bg-transparent border-2 border-transparent focus:border-rose-200 rounded-xl px-3 py-2 font-medium text-right outline-none text-rose-600"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">ajuste trimestral</p>
                        <p className="text-[10px] text-slate-400 font-medium">Ingresa el monto solo cuando corresponda aplicar el ajuste. Cuenta como ingreso.</p>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatInputNumber(currentPyramidRentRecord.quarterlyAdjustment)}
                          onChange={e => handlePyramidRentFieldChange('quarterlyAdjustment', e.target.value)}
                          onBlur={e => updatePyramidRentField('quarterlyAdjustment', e.target.value)}
                          className="w-full bg-transparent border-2 border-transparent focus:border-green-200 rounded-xl px-3 py-2 font-medium text-right outline-none text-green-700"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-300">{formatCLP(0)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50/70 border-t border-blue-100">
                      <td className="px-6 py-4 font-black text-slate-800 uppercase text-xs">Sub total</td>
                      <td className="px-6 py-4 text-right font-black text-blue-700">{formatCLP(pyramidRentIncome)}</td>
                      <td className="px-6 py-4 text-right font-black text-blue-700">{formatCLP(pyramidRentExpense)}</td>
                    </tr>
                    <tr className={`${pyramidRentNet < 0 ? 'bg-red-50/70 border-t border-red-100' : 'bg-emerald-50/70 border-t border-emerald-100'}`}>
                      <td className="px-6 py-4 font-black text-slate-800 uppercase text-xs">Total</td>
                      <td colSpan="2" className={`px-6 py-4 text-right font-black text-lg ${pyramidRentNet < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatCLP(pyramidRentNet)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-800">Retiros de utilidad</h3>
                  <p className="text-xs text-slate-400 font-medium">Cada retiro descuenta la utilidad acumulada de este mes.</p>
                </div>
                <button onClick={addPyramidRentWithdrawal} className="px-4 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-slate-700 transition-all flex items-center gap-2 w-fit">
                  <Plus size={14}/> Agregar retiro
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-6 py-4 text-left">Detalle</th>
                      <th className="px-6 py-4 text-right">Monto Retirado</th>
                      <th className="px-6 py-4 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentPyramidRentRecord.withdrawals.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-sm text-slate-400">Sin retiros registrados en este mes.</td>
                      </tr>
                    )}
                    {currentPyramidRentRecord.withdrawals.map(withdrawal => (
                      <tr key={withdrawal.id} className="hover:bg-slate-50/80">
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={withdrawal.detail}
                            onChange={e => handlePyramidRentWithdrawalChange(withdrawal.id, 'detail', e.target.value)}
                            onBlur={savePyramidRent}
                            className="w-full bg-transparent border-2 border-transparent focus:border-slate-200 rounded-xl px-3 py-2 font-medium outline-none"
                            placeholder="Ej: retiro personal, transferencia, etc."
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputNumber(withdrawal.amount)}
                            onChange={e => handlePyramidRentWithdrawalChange(withdrawal.id, 'amount', e.target.value)}
                            onBlur={savePyramidRent}
                            className="w-full bg-transparent border-2 border-transparent focus:border-amber-200 rounded-xl px-3 py-2 font-medium text-right outline-none text-amber-700"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => deletePyramidRentWithdrawal(withdrawal.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={18}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-amber-50/70 border-t border-amber-100">
                      <td className="px-6 py-4 font-black text-slate-800 uppercase text-xs">Retiros del mes</td>
                      <td className="px-6 py-4 text-right font-black text-amber-700">{formatCLP(pyramidRentWithdrawalsTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'movimientos' && <><div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            {/* Nuevo Gasto */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="flex flex-col gap-4 mb-6">
                <h3 className="font-black text-lg">Nuevo Gasto</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => camInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 bg-slate-900 text-white p-4 rounded-3xl hover:bg-slate-800 transition-all">{isScanning ? <Loader2 className="animate-spin" size={20}/> : <Camera size={20}/>} <span className="text-[10px] font-black uppercase">Cámara</span></button>
                  <button onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 bg-blue-50 text-blue-600 p-4 rounded-3xl border border-blue-100 hover:bg-blue-100 transition-all">{isScanning ? <Loader2 className="animate-spin" size={20}/> : <ImageIcon size={20}/>} <span className="text-[10px] font-black uppercase">Galería</span></button>
                </div>
                <input type="file" ref={camInputRef} onChange={(e) => processImage(e.target.files[0])} accept="image/*" capture="environment" className="hidden" />
                <input type="file" ref={galleryInputRef} onChange={(e) => processImage(e.target.files[0])} accept="image/*" className="hidden" />
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <input name="concept" placeholder="¿En qué gastaste?" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-medium focus:bg-white focus:border-blue-500 outline-none" required />
                <div className="grid grid-cols-2 gap-3">
                  <input name="amount" placeholder="$ 0" onChange={e => e.target.value = formatInputNumber(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-black focus:bg-white focus:border-blue-500 outline-none" required />
                  <select name="type" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-3 py-4 text-sm font-bold outline-none">
                    {movTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <select name="category" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-4 text-sm font-medium outline-none">
                  {movCategories.map(c => <option key={c}>{c}</option>)}
                </select>
                <button className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all">GUARDAR</button>
              </form>
            </div>

            {/* Cobros Pendientes Karla */}
            {(totals.debt !== 0) && (
              <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm ring-4 ring-slate-50 ${totals.debt < 0 ? 'border-amber-200' : ''}`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{totals.debt < 0 ? 'Mi deuda con Karla' : 'Deuda de Karla'}</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={copyDebtDetails} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                    >
                      {copied ? <Check size={12}/> : <Copy size={12}/>}
                      {copied ? 'COPIADO' : 'COPIAR'}
                    </button>
                    <button onClick={() => setIsDebtCollapsed(!isDebtCollapsed)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-all">
                      {isDebtCollapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                    </button>
                  </div>
                </div>
                {!isDebtCollapsed && (
                  <>
                    <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {movements.filter(m => (m.type==='Compartido'||m.type==='Deuda'||m.type==='Préstamo'||m.type==='Yo debo') && !m.isPaid).map(m => (
                        <div key={m.id} className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium truncate pr-4">{m.concept} {m.type === 'Préstamo' && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded">100%</span>} {m.type === 'Yo debo' && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded">Mía</span>}</span>
                          <span className={`font-bold whitespace-nowrap ${m.type === 'Yo debo' ? 'text-red-600' : ''}`}>{formatCLP(m.type==='Compartido' ? m.amount/2 : (m.type === 'Yo debo' ? -m.amount : m.amount))}</span>
                        </div>
                      ))}
                      {activeInstallments.filter(inst => (inst.type==='Compartido'||inst.type==='Préstamo'||inst.type==='Yo debo') && !inst.isPaid).map(inst => (
                        <div key={'inst_debt_' + inst.id} className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium truncate pr-4">
                            {inst.concept}
                            <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded ml-1">{inst.installmentNumber}/{inst.installments}</span>
                            {inst.type === 'Yo debo' && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded ml-1">Mía</span>}
                          </span>
                          <span className={`font-bold whitespace-nowrap ${inst.type === 'Yo debo' ? 'text-red-600' : ''}`}>
                            {formatCLP(inst.type==='Compartido' ? inst.monthlyAmount/2 : (inst.type==='Yo debo' ? -inst.monthlyAmount : inst.monthlyAmount))}
                          </span>
                        </div>
                      ))}
                      {activeFixedExpenses.filter(exp => (exp.type==='Compartido'||exp.type==='Préstamo'||exp.type==='Yo debo') && !exp.karlaIsPaid).map(exp => (
                        <div key={'fix_debt_' + exp.id} className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium truncate pr-4">
                            {exp.concept}
                            <span className="text-[8px] bg-green-100 text-green-700 px-1 rounded ml-1">Fijo</span>
                            {exp.type === 'Yo debo' && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded ml-1">Mía</span>}
                          </span>
                          <span className={`font-bold whitespace-nowrap ${exp.type === 'Yo debo' ? 'text-red-600' : ''}`}>
                            {formatCLP(exp.type==='Compartido' ? exp.amount/2 : (exp.type==='Yo debo' ? -exp.amount : exp.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setShowPaymentModal(true)} className="w-full bg-green-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 shadow-lg shadow-green-100 transition-all">
                      <CheckCircle2 size={20}/> REGISTRAR PAGO
                    </button>
                  </>
                )}
              </div>
             )}  

            {/* Cargas TC Separadas */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargas de Tarjeta</h3>
                <button onClick={() => setShowTCImportModal(true)} className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-all"><Plus size={16}/></button>
              </div>
              {tcBatches.slice().reverse().map(batch => {
                const isExpanded = expandedBatches.includes(batch.id);
                const isEditing = editingBatchId === batch.id;
                return (
                  <div key={batch.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <input 
                              className="text-sm font-black text-slate-700 border-b-2 border-blue-400 outline-none w-full"
                              value={batch.title || ""} 
                              onChange={(e) => handleUpdateBatch(batch.id, 'title', e.target.value)}
                              placeholder="Título..."
                              autoFocus
                            />
                          ) : (
                            <span className="text-sm font-black text-slate-700 leading-tight">{batch.title || "Carga sin título"}</span>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{batch.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <button onClick={() => { saveToCloud(movements, balances, tcBatches); setEditingBatchId(null); }} className="p-1.5 bg-green-50 text-green-600 rounded-lg transition-all shadow-sm border border-green-100"><Save size={16}/></button>
                        ) : (
                          <button onClick={() => setEditingBatchId(batch.id)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"><Edit2 size={16}/></button>
                        )}
                        <button onClick={() => toggleBatchExpand(batch.id)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-all">
                          {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </button>
                        <button onClick={() => {
                          const updated = tcBatches.filter(b => b.id !== batch.id);
                          setTcBatches(updated); saveToCloud(movements, balances, updated);
                        }} className="p-1.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    {isExpanded && (
                      <>
                        {isEditing ? (
                          <textarea 
                            className="text-[11px] text-slate-500 italic mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full outline-none focus:border-blue-200 min-h-[60px] resize-none"
                            value={batch.comment || ""}
                            onChange={(e) => handleUpdateBatch(batch.id, 'comment', e.target.value)}
                            placeholder="Comentario..."
                          />
                        ) : (
                          batch.comment && <p className="text-[11px] text-slate-500 italic mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">{batch.comment}</p>
                        )}
                        <div className="space-y-2">
                          {batch.items.map(item => (
                            <div key={item.id} className={`flex justify-between items-center text-[11px] ${item.isExcluded ? 'opacity-30' : ''}`}>
                              <span className={`text-slate-600 font-medium truncate pr-2 ${item.isExcluded ? 'line-through text-slate-400' : ''}`}>{item.concept}</span>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${item.isExcluded ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{formatCLP(item.amount)}</span>
                                <button onClick={() => toggleTCItemExclusion(batch.id, item.id)} className="text-slate-300 hover:text-blue-500 transition-colors">
                                  {item.isExcluded ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Subtotal Carga</span>
                          <span className="text-sm font-black text-blue-600">{formatCLP(batch.items.reduce((sum, i) => i.isExcluded ? sum : sum + i.amount, 0))}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

          {/* Historial */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50/50 font-black">
                <button
                  onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                  className="flex items-center gap-2 text-left text-slate-800 hover:text-blue-600 transition-colors"
                  title={isHistoryCollapsed ? 'Mostrar historial' : 'Ocultar historial'}
                >
                  {isHistoryCollapsed ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
                  <span>Historial del Mes</span>
                  <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-lg">{historyItemCount}</span>
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setShowFixedModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black hover:bg-green-700 transition-all shadow-sm"><Plus size={14}/> FIJO</button>
                  <button onClick={() => setShowInstallmentModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700 transition-all shadow-sm"><Plus size={14}/> CUOTA</button>
                </div>
              </div>
              {!isHistoryCollapsed && <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr>                      
                      <th className="px-6 py-4 text-left cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('Detalle')}>Detalle {getSortIcon('Detalle')}</th>
                      <th className="px-6 py-4 text-left cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('Tipo')}>Tipo {getSortIcon('Tipo')}</th>
                      <th className="px-6 py-4 text-right cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('Total')}>Total {getSortIcon('Total')}</th>
                      <th className="px-6 py-4 text-right cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('Mi Parte')}>Mi Parte {getSortIcon('Mi Parte')}</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {/* Gastos fijos — siempre al inicio */}
                    {[...activeFixedExpenses].sort((a, b) => a.isPaid - b.isPaid).map(exp => {
                      const isEditing = editingFixedId === exp.id;
                      return (
                      <tr key={'fix_' + exp.id} className={`group border-l-4 border-l-green-400 ${exp.isPaid ? 'opacity-30' : 'bg-green-50/20 hover:bg-green-50/40'}`}>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingFixedData.concept}
                              onChange={e => setEditingFixedData(d => ({ ...d, concept: e.target.value }))}
                              className="w-full bg-white border-2 border-green-400 rounded-xl px-3 py-1.5 text-sm font-medium outline-none"
                            />
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-800">{exp.concept}</p>
                                <span className="text-[8px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md">Fijo</span>
                              </div>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">{exp.category}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${exp.type === 'Yo debo' ? 'bg-red-100 text-red-700' : exp.type === 'Individual' ? 'bg-purple-100 text-purple-700' : exp.type === 'Ingreso' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{exp.type}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          {isEditing ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editingFixedData.amount}
                              onChange={e => setEditingFixedData(d => ({ ...d, amount: e.target.value.replace(/\D/g, '') }))}
                              className="w-28 bg-white border-2 border-green-400 rounded-xl px-3 py-1.5 text-sm font-medium text-right outline-none"
                            />
                          ) : formatCLP(exp.amount)}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-blue-600">{formatCLP(exp.myPart)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={() => saveFixedEdit(exp)} className="p-2 text-green-500 hover:text-green-700 transition-colors"><Save size={18}/></button>
                                <button onClick={() => { setEditingFixedId(null); setEditingFixedData({}); }} className="p-2 text-slate-300 hover:text-slate-500 transition-colors"><X size={18}/></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditFixed(exp)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"><Edit2 size={18}/></button>
                                <button onClick={() => toggleFixedPaid(exp.id)} title={exp.isPaid ? 'Desmarcar' : 'Marcar como pagado'} className={`p-2 transition-colors ${exp.isPaid ? 'text-green-500' : 'text-slate-300 hover:text-green-500'}`}><CheckCircle2 size={18}/></button>
                                <button onClick={() => deleteFixedExpense(exp.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {/* Cuotas activas — siempre al inicio */}
                    {[...activeInstallments].sort((a, b) => a.isPaid - b.isPaid).map(inst => (
                      <tr key={'inst_' + inst.id} className={`group border-l-4 border-l-blue-400 ${inst.isPaid ? 'opacity-30' : 'bg-blue-50/20 hover:bg-blue-50/40'}`}>
                        <td className="px-6 py-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{inst.concept}</p>
                              <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">{inst.installmentNumber}/{inst.installments}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{inst.category} · Total {formatCLP(inst.totalAmount)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${inst.type === 'Yo debo' ? 'bg-red-100 text-red-700' : inst.type === 'Individual' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{inst.type}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium">{formatCLP(inst.monthlyAmount)}</td>
                        <td className="px-6 py-4 text-right font-black text-blue-600">{formatCLP(inst.myPart)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => toggleInstallmentPaid(inst.id)} title={inst.isPaid ? 'Marcar como no pagada' : 'Marcar como pagada'} className={`p-2 transition-colors ${inst.isPaid ? 'text-green-500' : 'text-slate-300 hover:text-green-500'}`}><CheckCircle2 size={18}/></button>
                            <button onClick={() => deleteInstallmentPlan(inst.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Movimientos regulares */}
                    {sortedMovements.map(m => (
                      <tr key={m.id} className={`group ${m.isPaid ? 'opacity-30' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          {editingId === m.id ? (
                            <div className="flex flex-col gap-1">
                              <input className="w-full border-2 border-blue-200 rounded-xl px-2 py-1 font-bold text-sm" value={m.concept} onChange={e => handleUpdate(m.id, 'concept', e.target.value)} autoFocus />
                              <select className="w-full border-2 border-blue-200 rounded-xl px-2 py-1 font-bold text-xs" value={m.category} onChange={e => handleUpdate(m.id, 'category', e.target.value)}>
                                {movCategories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <p className="font-bold text-slate-800">{m.concept}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">{m.category}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingId === m.id ? (
                            <select className="border-2 border-blue-200 rounded-xl px-1 py-1 font-bold text-xs" value={m.type} onChange={e => handleUpdate(m.id, 'type', e.target.value)}>
                              {movTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ) : (
                            <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${m.type === 'Ingreso' ? 'bg-green-100 text-green-700' : m.type === 'Préstamo' ? 'bg-amber-100 text-amber-700' : m.type === 'Yo debo' ? 'bg-red-100 text-red-700' : m.type === 'Individual' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{m.type}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">{editingId === m.id ? <input className="w-20 text-right border-2 border-blue-200 rounded-xl" value={formatInputNumber(m.amount)} onChange={e => handleUpdate(m.id, 'amount', e.target.value)}/> : formatCLP(m.amount)}</td>
                        <td className="px-6 py-4 text-right font-black text-blue-600">{formatCLP(m.myPart)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100">
                            {editingId === m.id ? (
                              <button onClick={() => { saveToCloud(movements, balances); setEditingId(null); }} className="p-2 text-green-600"><Save size={18}/></button>
                            ) : (
                              <>
                                <button onClick={() => setEditingId(m.id)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 size={18}/></button>
                                <button onClick={() => { const u = movements.filter(x => x.id !== m.id); setMovements(u); saveToCloud(u, balances); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
            </div>
          </div>
        </div>

        {/* Evidencias de Pago */}
        <div className="mt-6 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setShowEvidence(!showEvidence)} className="w-full p-5 flex justify-between items-center hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-3">
              <span className="font-black text-slate-700">Evidencias de Pago</span>
              {evidence.length > 0 && <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{evidence.length} imagen{evidence.length !== 1 ? 's' : ''}</span>}
            </div>
            {showEvidence ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
          </button>
          {showEvidence && (
            <div className="px-6 pb-6">
              <input type="file" ref={evidenceInputRef} accept="image/*" className="hidden" onChange={e => addEvidence(e.target.files[0])} />
              <div className="flex gap-3 mb-4">
                <button onClick={() => evidenceInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-slate-700 transition-all">
                  <Camera size={14}/> SUBIR ARCHIVO
                </button>
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl px-4 py-2 text-xs text-slate-400 font-bold select-none bg-slate-50/50">
                  Ctrl+V para pegar imagen
                </div>
              </div>
              {evidence.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Sin evidencias subidas este mes</p>}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {evidence.map(ev => (
                  <div key={ev.id} className="relative group">
                    <img src={ev.imageBase64} alt="evidencia" onClick={() => setEvidenceViewer(ev)} className="w-full aspect-square object-cover rounded-2xl cursor-pointer hover:opacity-90 transition-opacity border border-slate-100" />
                    <button onClick={() => deleteEvidence(ev.id)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                    <p className="text-[8px] text-slate-400 text-center mt-1 truncate">{ev.uploadedAt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>}
      </main>

      {/* Modales */}
      {showProjectionModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div>
                <h3 className="font-black text-2xl">Proyeccion de gastos</h3>
                <p className="text-slate-500 text-sm mt-1">Agrega gastos especiales del mes en curso.</p>
              </div>
              <button onClick={() => setShowProjectionModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><X size={20}/></button>
            </div>

            <form onSubmit={addProjectionItem} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 mb-5">
              <select value={projectionType} onChange={e => setProjectionType(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:bg-white focus:border-emerald-500">
                {PROJECTION_SPECIAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <input value={projectionAmount} onChange={e => setProjectionAmount(formatInputNumber(e.target.value))} inputMode="numeric" placeholder="$ 0" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-4 text-sm font-black outline-none focus:bg-white focus:border-emerald-500" />
              <button type="submit" className="px-5 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <Plus size={16}/> Agregar
              </button>
            </form>

            <div className="mb-6">
              {projectionItems.length === 0 ? (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-5 text-center text-sm font-medium text-slate-400">
                  Sin gastos especiales agregados
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                  {projectionItems.map(item => {
                    const isEditingProjectionItem = editingProjectionItemId === item.id;
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white">
                        {isEditingProjectionItem ? (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2 flex-1">
                              <select
                                value={editingProjectionItemData.type}
                                onChange={e => setEditingProjectionItemData(data => ({ ...data, type: e.target.value }))}
                                className="w-full bg-slate-50 border-2 border-emerald-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:bg-white focus:border-emerald-500"
                              >
                                {PROJECTION_SPECIAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                              </select>
                              <input
                                value={editingProjectionItemData.amount}
                                onChange={e => setEditingProjectionItemData(data => ({ ...data, amount: formatInputNumber(e.target.value) }))}
                                inputMode="numeric"
                                className="w-full bg-slate-50 border-2 border-emerald-100 rounded-xl px-3 py-2 text-sm font-black outline-none focus:bg-white focus:border-emerald-500"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => saveProjectionItemEdit(item.id)} type="button" className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"><Save size={16}/></button>
                              <button onClick={cancelEditProjectionItem} type="button" className="p-2 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"><X size={16}/></button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <p className="font-black text-sm text-slate-800 truncate">{item.type}</p>
                              <p className="text-[9px] font-black uppercase text-slate-400">Gasto especial</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 whitespace-nowrap">{formatCLP(item.amount)}</span>
                              <button onClick={() => startEditProjectionItem(item)} type="button" className="p-2 text-slate-300 hover:text-blue-500 transition-colors"><Edit2 size={16}/></button>
                              <button onClick={() => removeProjectionItem(item.id)} type="button" className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={calculateExpenseProjection} disabled={projectionLoading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {projectionLoading ? <><Loader2 size={18} className="animate-spin"/> Calculando...</> : <><Calculator size={18}/> Calcular proyeccion</>}
            </button>

            {projectionError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 font-medium">{projectionError}</div>
            )}

            {projectionResult && (
              <div className="mt-6 bg-emerald-50/70 border border-emerald-100 rounded-[2rem] p-5">
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                  Para <span className="font-black capitalize">{projectionResult.monthName}</span> estimas gastar <span className="font-black text-slate-900">{formatCLP(projectionResult.expenses)}</span>, ingresar <span className="font-black text-green-700">{formatCLP(projectionResult.income)}</span> y quedar con <span className={`font-black ${projectionResult.balance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCLP(projectionResult.balance)}</span>.
                </p>

                <details className="mt-5 bg-white/70 border border-emerald-100 rounded-2xl overflow-hidden">
                  <summary className="cursor-pointer select-none px-4 py-3 text-[10px] font-black uppercase text-emerald-700">
                    Detalle del calculo
                  </summary>
                  <div className="px-4 pb-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-600 font-bold">Fijos y cuotas</span>
                      <span className="font-black text-slate-800">{formatCLP(projectionResult.breakdown.fixed)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-600 font-bold">Comida</span>
                      <span className="font-black text-slate-800">{formatCLP(projectionResult.breakdown.food)}</span>
                    </div>
                    {projectionResult.detailItems?.food?.length > 0 && (
                      <div className="ml-3 pl-3 border-l border-emerald-100 space-y-1.5">
                        {projectionResult.detailItems.food
                          .slice()
                          .sort((a, b) => b.amount - a.amount)
                          .map(item => (
                            <div key={`projection_food_${item.id}_${item.concept}`} className="flex justify-between gap-3 text-xs">
                              <span className="text-slate-500 font-medium truncate">{item.concept}</span>
                              <span className="font-bold text-slate-600 whitespace-nowrap">{formatCLP(item.amount)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-600 font-bold">Transporte</span>
                      <span className="font-black text-slate-800">{formatCLP(projectionResult.breakdown.transport)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-600 font-bold">Otros movimientos</span>
                      <span className="font-black text-slate-800">{formatCLP(projectionResult.breakdown.other)}</span>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-emerald-100 pt-2">
                      <span className="text-slate-600 font-bold">Gastos especiales</span>
                      <span className="font-black text-slate-800">{formatCLP(projectionResult.breakdown.special)}</span>
                    </div>
                  </div>
                </details>

                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase text-emerald-700 mb-3">Gastos especiales detectados:</p>
                  {projectionResult.specialExpenses.length === 0 ? (
                    <p className="text-sm text-slate-500 font-medium">Sin gastos especiales agregados.</p>
                  ) : (
                    <ul className="space-y-2">
                      {projectionResult.specialExpenses.map(item => (
                        <li key={item.id} className="flex justify-between gap-3 text-sm">
                          <span className="text-slate-600 font-bold">{item.type}</span>
                          <span className="font-black text-slate-800 whitespace-nowrap">{formatCLP(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md">
            <h3 className="font-black text-2xl text-center mb-8">¿Dónde recibiste el pago?</h3>
            <div className="grid gap-3">
              <button onClick={() => {
                const newBals = {...balances, itau: balances.itau + totals.debt};
                const updated = movements.map(m => (m.type==='Compartido'||m.type==='Deuda'||m.type==='Préstamo') ? {...m, isPaid: true} : m);
                const updatedFixed = fixedExpenses.map(exp => exp.type === 'Compartido' ? { ...exp, karlaPaidMonths: [...(exp.karlaPaidMonths || []), monthKey] } : exp);
                setBalances(newBals); setMovements(updated); setFixedExpenses(updatedFixed);
                saveToCloud(updated, newBals); saveFixedExpenses(updatedFixed); setShowPaymentModal(false);
              }} className="p-6 bg-slate-50 border-2 rounded-3xl font-black text-lg hover:border-blue-500 transition-all text-center">Banco Itaú</button>
              <button onClick={() => {
                const newBals = {...balances, scotia: balances.scotia + totals.debt};
                const updated = movements.map(m => (m.type==='Compartido'||m.type==='Deuda'||m.type==='Préstamo') ? {...m, isPaid: true} : m);
                const updatedFixed = fixedExpenses.map(exp => exp.type === 'Compartido' ? { ...exp, karlaPaidMonths: [...(exp.karlaPaidMonths || []), monthKey] } : exp);
                setBalances(newBals); setMovements(updated); setFixedExpenses(updatedFixed);
                saveToCloud(updated, newBals); saveFixedExpenses(updatedFixed); setShowPaymentModal(false);
              }} className="p-6 bg-slate-50 border-2 rounded-3xl font-black text-lg hover:border-red-500 transition-all text-center">Scotiabank</button>
              <button onClick={() => setShowPaymentModal(false)} className="py-4 text-slate-400 font-black uppercase text-xs text-center mt-2">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showTCImportModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-2xl">
            <h3 className="font-black text-2xl mb-2">Importar desde Banco</h3>
            <p className="text-slate-500 text-sm mb-6">Pega aquí el detalle copiado de tu tarjeta de crédito.</p>
            <form onSubmit={handleTCImport}>
              <div className="space-y-3 mb-4">
                <input name="tcTitle" placeholder="Título de la carga (ej. Compras del mes)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none transition-all" />
                <textarea name="tcComment" placeholder="Comentario adicional..." className="w-full h-20 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-blue-500 outline-none transition-all resize-none"></textarea>
                <textarea name="tcData" className="w-full h-48 bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 text-xs font-mono outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="FECHA	DESCRIPCIÓN	CIUDAD	MONTO..."></textarea>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowTCImportModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl">CANCELAR</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100">PROCESAR CARGA</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTCPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md">
            <h3 className="font-black text-2xl text-center mb-8">Pagar Tarjeta</h3>
            <div className="grid gap-3">
              <button disabled={balances.itau < balances.tc_deuda} onClick={() => handlePayTC('itau')} className="p-6 bg-slate-50 border-2 rounded-3xl font-black text-lg hover:border-blue-500 transition-all flex justify-between disabled:opacity-50"><span>Itaú</span> <span>{formatCLP(balances.itau)}</span></button>
              <button disabled={balances.scotia < balances.tc_deuda} onClick={() => handlePayTC('scotia')} className="p-6 bg-slate-50 border-2 rounded-3xl font-black text-lg hover:border-red-500 transition-all flex justify-between disabled:opacity-50"><span>Scotia</span> <span>{formatCLP(balances.scotia)}</span></button>
              <button onClick={() => setShowTCPaymentModal(false)} className="py-4 text-slate-400 font-black uppercase text-xs text-center mt-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showTypesModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-2xl">Gestionar</h3>
              <button onClick={() => setShowTypesModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><X size={20}/></button>
            </div>
            <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setModalTab('categorias')} className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${modalTab === 'categorias' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Categorías</button>
              <button onClick={() => setModalTab('tipos')} className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${modalTab === 'tipos' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Tipos</button>
            </div>

            {modalTab === 'categorias' && (
              <>
                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {movCategories.map(c => (
                    <div key={c} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-2xl">
                      <span className="font-bold text-sm">{c}</span>
                      {DEFAULT_CATEGORIES.includes(c) ? (
                        <span className="text-[9px] font-black text-slate-400 uppercase px-2 py-1 bg-slate-200 rounded-lg">Base</span>
                      ) : (
                        <button onClick={() => deleteCategory(c)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={15}/></button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} placeholder="Nueva categoría..." className="flex-1 bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-blue-500 outline-none" />
                  <button onClick={addCategory} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all"><Plus size={20}/></button>
                </div>
              </>
            )}

            {modalTab === 'tipos' && (
              <>
                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {movTypes.map(t => (
                    <div key={t} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-2xl">
                      <span className="font-bold text-sm">{t}</span>
                      {DEFAULT_TYPES.includes(t) ? (
                        <span className="text-[9px] font-black text-slate-400 uppercase px-2 py-1 bg-slate-200 rounded-lg">Base</span>
                      ) : (
                        <button onClick={() => deleteType(t)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={15}/></button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addType()} placeholder="Nuevo tipo..." className="flex-1 bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-blue-500 outline-none" />
                  <button onClick={addType} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all"><Plus size={20}/></button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showInstallmentModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-2xl">Nueva Cuota</h3>
              <button onClick={() => setShowInstallmentModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddInstallment} className="space-y-4">
              <input name="concept" placeholder="Nombre (ej. TV Samsung, Sofá)" required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-medium focus:bg-white focus:border-blue-500 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 ml-1">Precio total</label>
                  <input name="totalAmount" placeholder="$ 0" value={instTotal} onChange={e => setInstTotal(formatInputNumber(e.target.value))} required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-black focus:bg-white focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 ml-1">N° de cuotas</label>
                  <input name="installments" type="number" min="2" max="60" placeholder="12" value={instCount} onChange={e => setInstCount(e.target.value)} required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-black focus:bg-white focus:border-blue-500 outline-none" />
                </div>
              </div>
              {instTotal && instCount && parseInt(instCount) >= 2 && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex justify-between items-center">
                  <span className="text-xs font-black text-blue-500 uppercase">Cuota mensual</span>
                  <span className="font-black text-blue-700">{formatCLP(Math.round(parseRawNumber(instTotal) / parseInt(instCount)))}</span>
                </div>
              )}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 ml-1">Mes de inicio (cuota 1)</label>
                <input name="startMonth" type="month" defaultValue={monthKey} required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select name="type" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-3 py-4 text-sm font-bold outline-none">
                  {movTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select name="category" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-3 py-4 text-sm font-medium outline-none">
                  {movCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowInstallmentModal(false); setInstTotal(''); setInstCount(''); }} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl">CANCELAR</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100">GUARDAR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFixedModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-2xl">Nuevo Gasto Fijo</h3>
              <button onClick={() => setShowFixedModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddFixed} className="space-y-4">
              <input name="concept" placeholder="Nombre (ej. Dividendo, Entel, Gas)" required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-medium focus:bg-white focus:border-green-500 outline-none" />
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 ml-1">Monto mensual</label>
                <input name="amount" placeholder="$ 0" onChange={e => e.target.value = formatInputNumber(e.target.value)} required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-black focus:bg-white focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 ml-1">Mes de inicio</label>
                  <input name="startMonth" type="month" defaultValue={monthKey} required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 ml-1">Mes de término (opcional)</label>
                  <input name="endMonth" type="month" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-green-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select name="type" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-3 py-4 text-sm font-bold outline-none">
                  {movTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select name="category" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-3 py-4 text-sm font-medium outline-none">
                  {movCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFixedModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl">CANCELAR</button>
                <button type="submit" className="flex-1 py-4 bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-100">GUARDAR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {evidenceViewer && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setEvidenceViewer(null)}>
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => setEvidenceViewer(null)} className="absolute -top-10 right-0 text-white/70 hover:text-white"><X size={24}/></button>
            <img src={evidenceViewer.imageBase64} alt="evidencia" className="max-w-full max-h-[88vh] object-contain rounded-2xl" />
            <p className="text-white/50 text-xs text-center mt-3">{evidenceViewer.uploadedAt}</p>
          </div>
        </div>
      )}
    </div>
  );
}
