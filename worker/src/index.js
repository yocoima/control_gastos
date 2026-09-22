const TEXT_MODEL = 'openai/gpt-oss-120b';
const VISION_MODEL = 'qwen/qwen3.8-27b';

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  }
});

const getAllowedOrigin = (request, env) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim());
  return allowed.includes(origin) ? origin : '';
};

const authenticate = async (request, env) => {
  const header = request.headers.get('Authorization') || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) throw new Response('Debes iniciar sesión.', { status: 401 });

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const result = await response.json();
  const account = result.users?.[0];
  if (!response.ok || !account) throw new Response('La sesión no es válida o expiró.', { status: 401 });
  if (account.email !== env.ALLOWED_EMAIL) throw new Response('Tu cuenta no tiene permiso para usar la IA.', { status: 403 });
};

const callGroq = async (env, { model, messages }) => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      temperature: 0.2
    })
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('La clave de Groq no es válida o el modelo no está habilitado.');
    if (response.status === 404) throw new Error(`El modelo ${model} no está disponible en Groq.`);
    if (response.status === 429) throw new Error('Se alcanzó temporalmente el límite gratuito de Groq. Intenta más tarde.');
    throw new Error(result.error?.message || 'Groq no pudo completar la solicitud.');
  }
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('La IA no devolvió resultados.');
  try {
    return JSON.parse(content.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('La IA devolvió una respuesta con formato inválido.');
  }
};

const handleAI = async (request, env) => {
  await authenticate(request, env);
  const payload = await request.json();

  if (payload.action === 'financialAdvice') {
    const prompt = `Eres un asesor financiero personal experto. Analiza los datos de ${String(payload.monthName || '').slice(0, 80)} y entrega consejos claros y accionables en español chileno.
Ingresos: ${Number(payload.income) || 0}
Gastos personales: ${Number(payload.individualExpenses) || 0}
Gastos compartidos: ${Number(payload.sharedExpenses) || 0}
Gastos por categoría: ${JSON.stringify(payload.categories || []).slice(0, 5000)}
Gastos por tipo: ${JSON.stringify(payload.types || []).slice(0, 5000)}
Responde SOLO como JSON: {"diagnostico":"texto","ahorro_recomendado":0,"ahorro_porcentaje":0,"recomendaciones":["texto"],"alertas":[],"puntos_positivos":[]}`;
    return callGroq(env, { model: TEXT_MODEL, messages: [{ role: 'user', content: prompt }] });
  }

  if (payload.action === 'scanReceipt') {
    const imageBase64 = payload.imageBase64;
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0 || imageBase64.length > 2_000_000) {
      throw new Response('La imagen no es válida o es demasiado grande.', { status: 400 });
    }
    const prompt = 'Analiza esta boleta o factura. Responde SOLO como JSON: {"concept":"comercio o producto principal","amount":valor_total_numerico,"category":"Comida, Gastos fijos, Cuentas, Transporte, Diversión u Otros"}.';
    return callGroq(env, {
      model: VISION_MODEL,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ] }]
    });
  }

  throw new Response('Acción de IA no reconocida.', { status: 400 });
};

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request, env);
    if (!origin) return new Response('Origen no permitido.', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/ai') {
      return json({ error: 'Ruta no encontrada.' }, 404, origin);
    }
    if (!env.GROQ_API_KEY) return json({ error: 'Falta configurar el secreto GROQ_API_KEY en Cloudflare.' }, 500, origin);

    try {
      return json({ data: await handleAI(request, env) }, 200, origin);
    } catch (error) {
      if (error instanceof Response) return json({ error: await error.text() }, error.status, origin);
      console.error('AI Worker error', error);
      return json({ error: error.message || 'No se pudo completar la solicitud de IA.' }, 502, origin);
    }
  }
};
