/**
 * api/chat.js — Vercel Serverless Function
 * Constructor Saúl SpA — Web Chat Bot
 *
 * Flujo: recibe {sessionId, message} → Supabase session → OpenAI → guarda mensajes
 *        → si hay lead real: notifica a Saúl por WhatsApp → devuelve {reply}
 *
 * Env vars requeridas (configurar en Vercel Dashboard → Settings → Environment Variables):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY,
 *   META_PHONE_NUMBER_ID, META_API_TOKEN, SAUL_NOTIFY_WA
 */

const SYSTEM_PROMPT = `Eres el asistente virtual de Constructor Saúl SpA, una empresa de construcción y mantención en Santiago de Chile (Región Metropolitana). Tu trabajo es atender consultas por el chat del sitio web, capturar leads ordenadamente, y preparar casos para que Saúl los cierre. NO eres un constructor — eres un filtro inteligente.

## IDENTIDAD
- Nombre: Asistente Constructor Saúl SpA
- Idioma: español chileno
- Tono: cercano, directo, sin tecnicismos. Trato de "tú" o "usted" según como hable el cliente
- Voz: profesional pero relajada — como un vendedor chileno con experiencia
- Empresa: Constructor Saúl SpA — 12 años experiencia, equipo de 4 + 2 Constructores Civiles titulados, WhatsApp Business verificado por Meta, identidad verificada en 2x3.cl

## SERVICIOS Y PRECIOS (siempre "desde")

### Construcción de Casas
- Panel SIP: desde $450.000/m² — rápido (40-60 días), buena aislación, ideal 1 piso
- Estructura Metálica: desde $850.000/m² — robusta, ideal 2 pisos o cargas mayores

### Mantención Express y Emergencias
- Reparaciones críticas: desde $85.000 — disponibilidad 24/7

### Remodelaciones
- Integral (baño/cocina): desde $1.500.000
- Shower door: desde $95.000 · Sellado silicona: desde $35.000

### Obras Menores
- Pintura muros/cielos: desde $12.500/m² · Piso flotante: desde $9.500/m²
- Tabiquería volcanita: desde $18.500/m² · Puntos eléctricos: desde $18.000

### Ampliaciones
- Desde $450.000/m² — sobre 6m² requiere permiso o regularización

## REGLA — PRECIOS
NUNCA des precio cerrado. SIEMPRE "desde $X" o rangos. Cierra estimaciones con: "precio final se confirma con visita técnica".

## REGLA — COBERTURA
Comunas RM sin viático: San Bernardo, El Bosque, La Cisterna, San Miguel, Pedro Aguirre Cerda, Maipú, Cerrillos, Estación Central, Lo Espejo, La Granja, La Pintana, San Ramón, La Florida, Centro, Ñuñoa, Providencia, Macul y comunas vecinas.
Fuera de RM: "Para [comuna], aplica viático a evaluar caso a caso. Te conecto con Saúl directo." y DERIVA.

## REGLA — DERIVAR A SAÚL (9 casos)
Cuando detectes cualquiera, responde corto+empático y marca derive_reason:
1. Precio FINAL exacto exigido
2. Confirmar día/hora exacta de visita
3. Reclamo obra anterior
4. Permisos / regularización municipal
5. Postventa / garantía
6. Proyectos > $20.000.000
7. B2B / empresa (RUT empresa, inmobiliaria, licitación)
8. Materiales del cliente ("yo tengo los materiales", "solo mano de obra")
9. Emergencia urgente ("urgente", "emergencia", "filtración", "peligro", "ahora mismo")

Al derivar di: "Recibido. Saúl ya tiene tu mensaje y te contacta directo al número que dejes. Mientras, ¿me das tu nombre y teléfono o WhatsApp para que te llame?"

## CAPTURA DE DATOS (antes de cerrar cualquier consulta)
Asegúrate de tener: nombre, teléfono o WhatsApp, comuna, tipo de proyecto, urgencia, horario preferido visita.

## CIERRE
"Listo [Nombre]. Resumen: Proyecto: [tipo] · Comuna: [comuna] · Visita propuesta: [horario propuesto] Te confirmo con Saúl en menos de 24h."

## REGLAS DURAS
- NUNCA precios cerrados ni día/hora exacta sin Saúl
- NUNCA confirmes cobertura fuera RM
- SIEMPRE deriva los 9 casos
- SIEMPRE responde en español chileno cercano
- SIEMPRE conciso (máx 4-5 líneas por mensaje)

## FORMATO — devuelve SIEMPRE este JSON exacto:
{"reply":"texto visible al visitante","intent":"remodelacion|ampliacion|emergencia|obra_nueva|obra_menor|catalogo|saludo|duda|derivar|otro","derive_reason":null,"captured":{"name":null,"phone":null,"comuna":null,"project_type":null,"urgency":null,"preferred_visit_time":null},"next_action":"continue|propose_visit|derive_human|close_with_summary"}`;

module.exports = async function handler(req, res) {
  // CORS — permite llamadas desde el mismo dominio y desde desarrollo local
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId, message } = req.body || {};
  if (!sessionId || !message?.trim()) {
    return res.status(400).json({ error: 'Faltan sessionId o message' });
  }

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY,
    META_PHONE_NUMBER_ID,
    META_API_TOKEN,
    SAUL_NOTIFY_WA,
  } = process.env;

  const SUPABASE_SERVICE_KEY = SUPABASE_SERVICE_ROLE_KEY;

  // Fallback si faltan vars (evita crash en preview sin configurar)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
    const missing = [
      !SUPABASE_URL && 'SUPABASE_URL',
      !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
      !OPENAI_API_KEY && 'OPENAI_API_KEY',
    ].filter(Boolean).join(', ');
    console.error('[chat.js] Missing env vars:', missing);
    return res.status(200).json({
      reply: '¡Hola! Por ahora puedes contactarnos directamente: WhatsApp +56 9 4265 7719 o al correo saul.constructor25@gmail.com',
      _debug_missing: missing,
    });
  }

  const waId = 'webchat_' + sessionId;
  const sbHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'apikey': SUPABASE_SERVICE_KEY,
  };

  try {
    // ── 1. Buscar o crear conversación en Supabase ─────────────────────────
    const convSearch = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?wa_id=eq.${encodeURIComponent(waId)}&select=id,wa_id&limit=1`,
      { headers: sbHeaders }
    );
    const convList = await convSearch.json();

    let conversationId;
    if (convList.length) {
      conversationId = convList[0].id;
    } else {
      const convCreate = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({ wa_id: waId, phone: 'webchat', status: 'active' }),
      });
      const created = await convCreate.json();
      conversationId = Array.isArray(created) ? created[0].id : created.id;
    }

    // ── 2. Historial de mensajes (últimos 20) ──────────────────────────────
    const histRes = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conversationId}&order=created_at.asc&limit=20&select=role,content`,
      { headers: sbHeaders }
    );
    const history = await histRes.json();
    const historyMessages = Array.isArray(history)
      ? history.map(m => ({ role: m.role, content: m.content }))
      : [];

    // ── 3. Llamar OpenAI ───────────────────────────────────────────────────
    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...historyMessages,
          { role: 'user', content: message.trim() },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
    const oaiData = await oaiRes.json();

    // ── 4. Parsear respuesta ───────────────────────────────────────────────
    let parsed;
    try {
      parsed = JSON.parse(oaiData.choices[0].message.content);
    } catch {
      parsed = {
        reply: 'Disculpa el inconveniente técnico. Para consultas urgentes: +56 9 4265 7719',
        intent: 'otro',
        derive_reason: null,
        captured: {},
        next_action: 'continue',
      };
    }
    const reply = parsed.reply || 'Saúl te responde en breve.';
    const captured = parsed.captured || {};

    // ── 5. Guardar mensajes + actualizar conversación (paralelo) ───────────
    await Promise.all([
      // Mensaje del usuario
      fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({
          conversation_id: conversationId,
          role: 'user',
          content: message.trim(),
        }),
      }),
      // Respuesta del bot
      fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({
          conversation_id: conversationId,
          role: 'assistant',
          content: reply,
          meta_data: {
            intent: parsed.intent,
            derive_reason: parsed.derive_reason,
            next_action: parsed.next_action,
          },
        }),
      }),
      // Actualizar conversación con datos capturados
      fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({
          last_intent: parsed.intent || null,
          derive_reason: parsed.derive_reason || null,
          customer_name: captured.name || null,
          comuna: captured.comuna || null,
          project_type: captured.project_type || null,
          urgency: captured.urgency || null,
        }),
      }),
    ]);

    // ── 6. Notificar a Saúl si es un lead real ────────────────────────────
    if (parsed.derive_reason && META_PHONE_NUMBER_ID && META_API_TOKEN && SAUL_NOTIFY_WA) {
      const notifLines = [
        `🔔 LEAD WEB — ${parsed.derive_reason.toUpperCase()}`,
        captured.name    ? `Nombre: ${captured.name}` : null,
        captured.phone   ? `Tel: ${captured.phone}` : null,
        captured.comuna  ? `Comuna: ${captured.comuna}` : null,
        captured.project_type ? `Proyecto: ${captured.project_type}` : null,
        captured.urgency ? `Urgencia: ${captured.urgency}` : null,
        `Mensaje: "${message.trim().slice(0, 120)}"`,
        `→ Origen: web (${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })})`,
      ].filter(Boolean).join('\n');

      // Fire-and-forget — no bloquea la respuesta al visitante
      fetch(`https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${META_API_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: SAUL_NOTIFY_WA,
          type: 'text',
          text: { body: notifLines },
        }),
      }).catch(() => {}); // silencia errores de notificación
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('[chat.js] Error:', err);
    return res.status(200).json({
      reply: 'Tuve un problema técnico. Escríbenos directamente al +56 9 4265 7719',
    });
  }
};
