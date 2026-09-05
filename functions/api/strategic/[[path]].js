const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff'
};

const DEFAULT_SUPABASE_URL = 'https://cjvztlvxdsuiluybvtpl.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdnp0bHZ4ZHN1aWx1eWJ2dHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjU3MDAsImV4cCI6MjEwNDA0MTcwMH0.E-aIfV1P8XUDRW-lGC7lC6x6eOpwIdJeCpFDnxOI-uY';

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function clean(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\r\n]/g, '');
}

function getConfiguration(env) {
  const url = clean(env?.VITE_SUPABASE_URL || env?.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL)
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');
  const publicKey = clean(
    env?.VITE_SUPABASE_ANON_KEY ||
    env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
  const serverKey = clean(env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY || publicKey);
  const geminiKey = clean(env?.GEMINI_API_KEY || env?.GOOGLE_GENAI_API_KEY || env?.VITE_GEMINI_API_KEY || '');

  return { url, publicKey, serverKey, geminiKey };
}

function bearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
}

async function verifyAuth(config, token) {
  if (!token) return null;
  try {
    const res = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.publicKey,
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function generateWithGemini(apiKey, prompt, mimeType, base64Data) {
  if (!apiKey) {
    throw new Error('El motor de Inteligencia Artificial no tiene una llave de API configurada en el servidor.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  
  let parts = [];
  if (base64Data && mimeType) {
    parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
  }
  parts.push({ text: prompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en el motor de IA (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
}

export async function onRequest(context) {
  const { request, env } = context;
  const config = getConfiguration(env);
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...JSON_HEADERS,
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type, apikey',
        'access-control-max-age': '86400'
      }
    });
  }

  const token = bearerToken(request);
  const user = await verifyAuth(config, token);
  if (!user) {
    return json({ error: 'Sesión no autorizada o expirada.' }, 401);
  }

  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  // 1. Matriz DOFA / SWOT con IA
  if (pathname.endsWith('/swot-generate')) {
    const { campaignId } = body;
    if (!campaignId) return json({ error: 'Se requiere una campaña activa.' }, 400);

    try {
      const campRes = await fetch(`${config.url}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}&select=id,nombre,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion,meta_votos,presupuesto_total,descripcion&limit=1`, {
        headers: {
          apikey: config.serverKey || config.publicKey,
          Authorization: `Bearer ${config.serverKey || token}`
        }
      });
      const campaigns = campRes.ok ? await campRes.json() : [];
      const campaign = Array.isArray(campaigns) ? campaigns[0] : null;
      if (!campaign) return json({ error: 'No se encontró la campaña.' }, 404);

      let description = {};
      try { description = JSON.parse(campaign.descripcion || '{}'); } catch { description = {}; }

      const evidence = {
        campaign: {
          name: campaign.nombre,
          candidate: campaign.candidato_nombre,
          office: campaign.cargo_postulacion,
          department: campaign.departamento,
          municipality: campaign.municipio,
          voteGoal: campaign.meta_votos,
          budget: campaign.presupuesto_total
        },
        candidateProfile: description.candidateProfile || {},
        territorialDiagnosis: description.territorialDiagnosis || {},
        campaignDiagnosis: description.campaignDiagnosis || {}
      };

      const prompt = `Actúa como analista electoral senior. Construye una matriz DOFA usando exclusivamente los datos del JSON aportado. No inventes datos. Devuelve únicamente JSON válido con {"strengths":string[],"weaknesses":string[],"opportunities":string[],"threats":string[]}. Máximo 6 factores por categoría. EVIDENCIA: ${JSON.stringify(evidence).slice(0, 40000)}`;
      const rawResult = await generateWithGemini(config.geminiKey, prompt);
      const parsed = JSON.parse(rawResult);

      return json({
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(s => typeof s === 'string' && s.trim()) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter(w => typeof w === 'string' && w.trim()) : [],
        opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.filter(o => typeof o === 'string' && o.trim()) : [],
        threats: Array.isArray(parsed.threats) ? parsed.threats.filter(t => typeof t === 'string' && t.trim()) : []
      });
    } catch (error) {
      return json({ error: error?.message || 'No fue posible generar la matriz DOFA.' }, 500);
    }
  }

  // 2. Generación de Contenido para Redes y Comunicaciones con IA
  if (pathname.endsWith('/content-generate')) {
    const { campaignId, topic, platform, tone, targetAudience, keyHighlight } = body;
    if (!campaignId || !topic) return json({ error: 'Campaña y tema son obligatorios.' }, 400);

    try {
      const campRes = await fetch(`${config.url}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}&select=id,nombre,candidato_nombre,cargo_postulacion,departamento,municipio,descripcion&limit=1`, {
        headers: {
          apikey: config.serverKey || config.publicKey,
          Authorization: `Bearer ${config.serverKey || token}`
        }
      });
      const campaigns = campRes.ok ? await campRes.json() : [];
      const campaign = Array.isArray(campaigns) ? campaigns[0] : null;

      let description = {};
      try { description = JSON.parse(campaign?.descripcion || '{}'); } catch { description = {}; }

      const evidence = {
        candidate: campaign?.candidato_nombre || '',
        office: campaign?.cargo_postulacion || '',
        territory: [campaign?.municipio, campaign?.departamento].filter(Boolean).join(', '),
        profile: description.candidateProfile || {},
        narrative: description.strategicIdentity || {}
      };

      const prompt = `Crea una pieza de comunicación electoral en español para ${platform || 'Redes'}, tono ${tone || 'Profesional'}, tema: "${topic}". Audiencia: ${targetAudience || 'General'}. Destacado: ${keyHighlight || 'No especificado'}. Devuelve solo JSON válido: {"hook":"","caption":"","videoScript":"","hashtags":string[],"callToAction":""}. Datos reales del candidato: ${JSON.stringify(evidence).slice(0, 30000)}`;
      const rawResult = await generateWithGemini(config.geminiKey, prompt);
      const parsed = JSON.parse(rawResult);

      return json({
        hook: String(parsed.hook || ''),
        caption: String(parsed.caption || ''),
        videoScript: String(parsed.videoScript || ''),
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter(tag => typeof tag === 'string') : [],
        callToAction: String(parsed.callToAction || '')
      });
    } catch (error) {
      return json({ error: error?.message || 'No fue posible generar el contenido comunicacional.' }, 500);
    }
  }

  // 3. Análisis de Hoja de Vida / CV con IA
  if (pathname.endsWith('/cv-analyze')) {
    const { campaignId, storagePath } = body;
    if (!campaignId || !storagePath) return json({ error: 'Documento o campaña inválidos.' }, 400);

    try {
      const docRes = await fetch(`${config.url}/storage/v1/object/authenticated/campaign-documents/${encodeURIComponent(storagePath)}`, {
        headers: {
          apikey: config.serverKey || config.publicKey,
          Authorization: `Bearer ${config.serverKey || token}`
        }
      });

      if (!docRes.ok) {
        return json({ error: 'No se encontró el documento en el almacenamiento seguro.' }, 404);
      }

      const mimeType = docRes.headers.get('content-type') || 'application/pdf';
      const arrayBuffer = await docRes.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const prompt = `Extrae información explícita de esta hoja de vida. Devuelve exclusivamente JSON válido: {"academicDegrees":[{"title":"","institution":"","year":"","level":"Pregrado|Posgrado|Maestría|Doctorado"}],"experienceItems":[{"role":"","entityCompany":"","period":"","achievements":"","type":"Público|Privado"}],"financialDeclaration":{"totalAssets":0,"totalLiabilities":0,"netWorth":0,"taxReturnYear":"","declarationStatus":""}}.`;
      const rawResult = await generateWithGemini(config.geminiKey, prompt, mimeType, base64Data);
      const parsed = JSON.parse(rawResult);

      return json({
        academicDegrees: Array.isArray(parsed.academicDegrees) ? parsed.academicDegrees : [],
        experienceItems: Array.isArray(parsed.experienceItems) ? parsed.experienceItems : [],
        financialDeclaration: parsed.financialDeclaration || { totalAssets: 0, totalLiabilities: 0, netWorth: 0, taxReturnYear: '', declarationStatus: '' },
        backgroundChecks: { procuraduria: '', contraloria: '', fiscalia: '', cneStatus: '', verifiedDate: '' }
      });
    } catch (error) {
      return json({ error: error?.message || 'No fue posible analizar la hoja de vida.' }, 500);
    }
  }

  return json({ error: 'Ruta estratégica no encontrada.' }, 404);
}
