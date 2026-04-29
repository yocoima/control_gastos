import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  ChevronLeft, ChevronRight, Trash2, ReceiptText, 
  CheckCircle2, Camera, Loader2, Edit2, Save, Image as ImageIcon, LogOut,
  CreditCard, Wallet, ArrowRightLeft, Copy, Check, Download, Upload, ShieldCheck
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
const GEMINI_API_KEY = "AIzaSyDhfgfPbyK-Es1MSwlq7s35JtFq4110DAA"; // Tu clave de API de Gemini

export default function App() {
  const [user, setUser] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1)); // Abril 2026
  const [movements, setMovements] = useState([]);
  const [balances, setBalances] = useState({ itau: 0, scotia: 0, edenred: 0, tc_deuda: 0 });
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTCPaymentModal, setShowTCPaymentModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const camInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const monthKey = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

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
      console.error("Error al iniciar sesión", err);
    }
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
      } else {
        setMovements([]);
        setBalances({ itau: 0, scotia: 0, edenred: 0, tc_deuda: 0 });
      }
      setLoading(false);
    }, (err) => setLoading(false));
    return () => unsubscribe();
  }, [user, monthKey]);

  const saveToCloud = async (newMovs, newBals) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', APP_COLLECTION_ID, 'users', user.uid, 'monthly_records', monthKey), {
      movements: newMovs,
      balances: newBals,
      updatedAt: new Date().toISOString()
    });
  };

  // --- IA Y ACCIONES ---
  const processImage = async (file) => {
    if (!file) return;
    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const prompt = "Analiza esta boleta. Extrae JSON: {\"concept\": \"...\", \"amount\": 0, \"category\": \"...\"}. Categorías: Comida, Gastos fijos, Cuentas, Transporte, Diversión, Otros.";
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64Data } }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        const result = await response.json();
        const data = JSON.parse(result.candidates[0].content.parts[0].text);
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
      };
    } catch (err) { console.error(err); } finally { setIsScanning(false); }
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
    const pending = movements.filter(m => (m.type==='Compartido'||m.type==='Deuda'||m.type==='Préstamo') && !m.isPaid);
    const text = pending.map(m => {
      const part = m.type === 'Compartido' ? m.amount / 2 : m.amount;
      return `• ${m.concept}: ${formatCLP(part)}`;
    }).join('\n');
    const total = pending.reduce((acc, m) => acc + (m.type === 'Compartido' ? m.amount / 2 : m.amount), 0);
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
    reader.onload = (e) => {
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
        saveToCloud(updated, balances);
      } catch (error) {
        console.error("Error importando datos:", error);
      }
    };
    reader.readAsText(file);
    if(csvInputRef.current) csvInputRef.current.value = ''; // Resetear el input
  };

  const totals = movements.reduce((acc, m) => {
    if (m.isPaid) return acc;
    if (m.type === 'Ingreso') acc.income += m.amount;
    else if (m.type === 'Individual') acc.indiv += m.amount;
    else if (m.type === 'Compartido' || m.type === 'Deuda' || m.type === 'Préstamo') {
      acc.shared += m.amount;
      acc.debt += (m.type === 'Compartido' ? m.amount / 2 : m.amount);
    }
    return acc;
  }, { income: 0, indiv: 0, shared: 0, debt: 0 });

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
                    <option value="Compartido">Compartido</option>
                    <option value="Individual">Personal</option>
                    <option value="Préstamo">Préstamo</option>
                    <option value="Ingreso">Ingreso</option>
                  </select>
                </div>
                <select name="category" className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-4 text-sm font-medium outline-none">
                  {["Comida", "Gastos fijos", "Cuentas", "Transporte", "Diversión", "Sueldo", "Otros"].map(c => <option key={c}>{c}</option>)}
                </select>
                <button className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all">GUARDAR</button>
              </form>
            </div>

            {/* Cobros Pendientes Karla */}
            {totals.debt > 0 && (
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm ring-4 ring-slate-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deuda de Karla</h3>
                  <button 
                    onClick={copyDebtDetails} 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                  >
                    {copied ? <Check size={12}/> : <Copy size={12}/>}
                    {copied ? 'COPIADO' : 'COPIAR DETALLE'}
                  </button>
                </div>
                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {movements.filter(m => (m.type==='Compartido'||m.type==='Deuda'||m.type==='Préstamo') && !m.isPaid).map(m => (
                    <div key={m.id} className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium truncate pr-4">{m.concept} {m.type === 'Préstamo' && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded">100%</span>}</span>
                      <span className="font-bold whitespace-nowrap">{formatCLP(m.type==='Compartido' ? m.amount/2 : m.amount)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowPaymentModal(true)} className="w-full bg-green-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 shadow-lg shadow-green-100 transition-all">
                  <CheckCircle2 size={20}/> REGISTRAR PAGO
                </button>
              </div>
            )}
          </div>

          {/* Historial */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50/50 font-black">Historial del Mes</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr>
                      <th className="px-6 py-4 text-left">Detalle</th>
                      <th className="px-6 py-4 text-left">Tipo</th>
                      <th className="px-6 py-4 text-right">Total</th>
                      <th className="px-6 py-4 text-right">Mi Parte</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {movements.slice().reverse().map(m => (
                      <tr key={m.id} className={`group ${m.isPaid ? 'opacity-30' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          {editingId === m.id ? (
                            <input className="w-full border-2 border-blue-200 rounded-xl px-2 py-1 font-bold" value={m.concept} onChange={e => handleUpdate(m.id, 'concept', e.target.value)} autoFocus />
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
                              <option value="Compartido">Compartido</option>
                              <option value="Individual">Personal</option>
                              <option value="Préstamo">Préstamo</option>
                              <option value="Ingreso">Ingreso</option>
                            </select>
                          ) : (
                            <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${m.type === 'Ingreso' ? 'bg-green-100 text-green-700' : m.type === 'Préstamo' ? 'bg-amber-100 text-amber-700' : m.type === 'Individual' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{m.type}</span>
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
    </div>
  );
}