/**
 * Chat Widget — Constructor Saúl SpA
 * Conecta con el endpoint webchat de n8n para respuestas con IA.
 * Se autoinyecta al body cuando el DOM esté listo.
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://saaul.app.n8n.cloud/webhook/webchat-saul';
  var GRAD = 'linear-gradient(135deg, #22BED6 0%, #176FC9 50%, #1432B5 100%)';
  var INK = '#0F1216';
  var INK2 = '#14181F';
  var INK3 = '#1A1F28';
  var LINE = '#232932';

  /* ── Session ID ─────────────────────────────────────────── */
  var sessionId = localStorage.getItem('cs_session_id');
  if (!sessionId) {
    sessionId = 'web_' + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
    localStorage.setItem('cs_session_id', sessionId);
  }

  /* ── CSS ─────────────────────────────────────────────────── */
  var css = [
    '#cs-widget{position:fixed;bottom:24px;right:24px;z-index:9999;font-family:"Plus Jakarta Sans",system-ui,sans-serif}',
    '#cs-btn{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:' + GRAD + ';',
    'box-shadow:0 8px 32px -8px rgba(20,50,181,.65);display:flex;align-items:center;justify-content:center;',
    'transition:transform .2s,box-shadow .2s;outline:none}',
    '#cs-btn:hover{transform:translateY(-2px);box-shadow:0 12px 40px -8px rgba(20,50,181,.8)}',
    '#cs-btn svg{width:28px;height:28px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',

    '#cs-panel{position:absolute;bottom:76px;right:0;width:360px;height:520px;',
    'background:' + INK + ';border-radius:16px;overflow:hidden;',
    'box-shadow:0 24px 64px -16px rgba(0,0,0,.75),0 0 0 1px ' + LINE + ';',
    'display:flex;flex-direction:column;transition:opacity .2s,transform .2s}',
    '#cs-panel.cs-hidden{opacity:0;transform:translateY(12px) scale(.97);pointer-events:none}',

    /* Header */
    '#cs-head{background:' + INK2 + ';border-bottom:1px solid ' + LINE + ';',
    'padding:14px 16px;display:flex;align-items:center;justify-content:space-between}',
    '.cs-hi{display:flex;align-items:center;gap:10px}',
    '.cs-av{width:38px;height:38px;border-radius:50%;background:' + GRAD + ';',
    'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;',
    'font-family:Sora,system-ui,sans-serif;flex-shrink:0}',
    '.cs-nm{font-size:14px;font-weight:700;color:rgba(255,255,255,.92);line-height:1.2}',
    '.cs-st{font-size:11.5px;color:#22BED6;font-weight:600;letter-spacing:.04em}',
    '.cs-st::before{content:"● ";font-size:8px}',
    '#cs-close{width:30px;height:30px;border-radius:50%;border:none;cursor:pointer;',
    'background:rgba(255,255,255,.06);color:rgba(255,255,255,.55);font-size:16px;',
    'display:flex;align-items:center;justify-content:center;transition:background .15s}',
    '#cs-close:hover{background:rgba(255,255,255,.12);color:#fff}',

    /* Messages */
    '#cs-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}',
    '#cs-msgs::-webkit-scrollbar{width:4px}',
    '#cs-msgs::-webkit-scrollbar-track{background:transparent}',
    '#cs-msgs::-webkit-scrollbar-thumb{background:' + LINE + ';border-radius:4px}',
    '.cs-msg{display:flex;flex-direction:column;max-width:82%}',
    '.cs-msg.cs-user{align-self:flex-end;align-items:flex-end}',
    '.cs-msg.cs-bot{align-self:flex-start;align-items:flex-start}',
    '.cs-bub{padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.5;word-break:break-word}',
    '.cs-user .cs-bub{background:' + GRAD + ';color:#fff;border-radius:14px 14px 4px 14px}',
    '.cs-bot .cs-bub{background:' + INK3 + ';color:rgba(255,255,255,.88);border:1px solid ' + LINE + ';border-radius:14px 14px 14px 4px}',
    '.cs-ts{font-size:10.5px;color:rgba(255,255,255,.3);margin-top:3px;padding:0 2px}',

    /* Typing */
    '.cs-typing{display:flex;gap:4px;padding:12px 14px;align-items:center}',
    '.cs-dot{width:6px;height:6px;border-radius:50%;background:#22BED6;',
    'animation:cs-bounce .9s infinite ease-in-out}',
    '.cs-dot:nth-child(2){animation-delay:.15s}',
    '.cs-dot:nth-child(3){animation-delay:.3s}',
    '@keyframes cs-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',

    /* Input */
    '#cs-inp-area{border-top:1px solid ' + LINE + ';padding:12px;display:flex;gap:8px;background:' + INK2 + '}',
    '#cs-inp{flex:1;background:' + INK3 + ';border:1px solid ' + LINE + ';border-radius:10px;',
    'padding:10px 14px;color:rgba(255,255,255,.92);font-size:13.5px;font-family:inherit;outline:none;',
    'transition:border-color .15s}',
    '#cs-inp:focus{border-color:#22BED6}',
    '#cs-inp::placeholder{color:rgba(255,255,255,.3)}',
    '#cs-send{width:40px;height:40px;border-radius:10px;border:none;cursor:pointer;',
    'background:' + GRAD + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;',
    'transition:opacity .15s,transform .15s}',
    '#cs-send:hover:not(:disabled){transform:scale(1.05)}',
    '#cs-send:disabled{opacity:.4;cursor:not-allowed}',
    '#cs-send svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',

    /* Badge */
    '#cs-badge{position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;',
    'background:#22BED6;color:#fff;font-size:10px;font-weight:700;display:none;',
    'align-items:center;justify-content:center;border:2px solid ' + INK + '}',

    /* Responsive */
    '@media(max-width:420px){#cs-panel{width:calc(100vw - 32px);right:-8px;height:480px}}'
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── HTML ────────────────────────────────────────────────── */
  var wrap = document.createElement('div');
  wrap.id = 'cs-widget';
  wrap.innerHTML = [
    '<button id="cs-btn" aria-label="Chat con Constructor Saúl SpA" aria-expanded="false">',
      '<span id="cs-badge">1</span>',
      '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    '</button>',
    '<div id="cs-panel" class="cs-hidden" role="dialog" aria-label="Chat Constructor Saúl SpA">',
      '<div id="cs-head">',
        '<div class="cs-hi">',
          '<div class="cs-av">S</div>',
          '<div>',
            '<div class="cs-nm">Constructor Saúl SpA</div>',
            '<div class="cs-st">En línea &mdash; respuesta en segundos</div>',
          '</div>',
        '</div>',
        '<button id="cs-close" aria-label="Cerrar chat">&times;</button>',
      '</div>',
      '<div id="cs-msgs" role="log" aria-live="polite"></div>',
      '<div id="cs-inp-area">',
        '<input id="cs-inp" type="text" placeholder="Escribe tu consulta..." autocomplete="off" maxlength="500" />',
        '<button id="cs-send" aria-label="Enviar" disabled>',
          '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
        '</button>',
      '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(wrap);

  /* ── Elements ───────────────────────────────────────────── */
  var btn    = document.getElementById('cs-btn');
  var panel  = document.getElementById('cs-panel');
  var msgs   = document.getElementById('cs-msgs');
  var inp    = document.getElementById('cs-inp');
  var send   = document.getElementById('cs-send');
  var close  = document.getElementById('cs-close');
  var badge  = document.getElementById('cs-badge');
  var open   = false;
  var busy   = false;

  /* ── Helpers ─────────────────────────────────────────────── */
  function ts() {
    var d = new Date();
    return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function addMsg(text, role) {
    var div = document.createElement('div');
    div.className = 'cs-msg cs-' + role;
    div.innerHTML = '<div class="cs-bub">' + escHtml(text) + '</div><div class="cs-ts">' + ts() + '</div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function escHtml(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  function showTyping() {
    var div = document.createElement('div');
    div.id = 'cs-typing-ind';
    div.className = 'cs-msg cs-bot';
    div.innerHTML = '<div class="cs-bub cs-typing"><div class="cs-dot"></div><div class="cs-dot"></div><div class="cs-dot"></div></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    var t = document.getElementById('cs-typing-ind');
    if (t) t.remove();
  }

  function setBusy(state) {
    busy = state;
    send.disabled = state || !inp.value.trim();
    inp.disabled = state;
  }

  /* ── Toggle ─────────────────────────────────────────────── */
  function togglePanel() {
    open = !open;
    panel.classList.toggle('cs-hidden', !open);
    btn.setAttribute('aria-expanded', open);
    badge.style.display = 'none';
    if (open) {
      // Show greeting on first open
      if (!msgs.children.length) {
        addMsg('¡Hola! Soy el asistente de Constructor Saúl SpA. ¿En qué te puedo ayudar?\n\n(remodelación, ampliación, emergencia, construcción nueva, obra menor)', 'bot');
      }
      setTimeout(function() { inp.focus(); }, 150);
    }
  }

  btn.addEventListener('click', togglePanel);
  close.addEventListener('click', togglePanel);

  /* ── Send ────────────────────────────────────────────────── */
  function doSend() {
    var text = inp.value.trim();
    if (!text || busy) return;
    inp.value = '';
    send.disabled = true;
    addMsg(text, 'user');
    setBusy(true);
    showTyping();

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, message: text })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      hideTyping();
      var reply = (data && data.reply) ? data.reply : 'Recibido. Saúl te responde en breve.';
      addMsg(reply, 'bot');
      // Show badge if panel is closed
      if (!open) {
        badge.style.display = 'flex';
      }
    })
    .catch(function() {
      hideTyping();
      addMsg('Hubo un problema conectando. Por favor escribe al WhatsApp: +56 9 4265 7719', 'bot');
    })
    .finally(function() {
      setBusy(false);
    });
  }

  send.addEventListener('click', doSend);
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  inp.addEventListener('input', function() {
    send.disabled = busy || !inp.value.trim();
  });

  /* ── Show badge on load (invite user) ───────────────────── */
  setTimeout(function() {
    if (!open) {
      badge.style.display = 'flex';
      badge.textContent = '1';
    }
  }, 4000);

})();
