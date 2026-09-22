import { initializeApp } from 'firebase-admin/app';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

const groqApiKey = defineSecret('GROQ_API_KEY');
const ALLOWED_EMAIL = 'yocoimadejesus@gmail.com';
const TEXT_MODEL = 'openai/gpt-oss-120b';
const VISION_MODEL = 'qwen/qwen3.8-27b';

const assertAuthorized = (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  if (request.auth.token.email !== ALLOWED_EMAIL) throw new HttpsError('permission-denied', 'Usuario no autorizado.');
};

const callGroq = async ({ model, messages }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey.value()}`
      },
      body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } })
    });
    const result = await response.json();
    if (!response.ok) throw new HttpsError('internal', result.error?.message || `Groq respondió ${response.status}.`);
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new HttpsError('internal', 'La IA no devolvió resultados.');
    return JSON.parse(content.replace(/```json|```/g, '').trim());
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.name === 'AbortError') throw new HttpsError('deadline-exceeded', 'La IA tardó demasiado en responder.');
    throw new HttpsError('internal', 'No se pudo completar el análisis de IA.');
  } finally {
    clearTimeout(timeout);
  }
};

export const runFinancialAI = onCall({ secrets: [groqApiKey], timeoutSeconds: 60, memory: '512MiB' }, async request => {
  assertAuthorized(request);
  const action = request.data?.action;

  if (action === 'financialAdvice') {
    const { monthName, income, individualExpenses, sharedExpenses, categories = [], types = [] } = request.data;
    const prompt = `Eres un asesor financiero personal experto. Analiza los datos de ${String(monthName).slice(0, 80)} y entrega consejos claros y accionables en español chileno.
Ingresos: ${Number(income) || 0}
Gastos personales: ${Number(individualExpenses) || 0}
Gastos compartidos: ${Number(sharedExpenses) || 0}
Gastos por categoría: ${JSON.stringify(categories).slice(0, 5000)}
Gastos por tipo: ${JSON.stringify(types).slice(0, 5000)}
Responde SOLO como JSON: {"diagnostico":"texto","ahorro_recomendado":0,"ahorro_porcentaje":0,"recomendaciones":["texto"],"alertas":[],"puntos_positivos":[]}`;
    return callGroq({ model: TEXT_MODEL, messages: [{ role: 'user', content: prompt }] });
  }

  if (action === 'scanReceipt') {
    const imageBase64 = request.data?.imageBase64;
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0 || imageBase64.length > 8_000_000) {
      throw new HttpsError('invalid-argument', 'La imagen no es válida o es demasiado grande.');
    }
    const prompt = 'Analiza esta boleta o factura. Responde SOLO como JSON: {"concept":"comercio o producto principal","amount":valor_total_numerico,"category":"Comida, Gastos fijos, Cuentas, Transporte, Diversión u Otros"}.';
    return callGroq({
      model: VISION_MODEL,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ] }]
    });
  }

  throw new HttpsError('invalid-argument', 'Acción de IA no reconocida.');
});

