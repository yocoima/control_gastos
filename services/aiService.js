import { auth } from './firebaseClient.js';

const WORKER_URL = String(import.meta.env.VITE_AI_WORKER_URL || '').replace(/\/$/, '');

const callFinancialAI = async (payload) => {
  if (!WORKER_URL) throw new Error('Falta configurar VITE_AI_WORKER_URL con la dirección del Worker de IA.');
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${WORKER_URL}/ai`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await currentUser.getIdToken()}`
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `El servicio de IA respondió con error ${response.status}.`);
    return result.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La IA tardó demasiado en responder. Intenta nuevamente.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const requestFinancialAdvice = async (payload) => (
  callFinancialAI({ action: 'financialAdvice', ...payload })
);

export const scanReceiptImage = async (imageBase64) => (
  callFinancialAI({ action: 'scanReceipt', imageBase64 })
);
