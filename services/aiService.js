import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseClient.js';

const runFinancialAI = httpsCallable(functions, 'runFinancialAI', { timeout: 60000 });

export const requestFinancialAdvice = async (payload) => {
  const result = await runFinancialAI({ action: 'financialAdvice', ...payload });
  return result.data;
};

export const scanReceiptImage = async (imageBase64) => {
  const result = await runFinancialAI({ action: 'scanReceipt', imageBase64 });
  return result.data;
};

