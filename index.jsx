import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  ChevronLeft, ChevronRight, Trash2, ReceiptText, ChevronUp, ChevronDown, Eye, EyeOff,
  CheckCircle2, Camera, Loader2, Edit2, Save, Image as ImageIcon, LogOut, Plus,
  CreditCard, Wallet, ArrowRightLeft, Copy, Check, Download, Upload, ShieldCheck, Settings, X
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
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [installmentPlans, setInstallmentPlans] = useState([]);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  const DEFAULT_TYPES = ['Compartido', 'Individual', 'Yo debo', 'Préstamo', 'Ingreso'];
  const DEFAULT_CATEGORIES = ['Comida', 'Gastos fijos', 'Cuentas', 'Transporte', 'Diversión', 'Sueldo', 'Otros'];
  const [movTypes, setMovTypes] = useState(DEFAULT_TYPES);
  const [movCategories, setMovCategories] = useState(DEFAULT_CATEGORIES);
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [modalTab, setModalTab] = useState('categorias');
  const [newTypeName, setNewTypeName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const camInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const monthKey = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

  // --- FORMATEO ---
  const formatCLP = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(val || 0);
  const formatInputNumber = (val) => {
    if (!val && val !== 0) return "";
    const clean = val.toString().replace(/\D/g, "");
    return clean ? new Intl.NumberFormat('es-CL').format(parseInt(clean, 10)) : "";
  };
  const parseRawNumber = (val) => {
    if (typeof val === 'number') return val;
    return parseInt(val.toString().replace(/\./g, ""), 10) || 0;
  };

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
    const newPlan = {
      id: Date.now().toString(),
      concept: f.get('concept'),
      monthlyAmount: parseRawNumber(f.get('monthlyAmount')),
      installments: parseInt(f.get('installments'), 10),
      startMonth: f.get('startMonth'),
      type: f.get('type'),
      category: f.get('category'),
      paidMonths: []
    };
    const updated = [...installmentPlans, newPlan];
    setInstallmentPlans(updated);
    saveInstallmentPlans(updated);
    setShowInstallmentModal(false);
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

  const getInstallmentStatus = (plan) => {
    const currYear = currentDate.getFullYear();
    const currMonth = currentDate.getMonth() + 1;
    const [startYear, startMonthNum] = plan.startMonth.split('-').map(Number);
    const monthsElapsed = (currYear - startYear) * 12 + (currMonth - startMonthNum);
    const installmentNumber = monthsElapsed + 1;
    const isActive = installmentNumber >= 1 && installmentNumber <= plan.installments;
    const isFinished = installmentNumber > plan.installments;
    const isPaid = (plan.paidMonths || []).includes(monthKey);
    const myPart = plan.type === 'Compartido' ? plan.monthlyAmount / 2 : plan.monthlyAmount;
    return { installmentNumber, isActive, isFinished, isPaid, myPart };
  };

  const activeInstallments = installmentPlans.map(plan => {
    const status = getInstallmentStatus(plan);
    if (!status.isActive) return null;
    return { ...plan, amount: plan.monthlyAmount, ...status };
  }).filter(Boolean);

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
      } else {
        setMovements([]);
        setBalances({ itau: 0, scotia: 0, edenred: 0, tc_deuda: 0 });
        setTcBatches([]);
      }
      setLoading(false);
    }, (err) => setLoading(false));
    return () => unsubscribe();
  }, [user, monthKey]);

  const saveToCloud = async (newMovs, newBals, newBatches = tcBatches) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'monthly_records', monthKey), {
        movements: newMovs,
        balances: newBals,
        tcBatches: newBatches,
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
      myPart: type === 'Compartido' ? amt / 2 : (type === 'Ingreso' ? 0 : amt),
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
        newObj.myPart = type === 'Compartido' ? amt / 2 : (type === 'Ingreso' ? 0 : amt);
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
    const text = pending.map(m => {
      const part = m.type === 'Compartido' ? m.amount / 2 : (m.type === 'Yo debo' ? -m.amount : m.amount);
      return `• ${m.concept}: ${formatCLP(part)}`;
    }).join('\n');
    const total = pending.reduce((acc, m) => acc + (m.type === 'Compartido' ? m.amount / 2 : (m.type === 'Yo debo' ? -m.amount : m.amount)), 0);
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
          if (rawAmount !== 0) items.push({
            id: Date.now().toString() + Math.random(),
            date: firstCol,
            concept: parts[1].trim(),
            amount: rawAmount,
            type: rawAmount < 0 ? 'Ingreso' : 'Individual',
            category: 'Tarjeta Crédito',
            myPart: rawAmount < 0 ? 0 : rawAmount,
            isPaid: false, isExcluded: false
          });
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
          if (rawAmount !== null && rawAmount !== 0) items.push({
            id: Date.now().toString() + Math.random(),
            date: firstCol,
            concept: descLines.join(' ').trim() || 'Sin descripción',
            amount: rawAmount,
            type: rawAmount < 0 ? 'Ingreso' : 'Individual',
            category: 'Tarjeta Crédito',
            myPart: rawAmount < 0 ? 0 : rawAmount,
            isPaid: false, isExcluded: false
          });
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

  const allMovements = [...movements, ...tcBatches.flatMap(b => b.items.filter(i => !i.isExcluded)), ...activeInstallments];

  const totals = allMovements.reduce((acc, m) => {
    if (m.isPaid) return acc;
    if (m.type === 'Ingreso') acc.income += m.amount;
    else if (m.type === 'Individual') acc.indiv += m.amount;
    else if (m.type === 'Compartido' || m.type === 'Deuda' || m.type === 'Préstamo') {
      acc.shared += m.amount;
      acc.debt += (m.type === 'Compartido' ? m.amount / 2 : m.amount);
    }
    else if (m.type === 'Yo debo') {
      acc.indiv += m.amount;
      acc.debt -= m.amount;
    } else {
      acc.indiv += m.amount;
    }
    return acc;
  }, { income: 0, indiv: 0, shared: 0, debt: 0 });

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
            <button onClick={() => signOut(auth)} className="ml-2 p-1.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-all flex items-center gap-1 shadow-sm" title="Cerrar Sesión">
              <LogOut size={16} /> <span className="text-[10px] font-black uppercase hidden lg:inline">Salir</span>
            </button>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft size={20}/></button>
            <div className="px-4 py-1 flex flex-col items-center min-w-[130px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Periodo</span>
              <span className="text-sm font-bold capitalize">{currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' })}</span>
            </div>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight size={20}/></button>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                <span>Historial del Mes</span>
                <button onClick={() => setShowInstallmentModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700 transition-all shadow-sm">
                  <Plus size={14}/> CUOTA
                </button>
              </div>
              <div className="overflow-x-auto">
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
                    {/* Cuotas activas — siempre al inicio */}
                    {[...activeInstallments].sort((a, b) => a.isPaid - b.isPaid).map(inst => (
                      <tr key={'inst_' + inst.id} className={`group border-l-4 border-l-blue-400 ${inst.isPaid ? 'opacity-30' : 'bg-blue-50/20 hover:bg-blue-50/40'}`}>
                        <td className="px-6 py-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{inst.concept}</p>
                              <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">{inst.installmentNumber}/{inst.installments}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{inst.category}</p>
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
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modales */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md">
            <h3 className="font-black text-2xl text-center mb-8">¿Dónde recibiste el pago?</h3>
            <div className="grid gap-3">
              <button onClick={() => {
                const newBals = {...balances, itau: balances.itau + totals.debt};
                const updated = movements.map(m => (m.type==='Compartido'||m.type==='Deuda'||m.type==='Préstamo') ? {...m, isPaid: true} : m);
                setBalances(newBals); setMovements(updated); saveToCloud(updated, newBals); setShowPaymentModal(false);
              }} className="p-6 bg-slate-50 border-2 rounded-3xl font-black text-lg hover:border-blue-500 transition-all text-center">Banco Itaú</button>
              <button onClick={() => {
                const newBals = {...balances, scotia: balances.scotia + totals.debt};
                const updated = movements.map(m => (m.type==='Compartido'||m.type==='Deuda'||m.type==='Préstamo') ? {...m, isPaid: true} : m);
                setBalances(newBals); setMovements(updated); saveToCloud(updated, newBals); setShowPaymentModal(false);
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
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 ml-1">Monto por cuota</label>
                  <input name="monthlyAmount" placeholder="$ 0" onChange={e => e.target.value = formatInputNumber(e.target.value)} required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-black focus:bg-white focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 ml-1">N° de cuotas</label>
                  <input name="installments" type="number" min="2" max="60" placeholder="12" required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-black focus:bg-white focus:border-blue-500 outline-none" />
                </div>
              </div>
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
                <button type="button" onClick={() => setShowInstallmentModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl">CANCELAR</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100">GUARDAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}