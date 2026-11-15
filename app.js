/* FORJA · Dieta e Treino — app pessoal (PWA). Dados em localStorage, chave dieta_treino_v1.
   Arquivos: index.html (tela e estilo) · alimentos.js e exercicios.js (tabelas) · app.js (este programa). */
'use strict';
const APP_VERSAO = '1.7';
const KEY = 'dieta_treino_v1';
const SCHEMA = 3;

/* ===================== utilidades ===================== */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function sem(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function r0(v) { return Math.round(v || 0); }
function r1(v) { return Math.round((v || 0) * 10) / 10; }
function fmt(v, d) { return (v == null || isNaN(v)) ? '–' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }

/* Datas sempre LOCAIS (UNIV-ERR-009): nunca toISOString() */
function pad(n) { return String(n).padStart(2, '0'); }
function isoDe(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hojeISO() { return isoDe(new Date()); }
function dataDe(iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
function addDias(iso, n) { const d = dataDe(iso); d.setDate(d.getDate() + n); return isoDe(d); }
function diffDias(a, b) { const pa = a.split('-').map(Number), pb = b.split('-').map(Number); return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5); }
function diaSemana(iso) { return dataDe(iso).getDay(); }
const DSEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function rotuloDia(iso) {
  const h = hojeISO();
  if (iso === h) return 'Hoje';
  if (iso === addDias(h, -1)) return 'Ontem';
  if (iso === addDias(h, 1)) return 'Amanhã';
  const d = dataDe(iso); return DSEM[d.getDay()] + ', ' + d.getDate() + ' ' + MESES[d.getMonth()];
}
function dataCurta(iso) { const d = dataDe(iso); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
function horaAgora() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function dtLocal(d) { return isoDe(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function minutosEntre(ini, fim) { /* 'YYYY-MM-DDTHH:MM' locais */
  const a = new Date(ini), b = new Date(fim); return Math.round((b - a) / 60000);
}
function hm(min) { min = Math.max(0, Math.round(min)); return Math.floor(min / 60) + 'h' + pad(min % 60); }

/* ===================== armazenamento ===================== */
function padrao() {
  return {
    schema: SCHEMA, perfil: null, treino: null, cardio: null,
    dias: {}, sono: [], sonoAberto: null, peso: [], meus: [], favs: [], recentes: [],
    modelos: [], ultG: {}, plantao: null, plantaoDias: {}, fotos: [], notasCorpo: {}, medidas: [], jejum: null, bio: [],
    cfg: { copo: 250, refeicoes: ['cafe', 'almoco', 'lanche2', 'jantar', 'ceia'], evitar: [], ultimoBackup: null, backupAdiado: null, semSal: false, economico: false }
  };
}
/* roda a cada abertura e a cada cópia importada: precisa poder rodar mais de uma vez sem estragar nada */
function migrar(o) {
  const p = padrao();
  for (const k in p) if (o[k] === undefined || o[k] === null && p[k] !== null) o[k] = p[k];
  if (!o.cfg || typeof o.cfg !== 'object') o.cfg = p.cfg;
  for (const k in p.cfg) if (o.cfg[k] === undefined) o.cfg[k] = p.cfg[k];
  if (o.treino) delete o.treino.nivel; /* campo antigo, nunca usado */
  delete o.cfg.mostrarEsp; /* 1.6: produtos diet/light aparecem sempre; as papinhas saíram da tabela */
  /* 1.6: os pares "c/ sal" e "s/ sal" viraram um item só; troca os códigos antigos pelo que ficou */
  const AL = window.ALIM_ALIAS || {};
  const r = id => AL[id] || id;
  for (const iso in o.dias) {
    const d = o.dias[iso]; if (!d || !d.ref) continue;
    for (const k in d.ref) (d.ref[k] || []).forEach(it => { if (it.f) it.f = r(it.f); });
  }
  (o.modelos || []).forEach(m => (m.itens || []).forEach(it => { if (it.f) it.f = r(it.f); }));
  const unicos = l => Array.from(new Set((l || []).map(r)));
  o.recentes = unicos(o.recentes); o.favs = unicos(o.favs); o.cfg.evitar = unicos(o.cfg.evitar);
  const ug = {}; for (const k in o.ultG) ug[r(k)] = o.ultG[k]; o.ultG = ug;
  /* 1.6: a cintura ficava também no registro de peso; agora fica só em Medidas */
  (o.peso || []).forEach(x => {
    if (x.cintura) {
      let m = o.medidas.find(y => y.d === x.d);
      if (!m) { m = { d: x.d }; o.medidas.push(m); }
      if (m.cintura == null) m.cintura = x.cintura;
    }
    delete x.cintura;
  });
  o.schema = SCHEMA;
  return o;
}
/* 1.6: antes da primeira conversão, os dados ficam guardados como estavam (Eu › Meus dados › baixar),
   e assim dá para voltar à versão anterior sem perder nada. Se não couber, a pessoa baixa na hora. */
const KEY_ANTES = 'dieta_treino_v1_antes_1_6';
let textoAntes = null; /* só fica preenchido se não coube guardar a cópia */
function carregar() {
  try {
    const t = localStorage.getItem(KEY); if (!t) return padrao();
    const o = JSON.parse(t);
    if ((o.schema || 0) < 3 && !localStorage.getItem(KEY_ANTES)) {
      try { localStorage.setItem(KEY_ANTES, t); } catch (e) { textoAntes = t; }
    }
    return migrar(o);
  }
  catch (e) { console.error(e); return padrao(); }
}
function temCopiaAntes() { try { return !!(textoAntes || localStorage.getItem(KEY_ANTES)); } catch (e) { return false; } }
function baixarTexto(texto, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' })); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
let _metas = null; /* cache das metas: limpo a cada salvar() e render() */
let S = carregar();
/* pede ao navegador para não apagar os dados sozinho (Safari/Chrome podem limpar armazenamento de sites pouco abertos) */
let armazenamentoPersistente = null;
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then(p => p ? true : navigator.storage.persist()).then(p => { armazenamentoPersistente = !!p; }).catch(() => { });
}
function salvar() {
  _metas = null;
  const txt = JSON.stringify(S);
  try { localStorage.setItem(KEY, txt); }
  catch (e) {
    /* sem espaço: os dados de hoje valem mais que a cópia de antes da 1.6 */
    if (localStorage.getItem(KEY_ANTES)) {
      localStorage.removeItem(KEY_ANTES);
      try { localStorage.setItem(KEY, txt); toast('Espaço cheio: apaguei a cópia de antes da versão 1.6 para salvar seus dados.'); return; } catch (e2) { }
    }
    toast('Não foi possível salvar: armazenamento cheio?');
  }
}
function dia(iso, criar) {
  let d = S.dias[iso];
  if (!d && criar) { d = S.dias[iso] = { ref: {}, agua: [], treino: null, cardio: [] }; }
  return d || null;
}
function temDados() { return Object.keys(S.dias).length > 0 || S.peso.length > 1 || !!S.treino; }
function precisaBackup() {
  if (!temDados()) return false;
  const ref = S.cfg.ultimoBackup || null; const adiado = S.cfg.backupAdiado;
  if (adiado && diffDias(adiado, hojeISO()) < 7) return false;
  if (!ref) { const dias = Object.keys(S.dias).sort(); return dias.length && diffDias(dias[0], hojeISO()) >= 7; }
  return diffDias(ref, hojeISO()) >= 14;
}

/* ===================== bases (lidas dos arquivos, não semeadas: GCM-ERR-028/029) ===================== */
const ALIM_G = window.ALIM_GRUPOS || [];
const FOODS = new Map();
const linhaAlim = r => ({ id: r[0], nome: r[1], grupo: ALIM_G[r[2]], kcal: r[3], p: r[4], c: r[5], g: r[6], fibra: r[7], sodio: r[8], acucar: r[9], sat: r[10], calcio: r[11], ferro: r[12], potassio: r[13], vitc: r[14], sal: !!r[15], sodioSemSal: r[16] == null ? null : r[16], busca: sem(r[1]) });
(window.ALIM || []).forEach(r => FOODS.set(r[0], linhaAlim(r)));
/* 1.6: as papinhas saíram da busca, mas os registros antigos que usam alguma continuam com nome e calorias */
const FORA = new Map();
(window.ALIM_FORA || []).forEach(r => FORA.set(r[0], linhaAlim(r)));
const ALIAS = window.ALIM_ALIAS || {};
/* sódio de um alimento: nos preparos unidos, quem cozinha sem sal (Eu › Ajustes) usa o valor sem sal */
function sodioDe(f) { return f.sal && S.cfg.semSal && f.sodioSemSal != null ? f.sodioSemSal : f.sodio; }
function alimento(id) {
  if (ALIAS[id]) id = ALIAS[id];
  if (FOODS.has(id)) return FOODS.get(id);
  if (FORA.has(id)) return FORA.get(id);
  const m = S.meus.find(x => x.id === id);
  return m ? Object.assign({ grupo: 'Meus alimentos', busca: sem(m.nome) }, m) : null;
}
/* lista simplificada: nome comum -> [padrão, variações da TBCA]. Os registros continuam guardando o id da TBCA. */
const SIMPLES_G = window.ALIM_SIMPLES_GRUPOS || [];
const SIMPLES = (window.ALIM_SIMPLES || []).map(r => {
  const ids = r[2].filter(id => FOODS.has(id)); const pad0 = FOODS.get(ids[0]);
  return { nome: r[0], grupo: SIMPLES_G[r[1]], ids, busca: sem(r[0]), buscaPadrao: pad0 ? pad0.busca : '' };
}).filter(x => x.ids.length);
const SIMPLES_DE = new Map();
SIMPLES.forEach(x => SIMPLES_DE.set(x.ids[0], x));
SIMPLES.forEach(x => x.ids.forEach(id => { if (!SIMPLES_DE.has(id)) SIMPLES_DE.set(id, x); }));
function nomeAlim(id) { id = ALIAS[id] || id; const x = SIMPLES_DE.get(id); if (x) return x.nome; const f = alimento(id); return f ? f.nome : '(alimento removido)'; }
function nomeItem(it) { return it.q ? (it.q.n || 'Registro rápido') : nomeAlim(it.f); }
function especificado(id) { const x = SIMPLES_DE.get(id); return !!(x && x.ids[0] !== id); }
function detalheCurto(id) { const f = alimento(id); return f ? f.nome.split(', ').filter(t => !/^[A-Z][a-z]+ [a-z]+/.test(t)).slice(0, 5).join(', ') : ''; }
const EXS = new Map();
(window.EX || []).forEach(r => {
  EXS.set(r[0], { id: r[0], nome: r[1], en: r[2], tipo: window.EX_TIPOS[r[3]], grupo: r[4], musc1: r[5], musc2: r[6], equip: window.EX_EQUIP[r[7]], nivel: r[8], mec: r[9], met: r[10], nimg: r[11], busca: sem(r[1] + ' ' + r[2]) });
});
const EX_CUR = window.EX_CUR || {};
const CARDIO = (window.CARDIO || []).map(c => ({ cod: c[0], mod: c[1], nome: c[2], int: c[3], met: c[4] }));
function cardioCod(cod) { return CARDIO.find(c => c.cod === cod); }
function imgEx(e, i) { return 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/' + encodeURIComponent(e.id) + '/' + (i || 0) + '.jpg'; }

/* ===================== ícones ===================== */
const IC = {
  hoje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  dieta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 21V3c-2 1-3 4-3 7h3"/></svg>',
  treino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></svg>',
  progresso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4M4 20h16M8 15l4-5 3 3 5-6"/></svg>',
  eu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  troca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
  cima: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  baixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  estrela: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  estrela0: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  editar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
};

/* ===================== navegação e render ===================== */
/* 1.6: cinco abas. Registrar fica em Hoje/Dieta/Treino; acompanhar (peso, medidas, fotos, cargas, sono e água) fica em Progresso. */
const ABAS = [['hoje', 'Hoje'], ['dieta', 'Dieta'], ['treino', 'Treino'], ['progresso', 'Progresso'], ['eu', 'Eu']];
let aba = 'hoje';
let dataSel = hojeISO();
let subTreino = 'hoje';
let subProg = 'semana';
let rolagem = {};
let pularRolagem = false;

window.addEventListener('scroll', () => { if (!$('.fundo')) rolagem[aba] = window.scrollY; }, { passive: true });

function irAba(a) {
  aba = a; pularRolagem = true; render();
  window.scrollTo(0, 0); rolagem[a] = 0;
}
function montarAbas() {
  $('#abas').innerHTML = ABAS.map(([k, t]) => '<button data-aba="' + k + '" class="' + (aba === k ? 'on' : '') + '">' + IC[k] + '<span>' + t + '</span></button>').join('');
}
$('#abas').addEventListener('click', e => { const b = e.target.closest('button[data-aba]'); if (b) irAba(b.dataset.aba); });
$('#diaAnt').onclick = () => { dataSel = addDias(dataSel, -1); render(); };
$('#diaProx').onclick = () => { dataSel = addDias(dataSel, 1); render(); };
$('#rotuloData').onclick = () => { dataSel = hojeISO(); render(); };

/* UNIV-ERR-006: guardar e devolver a rolagem a cada redesenho */
function render() {
  _metas = null;
  const y = rolagem[aba] || 0;
  montarAbas();
  $('#rotuloData').textContent = rotuloDia(dataSel);
  /* a data só aparece onde ela muda alguma coisa */
  const usaData = aba === 'hoje' || aba === 'dieta' || (aba === 'treino' && subTreino === 'hoje');
  $('#navData').style.visibility = usaData ? 'visible' : 'hidden';
  const fn = { hoje: telaHoje, dieta: telaDieta, treino: telaTreino, progresso: telaProgresso, eu: telaEu }[aba] || telaHoje;
  $('#main').innerHTML = fn();
  hidratarFotos($('#main'));
  if (!pularRolagem) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  pularRolagem = false;
}

/* ===================== folhas e confirmações =====================
   Cada folha é um elemento NOVO, criado e destruído: nenhum evento de uma caixa
   anterior encerra a seguinte (UNIV-ERR-007). */
function abrirFolha(html, aoMontar) {
  const f = document.createElement('div');
  f.className = 'fundo';
  f.innerHTML = '<div class="folha" role="dialog" aria-modal="true"><div class="alca"></div>' + html + '</div>';
  f.addEventListener('click', e => { if (e.target === f) fecharFolha(f); });
  document.body.appendChild(f);
  document.body.style.overflow = 'hidden';
  if (aoMontar) aoMontar(f.firstChild, f);
  return f;
}
function fecharFolha(f) {
  f = f || $$('.fundo').pop();
  if (f && f._aoFechar) { const fn = f._aoFechar; f._aoFechar = null; try { fn(); } catch (e) { console.error(e); } }
  if (f && f.parentNode) f.parentNode.removeChild(f);
  if (!$('.fundo')) document.body.style.overflow = '';
}
function confirmar(msg, ok, perigo) {
  return new Promise(res => {
    const f = abrirFolha('<p style="font-size:16px;margin:4px 0 16px">' + msg + '</p><div class="grade2"><button class="btn" data-r="0">Cancelar</button><button class="btn ' + (perigo ? 'perigo' : 'pri') + '" data-r="1">' + (ok || 'Confirmar') + '</button></div>',
      el => { $$('button[data-r]', el).forEach(b => b.onclick = () => { fecharFolha(f); res(b.dataset.r === '1'); }); });
    f.addEventListener('click', e => { if (e.target === f) res(false); });
  });
}
let toastT = null;
function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600);
}

/* ===================== metas (perfil) ===================== */
const ROTINAS = { sentado: ['Trabalho sentado', 1.2], pe: ['Em pé / caminhando', 1.35], fisico: ['Trabalho físico pesado', 1.5], plantao: ['Plantão 12x36 (escala)', 1.3] };
const OBJETIVOS = { perder: 'Perder gordura', manter: 'Manter o peso', ganhar: 'Ganhar massa' };
const RITMOS = { leve: 'Leve', moderado: 'Moderado', agressivo: 'Agressivo' };
const AJ = { perder: { leve: -0.10, moderado: -0.18, agressivo: -0.25 }, manter: { leve: 0, moderado: 0, agressivo: 0 }, ganhar: { leve: 0.05, moderado: 0.10, agressivo: 0.15 } };
/* ritmo-alvo semanal (% do peso) para a sugestão de ajuste */
const RITMO_ALVO = { perder: { leve: -0.25, moderado: -0.5, agressivo: -0.8 }, manter: { leve: 0, moderado: 0, agressivo: 0 }, ganhar: { leve: 0.1, moderado: 0.25, agressivo: 0.4 } };

function pesoAtual() {
  if (S.peso.length) return S.peso.slice().sort((a, b) => a.d < b.d ? -1 : 1).pop().kg;
  return S.perfil ? S.perfil.peso : null;
}
function sessoesSemana() {
  let n = 0;
  if (S.treino) n += S.treino.freq === 'alt' ? 3.5 : S.treino.dias.length;
  return n;
}
function cardioSemana() { return S.cardio ? (S.cardio.vezes || 0) : 0; }
function calcMetas() {
  if (_metas && _metas.perfil === S.perfil) return _metas.r;
  const r = calcMetas0(); _metas = { perfil: S.perfil, r }; return r;
}
function calcMetas0() {
  const p = S.perfil; if (!p) return null;
  const kg = pesoAtual() || p.peso, cm = p.altura, idade = p.idade;
  const avisos = [];
  const tmb = p.bf ? 370 + 21.6 * (kg * (1 - p.bf / 100)) : 10 * kg + 6.25 * cm - 5 * idade + (p.sexo === 'M' ? 5 : -161);
  const base = (ROTINAS[p.rotina] || ROTINAS.sentado)[1];
  const extraTreino = Math.min(0.175, 0.025 * sessoesSemana()) + Math.min(0.06, 0.012 * cardioSemana());
  const fator = base + extraTreino;
  const getFormula = tmb * fator;
  const real = gastoReal(getFormula);
  const usaReal = !!(p.usarReal && real);
  const get = usaReal ? real.kcal : getFormula;
  /* com o gasto real, o ajuste manual de tendência deixa de fazer sentido: o próprio gasto real já se corrige */
  let kcal = Math.round(get * (1 + AJ[p.objetivo][p.ritmo || 'moderado']) + (usaReal ? 0 : (p.ajusteKcal || 0)));
  const piso = p.sexo === 'M' ? 1500 : 1200;
  if (kcal < piso) { kcal = piso; avisos.push('A meta ficou abaixo do mínimo seguro e foi limitada a ' + piso + ' kcal. Para ir abaixo disso, só com acompanhamento profissional.'); }
  const m = p.manual || {};
  const kcalFinal = m.kcal || kcal; /* macros sempre fecham com a meta de calorias que vale (manual ou automática) */
  const imc = kg / Math.pow(cm / 100, 2);
  const refKg = imc > 30 ? 27.5 * Math.pow(cm / 100, 2) : kg;
  const protKg = p.protKg || { perder: 2.0, manter: 1.8, ganhar: 2.0 }[p.objetivo];
  const gordKg = p.gordKg || (p.objetivo === 'perder' ? 0.8 : 0.9);
  const est = ESTILOS[p.estilo] ? p.estilo : 'padrao';
  const prot = m.prot || Math.round(protKg * refKg);
  let gord = m.gord || Math.round(Math.max(gordKg * refKg, 0.2 * kcalFinal / 9));
  let carb = m.carb || Math.round((kcalFinal - prot * 4 - gord * 9) / 4);
  if (est !== 'padrao' && !m.carb) {
    /* estilos com pouco carboidrato: o carbo é fixado e a gordura completa as calorias */
    carb = ESTILOS[est].carb(kcalFinal);
    if (!m.gord) gord = Math.max(0, Math.round((kcalFinal - prot * 4 - carb * 4) / 9));
  }
  if (carb < 50 && !m.carb && est === 'padrao') { avisos.push('Sobrou pouco carboidrato com essa proteína e gordura. Considere reduzir a proteína por kg ou um ritmo mais leve.'); carb = Math.max(carb, 0); }
  if (m.kcal && m.prot && m.carb && m.gord) {
    const soma = m.prot * 4 + m.carb * 4 + m.gord * 9;
    if (Math.abs(soma - m.kcal) > 100) avisos.push('Os macros manuais somam ' + fmt(soma) + ' kcal, diferente da meta de ' + fmt(m.kcal) + ' kcal. Confira os números.');
  }
  const agua = Math.round(35 * kg / 50) * 50;
  return {
    tmb: Math.round(tmb), get: Math.round(get), getFormula: Math.round(getFormula), real, usaReal, fator, imc, refKg, kg,
    kcal: kcalFinal, prot, carb, gord,
    fibra: est === 'nocarb' ? 0 : est === 'keto' ? 15 : Math.round(14 * kcalFinal / 1000), agua: m.agua || agua, avisos, estilo: est, manual: !!(m.kcal || m.prot || m.carb || m.gord || m.agua)
  };
}
/* ===================== estilos de dieta e jejum intermitente ===================== */
const ESTILOS = {
  padrao: { nome: 'Equilibrada', curto: 'Equilibrada', carb: null, desc: 'Proteína e gordura por kg; o carboidrato completa as calorias (em geral 40–50% das calorias).' },
  lowcarb: { nome: 'Low carb', curto: 'Low carb', carb: k => Math.min(130, Math.round(k * 0.25 / 4)), desc: 'Até 130 g de carboidrato por dia (menos de 26% das calorias). Arroz, pão e frutas em porções menores; mais proteína, gordura boa e verduras.' },
  keto: { nome: 'Cetogênica (keto)', curto: 'Keto', carb: () => 30, desc: '20–50 g de carboidrato por dia (o app usa 30 g), para o corpo entrar em cetose. Carnes, ovos, queijos, azeite, abacate, castanhas e verduras pobres em amido. Sem arroz, pão, feijão, açúcar e quase sem fruta.' },
  nocarb: { nome: 'No carb (carnívora)', curto: 'No carb', carb: () => 10, desc: 'Praticamente zero carboidrato: só alimentos de origem animal (carnes, ovos, queijos, manteiga). É a mais restritiva: sem fibras e com pouca vitamina C.' }
};
const AVISOS_ESTILO = {
  lowcarb: 'Converse com seu médico antes se usa remédio para diabetes ou pressão: as doses podem precisar de ajuste.',
  keto: 'Não indicada na gravidez ou amamentação, com remédios da classe SGLT2 (ex.: dapagliflozina, empagliflozina), insulina ou sulfonilureia sem acompanhamento médico, nem com doença do fígado, rins ou pâncreas. Na 1ª semana pode dar a "gripe keto" (cansaço, dor de cabeça): beba bastante água e capriche no sal, a não ser que tenha pressão alta. O peso cai rápido no começo por perda de água; a gordura vem depois. Faça exames de colesterol: em algumas pessoas o LDL sobe bastante.',
  nocarb: 'Ainda não existe estudo controlado sobre ela: o maior é uma pesquisa com 2.029 praticantes, que relataram os próprios resultados. O LDL costuma subir e as fibras vão a zero. Valem os mesmos cuidados da cetogênica. Faça só com acompanhamento médico e exames (colesterol, vitamina C, ácido úrico, rins).'
};
const JEJUNS = { '12:12': [12, 'Iniciante'], '14:10': [14, 'Leve'], '16:8': [16, 'O mais estudado'], '18:6': [18, 'Intermediário'], '20:4': [20, 'Avançado'], 'OMAD': [23, '1 refeição por dia'] };
const HORA_REF = { cafe: 7, lanche1: 10, almoco: 12.5, lanche2: 16, jantar: 19.5, ceia: 22 };
function minutosAgora() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function hhmm(min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
function janelaJejum() {
  const J = S.jejum; if (!J || !JEJUNS[J.tipo]) return null;
  const jejumH = JEJUNS[J.tipo][0]; const comer = (24 - jejumH) * 60;
  const [hh, mm] = J.inicio.split(':').map(Number); const ini = hh * 60 + mm; const fim = (ini + comer) % 1440;
  return { jejumH, comerMin: comer, ini, fim };
}
function statusJejum() {
  const w = janelaJejum(); if (!w) return null;
  const agora = minutosAgora(); const desdeIni = ((agora - w.ini) % 1440 + 1440) % 1440;
  if (desdeIni < w.comerMin) return { aberto: true, resta: w.comerMin - desdeIni, w };
  const emJejum = desdeIni - w.comerMin; return { aberto: false, feito: emJejum, total: w.jejumH * 60, resta: w.jejumH * 60 - emJejum, w };
}
/* refeições que cabem na janela de alimentação (pelos horários típicos de cada uma) */
function refeicoesNaJanela(w) {
  const dentro = h => { const m = h * 60; const d = ((m - w.ini) % 1440 + 1440) % 1440; return d <= w.comerMin; };
  let l = ORDEM_REF.filter(k => dentro(HORA_REF[k]));
  if (!l.length) { const meio = (w.ini + w.comerMin / 2) / 60; l = [ORDEM_REF.slice().sort((a, b) => Math.abs(HORA_REF[a] - meio) - Math.abs(HORA_REF[b] - meio))[0]]; }
  if (l.length > 4) l = l.filter(k => k !== 'lanche1' && k !== 'ceia');
  return l;
}
function cartaoJejum() {
  const st = statusJejum(); if (!st) return '';
  const J = S.jejum;
  if (st.aberto) return '<div class="cartao"><div class="cab"><h2>Jejum ' + esc(J.tipo) + '</h2><span class="tag ok-t">janela aberta</span></div><div class="linha-flex">' + anel(st.w.comerMin - st.resta, st.w.comerMin, 'var(--ok)', '<div class="grande" style="font-size:22px">' + hm(st.resta) + '</div><div class="mini">para comer</div>') + '<div class="sub">Pode comer até as <b>' + hhmm(st.w.fim) + '</b>.<br>Depois começa o jejum de ' + st.w.jejumH + ' h. Água, café e chá sem açúcar estão liberados.</div></div></div>';
  return '<div class="cartao"><div class="cab"><h2>Jejum ' + esc(J.tipo) + '</h2><span class="tag">em jejum</span></div><div class="linha-flex">' + anel(st.feito, st.total, 'var(--acento)', '<div class="grande" style="font-size:22px">' + hm(st.feito) + '</div><div class="mini">de ' + st.w.jejumH + ' h</div>') + '<div class="sub">A janela abre às <b>' + hhmm(st.w.ini) + '</b> (faltam ' + hm(st.resta) + ').<br>Água, café e chá sem açúcar não quebram o jejum.</div></div></div>';
}

/* gasto real (adaptativo): média do que você comeu − variação do peso × 7700 kcal/kg, nos últimos 28 dias */
function gastoReal(getFormula) {
  const h = hojeISO(); const ini = addDias(h, -28);
  const ingest = [];
  for (let i = 1; i <= 28; i++) { const iso = addDias(h, -i); const t = totaisDia(iso); if (t.kcal >= 0.45 * getFormula) ingest.push(t.kcal); }
  const pes = S.peso.filter(x => x.d >= ini && x.d <= h).sort((a, b) => a.d < b.d ? -1 : 1);
  if (ingest.length < 10 || pes.length < 4 || diffDias(pes[0].d, pes[pes.length - 1].d) < 14) return null;
  const xs = pes.map(x => diffDias(pes[0].d, x.d)), ys = pes.map(x => x.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let nn = 0, dd = 0; xs.forEach((x, i) => { nn += (x - mx) * (ys[i] - my); dd += (x - mx) * (x - mx); });
  const incl = dd ? nn / dd : 0; /* kg por dia */
  const media = ingest.reduce((a, b) => a + b, 0) / ingest.length;
  const kcal = Math.round(media - incl * 7700);
  if (kcal < 0.6 * getFormula || kcal > 1.6 * getFormula) return null; /* registro incompleto ou erro de pesagem */
  return { kcal, mediaIngerida: Math.round(media), diasComida: ingest.length, pesagens: pes.length, kgSemana: incl * 7 };
}
function metaAguaDia(iso) {
  const m = calcMetas(); if (!m) return 2500;
  const t = treinoDoDia(iso);
  return m.agua + (t && !t.descanso ? 500 : 0) + (ehPlantao(iso) ? 500 : 0);
}

/* ===================== escala de plantão ===================== */
const ESCALAS = { '12x36': ['12x36 (plantão a cada 2 dias)', 2], '24x48': ['24x48 (a cada 3 dias)', 3], '24x72': ['24x72 (a cada 4 dias)', 4], manual: ['Marco os dias à mão', 0] };
function ehPlantao(iso) {
  const P = S.plantao; if (!P) return false;
  if (S.plantaoDias[iso] != null) return !!S.plantaoDias[iso];
  const n = (ESCALAS[P.tipo] || [])[1]; if (!n) return false;
  const d = diffDias(P.inicio, iso); return ((d % n) + n) % n === 0;
}
function fracaoPlantao() {
  const P = S.plantao; if (!P) return 0;
  const n = (ESCALAS[P.tipo] || [])[1]; if (n) return 1 / n;
  let c = 0; for (let i = 0; i < 28; i++) if (ehPlantao(addDias(hojeISO(), -i))) c++; return c / 28;
}
/* metas de UM dia: no plantão sobe 12% (em carboidrato) e as folgas compensam, mantendo a média da semana */
function metaDia(iso) {
  const m = calcMetas(); if (!m) return null;
  const P = S.plantao; if (!P || !P.distribuir || (m.manual && p0manualKcal())) return Object.assign({ plantao: ehPlantao(iso) }, m);
  const pf = fracaoPlantao(); if (!pf || pf >= 1) return Object.assign({ plantao: ehPlantao(iso) }, m);
  const pl = ehPlantao(iso);
  const fator = pl ? 1.12 : (1 - pf * 1.12) / (1 - pf);
  const dk = Math.round(m.kcal * fator) - m.kcal;
  if (m.estilo !== 'padrao') return Object.assign({}, m, { kcal: m.kcal + dk, gord: Math.max(0, m.gord + Math.round(dk / 9)), plantao: pl, deltaPlantao: dk });
  return Object.assign({}, m, { kcal: m.kcal + dk, carb: Math.max(0, m.carb + Math.round(dk / 4)), plantao: pl, deltaPlantao: dk });
}
function p0manualKcal() { return !!(S.perfil && S.perfil.manual && S.perfil.manual.kcal); }

/* ===================== cálculo do dia ===================== */
const REFEICOES = { cafe: 'Café da manhã', lanche1: 'Lanche da manhã', almoco: 'Almoço', lanche2: 'Lanche da tarde', jantar: 'Jantar', ceia: 'Ceia' };
const ORDEM_REF = ['cafe', 'lanche1', 'almoco', 'lanche2', 'jantar', 'ceia'];
function refAtivas() { return ORDEM_REF.filter(k => S.cfg.refeicoes.includes(k)); }
/* item de refeição: { f: código, g: gramas } ou, no registro rápido, { q: { n: nome, kcal, p, c, g } } */
function macrosItem(it) {
  if (it.q) return { kcal: it.q.kcal || 0, p: it.q.p || 0, c: it.q.c || 0, g: it.q.g || 0, fibra: 0 };
  const f = alimento(it.f); if (!f) return { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 };
  const k = it.g / 100;
  return { kcal: (f.kcal || 0) * k, p: (f.p || 0) * k, c: (f.c || 0) * k, g: (f.g || 0) * k, fibra: (f.fibra || 0) * k };
}
function somar(lista) {
  const t = { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 };
  lista.forEach(it => { const m = macrosItem(it); for (const k in t) t[k] += m[k]; });
  return t;
}
function totaisDia(iso) {
  const d = dia(iso); const todos = [];
  if (d) for (const k in d.ref) todos.push(...d.ref[k]);
  return somar(todos);
}
function aguaDia(iso) { const d = dia(iso); return d ? d.agua.reduce((s, a) => s + a.ml, 0) : 0; }
function gastoExercicio(iso) {
  const d = dia(iso); if (!d) return 0;
  let k = 0;
  if (d.treino && d.treino.kcal) k += d.treino.kcal;
  (d.cardio || []).forEach(c => k += c.kcal || 0);
  return Math.round(k);
}

/* ===================== componentes visuais ===================== */
function anel(valor, meta, cor, centro, tam) {
  tam = tam || 132; const r = (tam - 14) / 2, C = 2 * Math.PI * r;
  const pct = meta > 0 ? clamp(valor / meta, 0, 1) : 0;
  const passou = meta > 0 && valor > meta * 1.05;
  return '<div class="anel" style="width:' + tam + 'px;height:' + tam + 'px"><svg width="' + tam + '" height="' + tam + '"><circle cx="' + tam / 2 + '" cy="' + tam / 2 + '" r="' + r + '" fill="none" stroke="#23282d" stroke-width="10"/>' +
    '<circle cx="' + tam / 2 + '" cy="' + tam / 2 + '" r="' + r + '" fill="none" stroke="' + (passou ? 'var(--alerta)' : cor) + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * pct) + ' ' + C + '"/></svg><div class="meio">' + centro + '</div></div>';
}
function barraMacro(nome, cor, v, meta, un) {
  const pct = meta > 0 ? clamp(v / meta * 100, 0, 100) : 0;
  return '<div class="macro"><div class="lin"><span><i class="ponto" style="background:' + cor + '"></i>' + nome + '</span><span><b>' + fmt(v) + '</b> / ' + fmt(meta) + ' ' + (un || 'g') + '</span></div><div class="barra"><i style="width:' + pct + '%;background:' + cor + '"></i></div></div>';
}
/* gráfico de barras de 7 dias, série única (o título nomeia a série) */
function grafBarras(valores, rotulos, meta, cor, unid, id) {
  const W = 320, H = 120, pe = 18, topo = 8, larg = W / valores.length;
  const max = Math.max(meta || 0, ...valores, 1) * 1.1;
  let s = '<svg class="graf" viewBox="0 0 ' + W + ' ' + (H + pe) + '" role="img" data-graf="' + id + '">';
  if (meta) { const y = topo + (H - topo) * (1 - meta / max); s += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#5b636b" stroke-dasharray="3 4" stroke-width="1"/><text x="' + (W - 2) + '" y="' + (y - 3) + '" text-anchor="end">meta</text>'; }
  valores.forEach((v, i) => {
    const h = Math.max(v > 0 ? 3 : 0, (H - topo) * (v / max)); const x = i * larg + larg * 0.22, w = larg * 0.56;
    s += '<g data-i="' + i + '" data-txt="' + esc(rotulos[i] + ': ' + fmt(v, unid === 'h' ? 1 : 0) + ' ' + unid) + '"><rect x="' + (i * larg) + '" y="0" width="' + larg + '" height="' + (H + pe) + '" fill="transparent"/>' +
      (v > 0 ? '<path d="M' + x + ' ' + H + 'V' + (H - h + Math.min(4, h)) + 'q0 -4 4 -4h' + (w - 8) + 'q4 0 4 4V' + H + 'z" fill="' + cor + '"/>' : '') +
      '<text x="' + (i * larg + larg / 2) + '" y="' + (H + 13) + '" text-anchor="middle">' + esc(rotulos[i]) + '</text></g>';
  });
  s += '<line x1="0" x2="' + W + '" y1="' + H + '" y2="' + H + '" stroke="#2d3338"/></svg><div class="tip" id="tip-' + id + '">Toque numa barra para ver o valor.</div>';
  return s;
}
document.addEventListener('click', e => {
  const g = e.target.closest('svg[data-graf] g[data-txt]'); if (!g) return;
  const id = g.closest('svg').dataset.graf; const t = $('#tip-' + id); if (t) t.textContent = g.dataset.txt;
});
function ultimos7(iso) { const r = []; for (let i = 6; i >= 0; i--) r.push(addDias(iso, -i)); return r; }

/* ===================== TELA HOJE ===================== */
function telaHoje() {
  const m = metaDia(dataSel);
  let h = '';
  if (!S.perfil) {
    h += '<div class="cartao realce"><h2>Bem-vindo à Forja</h2><p class="sub">Comece pelo seu perfil: com peso, altura, idade, rotina e objetivo o app calcula calorias, macros e água. Depois é só seguir a lista do dia aqui embaixo.</p><button class="btn pri bloco" data-acao="editarPerfil">Configurar meu perfil</button><button class="btn bloco" style="margin-top:8px" data-acao="novaBio">Tenho bioimpedância: começar por ela</button>' +
      (Object.keys(S.dias).length ? '' : '<p class="mini" style="margin-top:12px">Já usava a Forja em outro aparelho, navegador ou endereço? Os dados de lá não aparecem aqui sozinhos: lá, vá em Eu › Exportar cópia e aqui importe o arquivo.</p><button class="btn bloco" style="margin-top:6px" data-acao="importar">Importar cópia</button>') + '</div>';
  }
  if (precisaBackup()) {
    h += '<div class="cartao alerta-c"><div class="cab"><h3>Faça uma cópia de segurança</h3></div><p class="sub">Seus dados ficam só neste aparelho. ' + (S.cfg.ultimoBackup ? 'A última cópia foi em ' + dataCurta(S.cfg.ultimoBackup) + '.' : 'Você ainda não exportou nenhuma cópia.') + ' Se o navegador limpar os dados ou o celular trocar, você perde tudo.</p><div class="chips"><button class="btn peq pri" data-acao="exportar">Exportar agora</button><button class="btn peq fant" data-acao="adiarBackup">Lembrar depois</button></div></div>';
  }
  const t = totaisDia(dataSel);
  const gasto = gastoExercicio(dataSel);
  if (m) {
    const resta = m.kcal - t.kcal;
    h += '<div class="cartao"><div class="cab"><h2>Calorias</h2>' + (S.plantao ? '<button class="tag ' + (m.plantao ? 'plantao' : 'folga') + '" data-acao="togPlantaoDia" aria-label="Trocar plantão/folga">' + (m.plantao ? 'Plantão' : 'Folga') + ' ⇄</button>' : '') + '</div>' +
      '<div class="linha-flex">' + anel(t.kcal, m.kcal, 'var(--acento)', '<div class="grande">' + fmt(Math.abs(resta)) + '</div><div class="mini">' + (resta >= 0 ? 'kcal restantes' : 'kcal acima') + '</div>') +
      '<div style="flex:1;min-width:0"><div class="sub">Consumido</div><div class="num" style="font-size:22px">' + fmt(t.kcal) + ' <span class="mini">de ' + fmt(m.kcal) + ' kcal</span></div>' +
      (m.deltaPlantao ? '<div class="mini">' + (m.deltaPlantao > 0 ? '+' : '') + fmt(m.deltaPlantao) + ' kcal ' + (m.plantao ? 'por ser plantão' : 'na folga (compensa o plantão)') + '</div>' : '') +
      '<div class="sub" style="margin-top:6px">Gasto em exercício</div><div class="num" style="font-size:18px">' + fmt(gasto) + ' kcal</div><div class="mini">já incluído na meta</div></div></div><div class="sep"></div>' +
      barraMacro('Proteína', 'var(--p)', t.p, m.prot) + barraMacro('Carboidrato', 'var(--c)', t.c, m.carb) + barraMacro('Gordura', 'var(--g)', t.g, m.gord) + sugestaoFalta(t, m) + '</div>';
  }
  /* botões rápidos: o que se faz várias vezes por dia, a um toque */
  h += '<div class="rapidas">' +
    '<button class="btn" data-acao="addRefeicaoAgora"><b>+</b>Refeição</button>' +
    '<button class="btn" data-acao="agua" data-v="' + S.cfg.copo + '"><b>+' + S.cfg.copo + '</b>ml de água</button>' +
    '<button class="btn" data-acao="novoPeso"><b>kg</b>Peso</button>' +
    (S.sonoAberto ? '<button class="btn pri" data-acao="acordei"><b>☀</b>Acordei</button>' : '<button class="btn" data-acao="dormir"><b>☾</b>Dormir</button>') +
    '</div>';
  if (dataSel === hojeISO()) h += cartaoJejum();
  h += listaDoDia(dataSel, m, t);
  const df = diasDesdeFoto();
  if (df != null && df >= 28 && dataSel === hojeISO()) h += '<div class="cartao" data-acao="irProgresso" data-v="fotos" style="cursor:pointer"><div class="cab"><h3>📸 Hora da foto de progresso</h3><span class="mini" style="margin-left:auto">›</span></div><div class="mini">A última foi há ' + df + ' dias. Tire de novo para comparar o antes e depois.</div></div>';
  if (S.perfil) h += '<button class="btn bloco fant" data-acao="irProgresso" data-v="semana">Ver o resumo dos últimos 7 dias ›</button>';
  return h;
}
/* a lista do dia: cada linha é uma tarefa; tocar leva para onde ela se resolve */
function tarefa(st, titulo, detalhe, acao, extra) {
  const cls = st === true ? 'ok' : st === 'andando' ? 'andando' : st === 'livre' ? 'livre' : '';
  return '<div class="tarefa ' + cls + '" data-acao="' + acao + '"' + (extra || '') + '><span class="marca-t">' + (st === true ? IC.check : st === 'livre' ? '–' : '') + '</span><div class="txt"><div class="t">' + titulo + '</div>' + (detalhe ? '<div class="mini">' + detalhe + '</div>' : '') + '</div><span class="seta">›</span></div>';
}
function listaDoDia(iso, m, t) {
  const d = dia(iso); const l = []; let feitas = 0, total = 0;
  const add = (st, ...r) => { if (st !== 'livre') total++; if (st === true) feitas++; l.push(tarefa(st, ...r)); };
  /* treino */
  if (!S.treino) add(false, 'Montar meu treino', 'Duas perguntas e o app monta exercícios, séries e repetições', 'irTreinoPlano');
  else {
    const td = treinoDoDia(iso); const reg = d && d.treino;
    if (td.descanso && !reg) add('livre', td.plantao ? 'Plantão · sem treino' : 'Descanso do treino', td.idx != null && S.treino.seq[td.idx] ? 'Próximo: ' + letra(td.idx) + ' — ' + esc(S.treino.seq[td.idx].n) : 'Recuperação também é treino', 'irTreinoHoje');
    else {
      const idx = reg ? reg.idx : td.idx; const tt = treinoDia(idx, reg);
      const st = reg && reg.fim ? true : (reg && reg.ini ? 'andando' : false);
      add(st, 'Treino ' + letra(idx) + ' · ' + esc(tt.n), st === true ? 'Concluído em ' + hm((reg.fim - reg.ini) / 60000) + ' · ~' + fmt(reg.kcal) + ' kcal' : (st === 'andando' ? 'Em andamento · toque para continuar' : tt.ex.length + ' exercícios · ~' + duracaoEstimada(tt.ex) + ' min'), 'irTreinoHoje');
    }
  }
  /* cardio: só aparece se estiver no plano ou já tiver sido feito */
  const c = cardioDoDia(iso); const cards = (d && d.cardio) || [];
  if (c || cards.length) {
    const cc = c && cardioCod(c.cod);
    add(cards.length ? true : false, 'Cardio' + (c ? ' · ' + esc(TIPOS_CARDIO[c.tipo].nome) : ''), cards.length ? cards.reduce((a, x) => a + x.min, 0) + ' min feitos' : c.min + ' min · ' + esc(cc ? cc.nome : ''), 'irTreinoHoje');
  }
  /* proteína */
  if (m) { const ok = t.p >= m.prot * 0.9; add(ok, 'Proteína ' + fmt(t.p) + ' / ' + fmt(m.prot) + ' g', ok ? 'Meta do dia batida' : 'Faltam ' + fmt(m.prot - t.p) + ' g', 'irAba', ' data-v="dieta"'); }
  /* água */
  const ag = aguaDia(iso), ma = metaAguaDia(iso);
  add(ag >= ma, 'Água ' + fmt(ag / 1000, 1) + ' / ' + fmt(ma / 1000, 1) + ' L', ag >= ma ? 'Meta batida' : 'Faltam ' + fmt((ma - ag) / 1000, 2) + ' L · toque para ver os registros', 'folhaAgua');
  /* sono */
  const sn = sonoDoDia(iso);
  if (S.sonoAberto && iso === hojeISO()) add('andando', 'Dormindo desde ' + S.sonoAberto.slice(11), 'Toque em “Acordei” lá em cima ao levantar', 'folhaSono');
  else add(sn.min >= 420, sn.min ? 'Sono ' + hm(sn.min) : 'Sono', sn.min ? (sn.min >= 420 ? 'Noite boa' : 'Menos de 7 h') + (sn.q ? ' · qualidade ' + sn.q + '/5' : '') : 'Nenhum registro que termine neste dia', 'folhaSono');
  /* peso: não é diário, então não conta como pendência */
  if (S.perfil) {
    const pz = S.peso.find(x => x.d === iso); const tend = tendenciaPeso();
    add(pz ? true : 'livre', pz ? 'Peso ' + fmt(pz.kg, 1) + ' kg' : 'Pesagem (2–3 vezes por semana)', tend ? 'Tendência ' + (tend.semana > 0 ? '+' : '') + fmt(tend.semana, 2) + ' kg por semana' : 'De manhã, em jejum, depois do banheiro', 'novoPeso');
  }
  return '<div class="cartao"><div class="cab"><h2>' + (iso === hojeISO() ? 'Hoje' : esc(rotuloDia(iso))) + '</h2><span class="mini" style="margin-left:auto">' + feitas + ' de ' + total + ' feitos</span></div>' + l.join('') + '</div>';
}
/* qual refeição faz sentido registrar agora, pelo horário */
function refeicaoAgora() {
  const d = new Date(); const h = d.getHours() + d.getMinutes() / 60; const at = refAtivas();
  let melhor = at[0], dist = 99;
  at.forEach(k => { const x = Math.abs(HORA_REF[k] - h); if (x < dist) { dist = x; melhor = k; } });
  return melhor;
}
/* água do dia: adicionar outra quantidade e apagar registros */
function folhaAgua() {
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Água · ' + esc(rotuloDia(dataSel)) + '</h2><div id="agC"></div>', el => {
    const pintar = () => {
      const d = dia(dataSel); const ag = aguaDia(dataSel), meta = metaAguaDia(dataSel);
      $('#agC', el).innerHTML = '<div class="macro"><div class="lin"><span><b>' + fmt(ag / 1000, 2) + ' L</b></span><span>meta ' + fmt(meta / 1000, 1) + ' L' + (treinoDoDia(dataSel) && !treinoDoDia(dataSel).descanso ? ' (+0,5 L dia de treino)' : '') + '</span></div><div class="barra"><i style="width:' + clamp(ag / meta * 100, 0, 100) + '%;background:var(--agua)"></i></div></div>' +
        '<div class="grade3" style="margin:12px 0 8px"><button class="btn pri" data-ml="' + S.cfg.copo + '">+' + S.cfg.copo + ' ml</button><button class="btn" data-ml="500">+500 ml</button><button class="btn" data-ml="1000">+1 L</button></div>' +
        '<div class="linha-flex" style="gap:8px;margin-bottom:12px"><input type="number" inputmode="numeric" id="agMl" placeholder="Outra quantidade (ml)"><button class="btn" data-ml="campo">Somar</button></div>' +
        (d && d.agua.length ? '<ul class="lista">' + d.agua.map((a, i) => '<li><div class="txt"><div class="t">' + fmt(a.ml) + ' ml</div></div><div class="mini">' + a.h + '</div><button class="ic" data-rm="' + i + '" aria-label="Apagar">' + IC.lixo + '</button></li>').join('') + '</ul>' : '<div class="mini">Nenhum registro neste dia.</div>') +
        '<button class="btn bloco fant" style="margin-top:10px" data-fim="1">Fechar</button>';
    };
    pintar();
    el.onclick = e => {
      if (e.target.closest('[data-fim]')) { fecharFolha(fl); return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { dia(dataSel).agua.splice(Number(rm.dataset.rm), 1); salvar(); pintar(); return; }
      const b = e.target.closest('[data-ml]'); if (!b) return;
      let ml = Number(b.dataset.ml);
      if (b.dataset.ml === 'campo') { ml = num($('#agMl', el).value); if (!ml || ml <= 0 || ml > 3000) { toast('Informe entre 1 e 3.000 ml.'); return; } }
      dia(dataSel, true).agua.push({ ml: Math.round(ml), h: horaAgora() }); salvar(); pintar();
    };
  });
  fl._aoFechar = render;
}
/* sono do dia: dormir/acordar e os registros que terminam neste dia */
function folhaSonoDia() {
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Sono · ' + esc(rotuloDia(dataSel)) + '</h2><div id="snC"></div>', el => {
    const sn = sonoDoDia(dataSel);
    $('#snC', el).innerHTML = (S.sonoAberto ? '<div class="info">Dormindo desde ' + S.sonoAberto.slice(11) + ' de ' + dataCurta(S.sonoAberto.slice(0, 10)) + '.</div><div class="grade2" style="margin-bottom:10px"><button class="btn pri" data-op="acordei">Acordei agora</button><button class="btn" data-op="cancDormir">Cancelar</button></div>' : '<div class="grade2" style="margin-bottom:10px"><button class="btn" data-op="dormir">Vou dormir agora</button><button class="btn" data-op="novo">+ Registrar à mão</button></div>') +
      (sn.lista.length ? '<ul class="lista">' + sn.lista.map(s => '<li data-op="edit" data-id="' + s.id + '"><div class="txt"><div class="t">' + s.ini.slice(11) + ' → ' + s.fim.slice(11) + (s.ini.slice(0, 10) !== s.fim.slice(0, 10) ? ' <span class="mini">(de ' + dataCurta(s.ini.slice(0, 10)) + ')</span>' : '') + '</div><div class="mini">' + (s.q ? '★'.repeat(s.q) + '☆'.repeat(5 - s.q) : 'sem nota') + (s.nota ? ' · ' + esc(s.nota) : '') + '</div></div><div class="val">' + hm(minutosEntre(s.ini, s.fim)) + '</div><span class="seta">' + IC.editar + '</span></li>').join('') + '</ul><div class="sub" style="margin-top:6px">Total que terminou neste dia: <b>' + hm(sn.min) + '</b></div>' : '<div class="mini">Nenhum sono terminando neste dia.</div>') +
      '<p class="mini" style="margin-top:10px">Adultos: 7–9 h. Em plantão noturno, registre também o sono de dia e os cochilos: o app soma tudo que termina no mesmo dia.</p><button class="btn bloco fant" data-op="fechar">Fechar</button>';
    el.onclick = e => {
      const b = e.target.closest('[data-op]'); if (!b) return; const op = b.dataset.op;
      if (op === 'fechar') return fecharFolha(fl);
      fecharFolha(fl);
      if (op === 'edit') folhaSono(S.sono.find(x => x.id === b.dataset.id));
      else if (op === 'novo') folhaSono(null);
      else ACOES[op]();
    };
  });
}
/* o que falta de proteína, com sugestão de porção de alimento comum */
function sugestaoFalta(t, m) {
  const falta = m.prot - t.p; if (t.kcal < 1 || falta < 15) return '';
  const resta = m.kcal - t.kcal; if (resta < 80) return '';
  const opcoes = [['C0997F', 'peito de frango'], ['C0010J', 'ovo cozido'], ['C0022G', 'iogurte desnatado'], ['C0039E', 'atum']].map(x => [ALIAS[x[0]] || x[0], x[1]]).filter(x => FOODS.has(x[0]) && !(S.cfg.evitar || []).includes(x[0]));
  const alvoP = Math.min(falta, 45); /* sugere uma porção realista; o resto vem nas próximas refeições */
  const txt = opcoes.map(x => { const f = FOODS.get(x[0]); const g = Math.round(alvoP / f.p * 100 / 10) * 10; return [g, g + ' g de ' + x[1] + medidaTexto(x[0], g)]; }).filter(x => x[0] <= 250).slice(0, 2).map(x => x[1]).join(' ou ');
  if (!txt) return '';
  return '<div class="info" style="margin-top:8px">Faltam <b>' + fmt(falta) + ' g de proteína</b> e ' + fmt(resta) + ' kcal. ' + (falta > 45 ? 'Para a próxima refeição' : 'Ex.') + ': ' + esc(txt) + '.</div>';
}
function resumoSemana(iso) {
  if (!S.perfil) return '';
  const dias = ultimos7(iso).filter(x => x <= hojeISO());
  let nCom = 0, kc = 0, pr = 0, mk = 0, mp = 0, plan = 0, feitos = 0, ag = 0, nCardio = 0;
  const sonos = [];
  dias.forEach(x => {
    const t = totaisDia(x); const md = metaDia(x);
    if (t.kcal > 300) { nCom++; kc += t.kcal; pr += t.p; mk += md.kcal; mp += md.prot; }
    const td = treinoDoDia(x); const d = dia(x);
    if (td && !td.descanso) plan++;
    if (d && d.treino && d.treino.fim) feitos++;
    if (d && d.cardio) nCardio += d.cardio.length;
    if (aguaDia(x) >= metaAguaDia(x)) ag++;
    const sn = sonoDoDia(x).min; if (sn) sonos.push(sn);
  });
  const tile = (rot, val, sub, cor) => '<div class="tile"><div class="mini">' + rot + '</div><div class="num" style="font-size:20px' + (cor ? ';color:' + cor : '') + '">' + val + '</div><div class="mini">' + sub + '</div></div>';
  const pctK = nCom ? kc / mk * 100 : 0;
  const tend = tendenciaPeso();
  return '<div class="cartao"><div class="cab"><h2>Últimos 7 dias</h2></div><div class="grade2 tiles">' +
    tile('Calorias (média)', nCom ? fmt(kc / nCom) : '–', nCom ? fmt(pctK) + '% da meta · ' + nCom + ' dias registrados' : 'nenhum dia registrado', nCom && Math.abs(pctK - 100) <= 7 ? 'var(--ok)' : null) +
    tile('Proteína (média)', nCom ? fmt(pr / nCom) + ' g' : '–', nCom ? 'meta ' + fmt(mp / nCom) + ' g' : '', nCom && pr / mp >= 0.9 ? 'var(--ok)' : null) +
    tile('Treinos', feitos + ' / ' + plan, 'feitos / planejados' + (nCardio ? ' · ' + nCardio + ' cardio' : ''), plan && feitos >= plan ? 'var(--ok)' : null) +
    tile('Sono (média)', sonos.length ? hm(sonos.reduce((a, b) => a + b, 0) / sonos.length) : '–', sonos.length + ' noites registradas') +
    tile('Água', ag + ' / ' + dias.length, 'dias na meta', ag >= dias.length - 1 ? 'var(--ok)' : null) +
    tile('Peso', tend ? (tend.semana > 0 ? '+' : '') + fmt(tend.semana, 2) + ' kg' : '–', tend ? 'por semana (tendência)' : 'pese-se mais vezes') +
    '</div></div>';
}

/* ===================== DIETA ===================== */
function telaDieta() {
  const m = metaDia(dataSel); const d = dia(dataSel); const t = totaisDia(dataSel);
  let h = '';
  if (m) {
    const passouC = m.estilo !== 'padrao' && t.c > m.carb * 1.15;
    h += '<div class="cartao"><div class="cab"><h2>' + fmt(t.kcal) + ' <span class="mini">/ ' + fmt(m.kcal) + ' kcal</span></h2>' + (m.estilo !== 'padrao' ? '<button class="tag estilo" data-acao="editarEstilo">' + ESTILOS[m.estilo].curto + '</button>' : '') + (S.jejum ? '<span class="tag">' + esc(S.jejum.tipo) + '</span>' : '') + (m.plantao ? '<span class="tag plantao">Plantão</span>' : '') + '</div>' +
      barraMacro('Proteína', 'var(--p)', t.p, m.prot) + barraMacro('Carboidrato' + (m.estilo !== 'padrao' ? ' (limite)' : ''), passouC ? 'var(--alerta)' : 'var(--c)', t.c, m.carb) + barraMacro('Gordura', 'var(--g)', t.g, m.gord) + (m.fibra ? barraMacro('Fibra', '#6E7780', t.fibra, m.fibra) : '') +
      (passouC ? '<div class="aviso" style="margin-top:8px">Carboidrato acima do limite da ' + esc(ESTILOS[m.estilo].nome.toLowerCase()) + (m.estilo === 'keto' || m.estilo === 'nocarb' ? ': acima de ~50 g por dia o corpo tende a sair da cetose.' : '.') + '</div>' : '') +
      (t.kcal > 0 ? nutrientesDia(dataSel) : '') + sugestaoFalta(t, m) + '</div>';
  } else h += '<div class="aviso">Sem perfil, o app não sabe suas metas. Configure em <b>Eu</b>.</div>';
  const vazio = !(d && Object.keys(d.ref).some(k => d.ref[k].length));
  /* dia vazio: as três formas de começar, em botões grandes */
  if (vazio) h += '<div class="cartao realce"><div class="cab"><h2>Dia vazio</h2></div><p class="sub" style="margin:-4px 0 10px">Escolha como começar:</p>' +
    '<button class="btn pri bloco grande-b" style="margin-bottom:8px" data-acao="gerarCardapio">⚡ Montar cardápio pelos macros</button>' +
    '<button class="btn bloco grande-b" style="margin-bottom:8px" data-acao="copiarOntem">Copiar o dia anterior</button>' +
    '<button class="btn bloco grande-b" data-acao="addRefeicaoAgora">+ Adicionar alimento</button></div>';
  h += '<div class="rolax" style="margin-bottom:12px">' + (vazio ? '' : '<button class="chip on" data-acao="gerarCardapio">⚡ Cardápio pelos macros</button><button class="chip" data-acao="copiarOntem">Copiar dia anterior</button>') +
    '<button class="chip" data-acao="listaCompras">Lista de compras</button><button class="chip" data-acao="novoAlimento">+ Criar alimento</button>' + (S.modelos.length ? '<button class="chip" data-acao="gerirModelos">Refeições prontas (' + S.modelos.length + ')</button>' : '') + (vazio ? '' : '<button class="chip" data-acao="limparDia">Limpar dia</button>') + '</div>';
  refAtivas().forEach(k => {
    const itens = (d && d.ref[k]) || []; const s = somar(itens);
    h += '<div class="cartao"><div class="cab"><h3>' + REFEICOES[k] + '</h3><span class="mini">' + fmt(s.kcal) + ' kcal</span><div class="dir"><button class="ic" data-acao="menuRef" data-ref="' + k + '" aria-label="Opções da refeição">' + IC.menu + '</button><button class="ic" data-acao="addAlim" data-ref="' + k + '" aria-label="Adicionar">' + IC.mais + '</button></div></div>';
    if (!itens.length) h += '<div class="mini">Nada registrado.</div>';
    else {
      h += '<ul class="lista">' + itens.map((it, i) => {
        const mm = macrosItem(it);
        const det = it.q ? 'só calorias' : (especificado(it.f) ? '✎ ' + esc(detalheCurto(it.f)) + '<br>' : '') + fmt(it.g) + ' g' + esc(medidaTexto(it.f, it.g));
        return '<li data-acao="editItem" data-ref="' + k + '" data-i="' + i + '"><div class="txt"><div class="t">' + esc(nomeItem(it)) + '</div><div class="mini">' + det + ' · P ' + fmt(mm.p) + ' · C ' + fmt(mm.c) + ' · G ' + fmt(mm.g) + '</div></div><div class="val">' + fmt(mm.kcal) + '</div></li>';
      }).join('') + '</ul><div class="mini" style="margin-top:6px">P ' + fmt(s.p) + ' g · C ' + fmt(s.c) + ' g · G ' + fmt(s.g) + ' g</div>';
    }
    h += '</div>';
  });
  return h;
}
/* registro rápido: só calorias (e macros, se souber), para refeição fora de casa */
function folhaRapido(ref, idx) {
  const d0 = dia(dataSel); const it = idx != null ? d0.ref[ref][idx] : null; const q = it ? it.q : {};
  const v = x => x != null ? x : '';
  const fl = abrirFolha('<h2 style="margin-bottom:4px">Só calorias</h2><p class="mini" style="margin-bottom:10px">Para refeição de restaurante ou quando não dá para pesar. Use o valor do cardápio ou da embalagem; proteína, carboidrato e gordura são opcionais.</p>' +
    '<label class="campo"><span>Descrição</span><input type="text" id="rqN" maxlength="60" value="' + esc(q.n || '') + '" placeholder="Ex.: almoço no restaurante"></label>' +
    '<div class="grade2"><label class="campo"><span>Calorias (kcal)</span><input type="number" inputmode="decimal" id="rqK" value="' + v(q.kcal) + '"></label><label class="campo"><span>Proteína (g)</span><input type="number" inputmode="decimal" id="rqP" value="' + v(q.p) + '"></label><label class="campo"><span>Carboidrato (g)</span><input type="number" inputmode="decimal" id="rqC" value="' + v(q.c) + '"></label><label class="campo"><span>Gordura (g)</span><input type="number" inputmode="decimal" id="rqG" value="' + v(q.g) + '"></label></div>' +
    '<div class="grade2">' + (it ? '<button class="btn perigo" id="rqR">Remover</button>' : '<button class="btn" id="rqX">Cancelar</button>') + '<button class="btn pri" id="rqO">' + (it ? 'Salvar' : 'Adicionar') + '</button></div>', el => {
      if ($('#rqX', el)) $('#rqX', el).onclick = () => fecharFolha(fl);
      if ($('#rqR', el)) $('#rqR', el).onclick = () => { d0.ref[ref].splice(idx, 1); salvar(); fecharFolha(fl); render(); };
      $('#rqO', el).onclick = () => {
        const k = num($('#rqK', el).value); if (!k || k <= 0 || k > 5000) { toast('Informe as calorias (até 5.000).'); return; }
        const n = { n: $('#rqN', el).value.trim(), kcal: Math.round(k), p: num($('#rqP', el).value), c: num($('#rqC', el).value), g: num($('#rqG', el).value) };
        const d = dia(dataSel, true); d.ref[ref] = d.ref[ref] || [];
        if (it) it.q = n; else d.ref[ref].push({ q: n });
        salvar(); fecharFolha(fl); render(); toast(it ? 'Atualizado.' : 'Adicionado em ' + REFEICOES[ref] + '.');
      };
    });
}
/* lista de compras: soma o que está planejado nos próximos dias */
function folhaCompras() {
  let n = 7;
  const fl = abrirFolha('<h2>Lista de compras</h2><p class="mini" style="margin:4px 0 10px">Soma os alimentos já registrados ou planejados a partir de ' + esc(rotuloDia(dataSel).toLowerCase()) + '. Para planejar a semana: Montar cardápio → <b>Usar nos próximos 7 dias</b>.</p><div class="chips" id="lcP" style="margin-bottom:10px"></div><div id="lcL"></div>', el => {
    let texto = '';
    const pintar = () => {
      $('#lcP', el).innerHTML = [3, 7, 14].map(x => '<button class="chip ' + (x === n ? 'on' : '') + '" data-n="' + x + '">' + x + ' dias</button>').join('');
      const soma = new Map(); let diasCom = 0, rapidos = 0;
      for (let i = 0; i < n; i++) {
        const d = dia(addDias(dataSel, i)); if (!d) continue; let tem = false;
        for (const k in d.ref) d.ref[k].forEach(it => {
          tem = true; if (it.q) { rapidos++; return; }
          const f = alimento(it.f); if (!f) return;
          const nome = nomeAlim(it.f); const x = soma.get(nome) || { g: 0, grupo: (SIMPLES_DE.get(f.id) || f).grupo || '' };
          x.g += it.g; x.c = Math.max(x.c || 0, custo(it.f)); soma.set(nome, x);
        });
        if (tem) diasCom++;
      }
      if (!soma.size) { $('#lcL', el).innerHTML = '<div class="vazio">Nada planejado nesses dias. Monte o cardápio da semana primeiro.</div><button class="btn bloco fant" data-op="fechar">Fechar</button>'; return; }
      const grupos = {}; soma.forEach((x, nome) => { (grupos[x.grupo] = grupos[x.grupo] || []).push([nome, x.g, x.c]); });
      let temPreco = false, temCaro = false; soma.forEach(x => { if (x.c) temPreco = true; if (x.c === 3) temCaro = true; });
      const q = g => g >= 1000 ? fmt(g / 1000, 1) + ' kg' : fmt(Math.round(g / 10) * 10) + ' g';
      texto = 'Lista de compras (' + n + ' dias)\n';
      let h = '<div class="mini" style="margin-bottom:8px">' + diasCom + ' de ' + n + ' dias com refeições' + (rapidos ? ' · ' + rapidos + ' registro(s) “só calorias” não entram' : '') + '</div>';
      Object.keys(grupos).sort().forEach(g => {
        h += '<h3 style="margin:10px 0 2px">' + esc(g || 'Outros') + '</h3><ul class="lista">' + grupos[g].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([nome, gr, c]) => '<li><div class="txt"><div class="t">' + esc(nome) + (c ? ' <span class="mini" style="color:' + (c === 3 ? 'var(--alerta)' : 'var(--txt3)') + '">' + '$'.repeat(c) + '</span>' : '') + '</div></div><div class="val">' + q(gr) + '</div></li>').join('') + '</ul>';
        texto += '\n' + (g || 'Outros') + '\n' + grupos[g].map(([nome, gr]) => '• ' + nome + ': ' + q(gr)).join('\n') + '\n';
      });
      if (temPreco) h += '<p class="mini" style="margin-top:10px">$ barato · $$ médio · $$$ caro (estimativa de preço).' + (temCaro && !economico() ? ' <b>Ficou caro?</b> Em Dieta › Cardápio pelos macros, ligue <b>💰 Econômico</b> e gere de novo.' : '') + '</p>';
      h += '<p class="mini" style="margin-top:10px">Os pesos são do alimento pronto. Arroz, feijão e macarrão crus pesam mais ou menos um terço disso.</p><div class="grade2" style="margin-top:10px"><button class="btn" data-op="fechar">Fechar</button><button class="btn pri" data-op="copiar">Copiar / enviar</button></div>';
      $('#lcL', el).innerHTML = h;
    };
    pintar();
    el.onclick = async e => {
      const c = e.target.closest('[data-n]'); if (c) { n = Number(c.dataset.n); pintar(); return; }
      const b = e.target.closest('[data-op]'); if (!b) return;
      if (b.dataset.op === 'fechar') return fecharFolha(fl);
      if (navigator.share) { try { await navigator.share({ title: 'Lista de compras', text: texto }); return; } catch (er) { if (er.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(texto); toast('Lista copiada. Cole no WhatsApp ou nas notas.'); } catch (er) { toast('Não consegui copiar neste aparelho.'); }
    };
  });
}
/* sódio, açúcar adicionado e gordura saturada do dia (referências OMS / Guia Alimentar) */
function nutrientesDia(iso) {
  const d = dia(iso); if (!d) return '';
  const t = { sodio: 0, acucar: 0, sat: 0 }; let semDado = 0;
  for (const k in d.ref) d.ref[k].forEach(it => { const f = alimento(it.f); if (!f) return; const q = it.g / 100; if (f.sodio == null) semDado++; t.sodio += (sodioDe(f) || 0) * q; t.acucar += (f.acucar || 0) * q; t.sat += (f.sat || 0) * q; });
  const m = calcMetas(); const kc = m ? m.kcal : 2000;
  const lim = { sodio: 2000, acucar: Math.round(kc * 0.10 / 4), sat: Math.round(kc * 0.10 / 9) };
  const linha = (nome, v, l, un) => '<span style="color:' + (v > l ? 'var(--alerta)' : 'var(--txt2)') + '">' + nome + ' <b>' + fmt(v) + '</b>/' + fmt(l) + ' ' + un + '</span>';
  return '<details style="margin-top:8px"><summary class="mini">Sódio, açúcar e gordura saturada do dia</summary><div class="mini" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px 14px">' + linha('Sódio', t.sodio, lim.sodio, 'mg') + linha('Açúcar adicionado', t.acucar, lim.acucar, 'g') + linha('Gord. saturada', t.sat, lim.sat, 'g') + '</div><div class="mini" style="margin-top:4px">Limites: sódio 2.000 mg (OMS); açúcar e saturada até 10% das calorias.' + (estiloAtual() === 'keto' || estiloAtual() === 'nocarb' ? ' Na keto/no carb o corpo perde mais sódio e a gordura saturada tende a passar do limite: acompanhe com seu médico, principalmente se tiver pressão ou colesterol alto.' : '') + (semDado ? ' Alguns alimentos criados por você não têm esses dados.' : '') + '</div></details>';
}
function folhaMenuRef(k) {
  const d = dia(dataSel); const itens = (d && d.ref[k]) || [];
  const fl = abrirFolha('<h2 style="margin-bottom:10px">' + REFEICOES[k] + '</h2>' +
    '<button class="btn bloco" style="margin-bottom:8px" data-op="salvar"' + (itens.length ? '' : ' disabled') + '>Salvar como refeição pronta</button>' +
    '<button class="btn bloco" style="margin-bottom:8px" data-op="prontas"' + (S.modelos.length ? '' : ' disabled') + '>Adicionar refeição pronta</button>' +
    '<button class="btn bloco" style="margin-bottom:8px" data-op="copiar">Copiar esta refeição do dia anterior</button>' +
    '<button class="btn bloco perigo" style="margin-bottom:8px" data-op="limpar"' + (itens.length ? '' : ' disabled') + '>Limpar esta refeição</button>' +
    '<button class="btn bloco fant" data-op="fechar">Fechar</button>', el => {
      el.onclick = async e => {
        const b = e.target.closest('[data-op]'); if (!b || b.disabled) return; const op = b.dataset.op;
        if (op === 'fechar') return fecharFolha(fl);
        if (op === 'salvar') { fecharFolha(fl); folhaSalvarModelo(k); return; }
        if (op === 'prontas') { fecharFolha(fl); folhaModelos(k); return; }
        if (op === 'copiar') {
          let orig = null; for (let i = 1; i <= 14; i++) { const dd = dia(addDias(dataSel, -i)); if (dd && dd.ref[k] && dd.ref[k].length) { orig = dd.ref[k]; break; } }
          if (!orig) { toast('Nenhum ' + REFEICOES[k].toLowerCase() + ' nos últimos 14 dias.'); return; }
          const dd = dia(dataSel, true); dd.ref[k] = (dd.ref[k] || []).concat(JSON.parse(JSON.stringify(orig))); salvar(); fecharFolha(fl); render(); toast(REFEICOES[k] + ' copiado.'); return;
        }
        if (op === 'limpar') { if (await confirmar('Apagar os itens de ' + REFEICOES[k].toLowerCase() + '?', 'Apagar', true)) { d.ref[k] = []; salvar(); fecharFolha(fl); render(); } }
      };
    });
}
function folhaSalvarModelo(k) {
  const itens = dia(dataSel).ref[k]; const s = somar(itens);
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Salvar refeição pronta</h2><p class="mini">' + itens.length + ' itens · ' + fmt(s.kcal) + ' kcal · P ' + fmt(s.p) + ' g</p><label class="campo"><span>Nome</span><input type="text" id="mdN" value="' + esc('Meu ' + REFEICOES[k].toLowerCase()) + '"></label><div class="grade2"><button class="btn" id="mdC">Cancelar</button><button class="btn pri" id="mdO">Salvar</button></div>', el => {
    $('#mdC', el).onclick = () => fecharFolha(fl);
    $('#mdO', el).onclick = () => { const nome = $('#mdN', el).value.trim() || REFEICOES[k]; S.modelos.push({ id: 'M' + Date.now(), nome, itens: JSON.parse(JSON.stringify(itens)) }); salvar(); fecharFolha(fl); render(); toast('Salvo. Use pelo menu ⋯ de qualquer refeição.'); };
  });
}
function folhaModelos(k) {
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Refeições prontas</h2><div id="mdL"></div><button class="btn bloco fant" style="margin-top:8px" id="mdF">Fechar</button>', el => {
    const desenhar = () => {
      $('#mdL', el).innerHTML = S.modelos.length ? S.modelos.map(md => { const s = somar(md.itens); return '<div class="res" data-md="' + md.id + '"><div class="txt"><div class="t">' + esc(md.nome) + '</div><div class="mini">' + md.itens.map(it => (it.q ? '' : fmt(it.g) + ' g ') + esc(nomeItem(it))).join(' · ') + '</div><div class="mini">' + fmt(s.kcal) + ' kcal · P ' + fmt(s.p) + ' · C ' + fmt(s.c) + ' · G ' + fmt(s.g) + '</div></div><button class="ic" data-rm="' + md.id + '" aria-label="Excluir">' + IC.lixo + '</button></div>'; }).join('') : '<div class="vazio">Nenhuma refeição pronta. Salve uma pelo menu ⋯ da refeição.</div>';
    };
    desenhar();
    $('#mdF', el).onclick = () => fecharFolha(fl);
    $('#mdL', el).onclick = async e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { e.stopPropagation(); if (await confirmar('Excluir esta refeição pronta?', 'Excluir', true)) { S.modelos = S.modelos.filter(x => x.id !== rm.dataset.rm); salvar(); desenhar(); render(); } return; }
      const r = e.target.closest('[data-md]'); if (!r) return; if (!k) { toast('Para usar, abra o menu ⋯ de uma refeição na Dieta.'); return; }
      const md = S.modelos.find(x => x.id === r.dataset.md); const d = dia(dataSel, true);
      d.ref[k] = (d.ref[k] || []).concat(JSON.parse(JSON.stringify(md.itens))); salvar(); fecharFolha(fl); render(); toast(md.nome + ' adicionado em ' + REFEICOES[k] + '.');
    };
  });
}

/* --- busca de alimentos --- */
function buscarAlimentos(q, lim) {
  const tk = sem(q).split(/[\s,]+/).filter(x => x.length > 0);
  if (!tk.length) return [];
  const res = [];
  const consider = f => {
    for (const t of tk) if (!f.busca.includes(t)) return;
    /* nome sem nome científico/parênteses pesa no tamanho; cada "c/ ..." que a busca não pediu é preparo extra */
    let sc = f.busca.split('(')[0].split(/, [a-z]+ [a-z]+\.? ?\(?l\.?\)?/)[0].length / 12;
    sc += ((f.busca.match(/\bc\/ /g) || []).length) * (tk.includes('c/') ? 0 : 5);
    if (f.busca.startsWith(tk[0])) sc -= 12;
    if (f.busca.includes(', ' + tk[0]) || f.busca.startsWith(tk[0] + ',')) sc -= 4;
    if (/c\/ (acucar|leite condensado)|caramel|frit|empanad|milanesa/.test(f.busca) && !tk.some(t => /acucar|frit|caramel|milanesa|empan/.test(t))) sc += 6;
    sc += f.busca.length / 60;
    if (COMUNS.has(f.id)) sc -= 6;
    if (S.favs.includes(f.id)) sc -= 20;
    if (String(f.id).startsWith('U')) sc -= 15;
    res.push([sc, f]);
  };
  S.meus.forEach(m => consider(alimento(m.id)));
  FOODS.forEach(consider);
  res.sort((a, b) => a[0] - b[0]);
  return res.slice(0, lim || 50).map(x => x[1]);
}
function estrela(id) { return '<button class="ic" data-acao="fav" data-id="' + esc(id) + '" aria-label="Favorito" style="color:' + (S.favs.includes(id) ? '#F2C14B' : 'var(--txt3)') + '">' + (S.favs.includes(id) ? IC.estrela : IC.estrela0) + '</button>'; }
function linhaAlimento(f) {
  const simples = SIMPLES_DE.has(f.id);
  return '<div class="res" data-acao="escolherAlim" data-id="' + esc(f.id) + '"><div class="txt"><div class="t">' + esc(simples ? nomeAlim(f.id) : f.nome) + '</div><div class="mini">' + (simples && especificado(f.id) ? '✎ ' + esc(detalheCurto(f.id)) + '<br>' : '') + fmt(f.kcal) + ' kcal · P ' + fmt(f.p, 1) + ' · C ' + fmt(f.c, 1) + ' · G ' + fmt(f.g, 1) + ' <span class="mini">(100 g)</span></div></div>' + estrela(f.id) + '</div>';
}
function linhaDetalhada(f) {
  return '<div class="res" data-acao="escolherAlim" data-id="' + esc(f.id) + '"><div class="txt"><div class="t">' + esc(f.nome) + '</div><div class="mini">' + fmt(f.kcal) + ' kcal · P ' + fmt(f.p, 1) + ' · C ' + fmt(f.c, 1) + ' · G ' + fmt(f.g, 1) + ' <span class="mini">(100 g)</span></div></div>' + estrela(f.id) + '</div>';
}
function linhaSimples(x) {
  const f = FOODS.get(x.ids[0]);
  return '<div class="res" data-acao="escolherAlim" data-id="' + esc(f.id) + '"><div class="txt"><div class="t">' + esc(x.nome) + (x.ids.length > 1 ? ' <span class="tag">' + x.ids.length + ' tipos</span>' : '') + '</div><div class="mini">' + fmt(f.kcal) + ' kcal · P ' + fmt(f.p, 1) + ' · C ' + fmt(f.c, 1) + ' · G ' + fmt(f.g, 1) + ' <span class="mini">(100 g)</span></div></div>' + estrela(f.id) + '</div>';
}
function buscarSimples(q) {
  const tk = sem(q).split(/[\s,]+/).filter(Boolean); if (!tk.length) return [];
  const r = [];
  SIMPLES.forEach(x => {
    if (tk.every(t => x.busca.includes(t))) r.push([(x.busca.startsWith(tk[0]) ? 0 : 5) + x.nome.length / 20 - (COMUNS.has(x.ids[0]) ? 6 : 0), x]);
    else if (tk.every(t => x.buscaPadrao.includes(t))) r.push([10 + x.nome.length / 20, x]);
  });
  return r.sort((a, b) => a[0] - b[0]).map(y => y[1]);
}
/* 1.6: ao abrir, uma lista só ("Meus": favoritos, depois recentes, depois os criados por você).
   "Todos" mostra a lista simplificada por grupo; a tabela completa fica num link no fim. */
function folhaBusca(ref, trocarRef) {
  const temMeus = S.favs.length || S.recentes.length || S.meus.length;
  let modo = temMeus ? 'meus' : 'todos', grupoSel = '', limite = 60, espera = null;
  const f = abrirFolha('<div id="refAlim"></div><input type="search" id="qAlim" placeholder="Buscar alimento (ex.: arroz, frango, banana)" autocomplete="off"><div class="rolax" style="margin:10px 0" id="modosAlim"></div><div class="rolax" style="margin:-4px 0 10px" id="gruposAlim"></div><div id="resAlim"></div>', el => {
    const q = $('#qAlim', el), res = $('#resAlim', el), modos = $('#modosAlim', el), grupos = $('#gruposAlim', el);
    const cabecalho = () => {
      $('#refAlim', el).innerHTML = trocarRef
        ? '<div class="rolax" style="margin-bottom:10px">' + refAtivas().map(k => '<button class="chip ' + (k === ref ? 'on' : '') + '" data-ref="' + k + '">' + REFEICOES[k] + '</button>').join('') + '</div>'
        : '<h2 style="margin-bottom:10px">' + REFEICOES[ref] + '</h2>';
      $('#refAlim', el).insertAdjacentHTML('beforeend', '<button class="btn bloco peq" style="margin-bottom:10px" data-rapido="1">Só calorias (refeição fora, sem pesar)</button>');
    };
    const desenhar = () => {
      const txt = q.value.trim();
      const det = modo === 'completa';
      modos.style.display = (txt && !det) ? 'none' : 'flex';
      modos.innerHTML = [['meus', 'Meus'], ['todos', 'Todos os alimentos']].map(([k, t]) => '<button class="chip ' + (modo === k ? 'on' : '') + '" data-m="' + k + '">' + t + '</button>').join('') + (det ? '<button class="chip on" data-m="completa">Tabela completa</button>' : '');
      grupos.style.display = (!txt && (modo === 'todos' || det)) ? 'flex' : 'none';
      let html = '', lista = [], total = 0, rotulo = '';
      if (det) {
        if (txt) lista = buscarAlimentos(txt, 60).map(linhaDetalhada);
        else { const todos = listaPorGrupo(grupoSel); total = todos.length; rotulo = ' alimentos da TBCA'; lista = todos.slice(0, limite).map(linhaDetalhada); }
        grupos.innerHTML = '<button class="chip ' + (!grupoSel ? 'on' : '') + '" data-g="">Todos</button>' + gruposVisiveis().map(g => '<button class="chip ' + (grupoSel === g ? 'on' : '') + '" data-g="' + esc(g) + '">' + esc(g) + '</button>').join('');
        html = '<div class="info" style="margin-bottom:8px">Tabela completa: cada preparo da TBCA separado (óleo, molho, marca…).</div>';
      } else if (txt) {
        const ss = buscarSimples(txt); lista = ss.map(linhaSimples);
        if (!ss.length) lista = buscarAlimentos(txt, 30).map(linhaAlimento);
      } else if (modo === 'todos') {
        const todos = S.meus.map(m => alimento(m.id)).filter(() => !grupoSel || grupoSel === 'Meus alimentos').map(linhaAlimento)
          .concat(SIMPLES.filter(x => !grupoSel || x.grupo === grupoSel).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(linhaSimples));
        total = todos.length; rotulo = ' alimentos'; lista = todos.slice(0, limite);
        grupos.innerHTML = '<button class="chip ' + (!grupoSel ? 'on' : '') + '" data-g="">Todos</button>' + SIMPLES_G.map(g => '<button class="chip ' + (grupoSel === g ? 'on' : '') + '" data-g="' + esc(g) + '">' + esc(g) + '</button>').join('');
      } else {
        /* "Meus": favoritos primeiro, depois recentes e criados, sem repetir */
        const vistos = new Set(); const ids = [];
        S.favs.concat(S.recentes, S.meus.map(m => m.id)).forEach(id => { if (!vistos.has(id) && alimento(id)) { vistos.add(id); ids.push(id); } });
        lista = ids.map(id => linhaAlimento(alimento(id)));
        if (S.favs.length) html = '<div class="mini" style="margin-bottom:4px">★ favoritos no topo · toque na estrela para marcar</div>';
      }
      res.innerHTML = html + (total ? '<div class="mini" style="margin-bottom:4px">' + total.toLocaleString('pt-BR') + rotulo + (grupoSel ? ' em ' + esc(grupoSel) : '') + ' · ordem alfabética</div>' : '') +
        (lista.length ? lista.join('') : '<div class="vazio">' + (txt ? 'Nada encontrado. Tente outra palavra, ou crie o alimento em "+ Criar alimento" na Dieta.' : 'Vazio por enquanto. Veja "Todos os alimentos" ou busque acima.') + '</div>') +
        (total > lista.length ? '<button class="btn bloco" style="margin-top:8px" data-mais="1">Mostrar mais (' + (total - lista.length).toLocaleString('pt-BR') + ' restantes)</button>' : '') +
        (!det ? '<button class="btn bloco fant" style="margin-top:8px" data-completa="1">' + (txt ? 'Procurar "' + esc(txt) + '" na tabela completa' : 'Ver a tabela completa (preparos detalhados)') + '</button>' : '');
    };
    /* espera 0,2 s depois da última letra antes de procurar: não trava celular simples */
    q.oninput = () => { clearTimeout(espera); espera = setTimeout(() => { limite = 60; desenhar(); }, 200); };
    modos.onclick = e => { const b = e.target.closest('[data-m]'); if (b) { modo = b.dataset.m; grupoSel = ''; limite = 60; desenhar(); } };
    grupos.onclick = e => { const b = e.target.closest('[data-g]'); if (b) { grupoSel = b.dataset.g; limite = 60; desenhar(); res.scrollIntoView({ block: 'nearest' }); } };
    $('#refAlim', el).onclick = e => {
      const r = e.target.closest('[data-ref]'); if (r) { ref = r.dataset.ref; cabecalho(); return; }
      if (e.target.closest('[data-rapido]')) { fecharFolha(f); folhaRapido(ref, null); }
    };
    res.addEventListener('click', e => {
      if (e.target.closest('[data-mais]')) { limite += 100; desenhar(); return; }
      if (e.target.closest('[data-completa]')) { modo = 'completa'; grupoSel = ''; limite = 60; desenhar(); return; }
      const fv = e.target.closest('[data-acao="fav"]');
      if (fv) { e.stopPropagation(); alternarFav(fv.dataset.id); desenhar(); return; }
      const r = e.target.closest('[data-acao="escolherAlim"]');
      if (r) folhaQuantidade(ref, r.dataset.id, null, () => fecharFolha(f));
    });
    cabecalho(); desenhar(); if (modo === 'meus') setTimeout(() => q.focus(), 150);
  });
  f._aoFechar = () => clearTimeout(espera);
}
/* catálogo completo para navegar sem digitar */
let catalogoAlim = null;
function catalogo() {
  if (!catalogoAlim) catalogoAlim = Array.from(FOODS.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return catalogoAlim;
}
function gruposVisiveis() { return ALIM_G; }
function listaPorGrupo(g) {
  const meus = S.meus.map(m => alimento(m.id)).filter(x => !g || g === 'Meus alimentos');
  return meus.concat(catalogo().filter(x => !g || x.grupo === g));
}
function alternarFav(id) {
  const i = S.favs.indexOf(id); if (i >= 0) S.favs.splice(i, 1); else S.favs.unshift(id); salvar();
}
const PORCOES = [['50 g', 50], ['100 g', 100], ['150 g', 150], ['200 g', 200]];
/* medidas caseiras aproximadas (g ou ml), pelo nome comum da lista simplificada */
const UN = n => [['1 unidade', n]], CS = n => [['1 colher de sopa', n]], BIFE = [['1 bife médio', 100]];
const MEDIDAS = {
  'Arroz branco': [['1 colher de sopa', 25], ['1 escumadeira', 90]], 'Arroz integral': [['1 colher de sopa', 25], ['1 escumadeira', 90]],
  'Macarrão': [['1 pegador', 110]], 'Macarrão integral': [['1 pegador', 110]], 'Pão francês': UN(50), 'Pão de forma': [['1 fatia', 25]], 'Pão integral': [['1 fatia', 25]],
  'Torrada': UN(9), 'Aveia': CS(15), 'Granola': CS(11), 'Tapioca': [['1 tapioca média', 70]], 'Cuscuz de milho': [['1 pedaço médio', 100]],
  'Biscoito salgado (cream cracker)': UN(6), 'Biscoito doce / maisena': UN(5), 'Biscoito recheado': UN(14), 'Farofa': CS(15), 'Farinha de mandioca': CS(16),
  'Feijão carioca': [['1 concha', 140], ['1 colher de sopa', 20]], 'Feijão preto': [['1 concha', 140], ['1 colher de sopa', 20]], 'Lentilha': CS(20), 'Grão-de-bico': CS(22),
  'Amendoim': CS(15), 'Pasta de amendoim': CS(15), 'Homus': CS(20),
  'Patinho': BIFE, 'Alcatra': BIFE, 'Contrafilé': BIFE, 'Picanha': [['1 fatia', 100]], 'Maminha': [['1 fatia', 100]], 'Fraldinha': [['1 fatia', 100]], 'Filé-mignon': [['1 medalhão', 100]],
  'Coxão mole': BIFE, 'Coxão duro': BIFE, 'Lagarto': [['1 fatia', 80]], 'Carne moída': CS(25), 'Fígado bovino': BIFE,
  'Peito de frango': [['1 filé médio', 100]], 'Coxa de frango': UN(60), 'Sobrecoxa de frango': UN(90), 'Lombo de porco': [['1 fatia', 80]], 'Bisteca de porco': UN(100),
  'Linguiça': [['1 gomo', 60]], 'Salsicha': UN(50), 'Presunto': [['1 fatia', 15]], 'Peito de peru': [['1 fatia', 15]], 'Mortadela': [['1 fatia', 15]], 'Hambúrguer (carne)': UN(90), 'Almôndega': UN(30),
  'Tilápia': [['1 filé', 120]], 'Salmão': [['1 posta', 120]], 'Atum': [['1 lata (drenado)', 120]], 'Sardinha': UN(30), 'Merluza': [['1 filé', 120]], 'Pescada': [['1 filé', 120]], 'Camarão': UN(10),
  'Ovo cozido': UN(50), 'Ovo frito': UN(55), 'Ovo mexido': [['1 ovo', 55]], 'Ovo cru': UN(50), 'Clara de ovo': [['1 clara', 30]], 'Gema de ovo': [['1 gema', 17]], 'Omelete': [['de 2 ovos', 120]],
  'Leite integral': [['1 copo (200 ml)', 200]], 'Leite desnatado': [['1 copo (200 ml)', 200]], 'Leite semidesnatado': [['1 copo (200 ml)', 200]], 'Leite em pó': CS(16),
  'Iogurte natural': [['1 pote', 170]], 'Iogurte natural desnatado': [['1 pote', 170]], 'Iogurte com sabor': [['1 pote', 100]], 'Bebida láctea': [['1 garrafinha', 180]], 'Kefir': [['1 copo (200 ml)', 200]],
  'Queijo minas frescal': [['1 fatia', 30]], 'Queijo minas padrão': [['1 fatia', 20]], 'Queijo muçarela': [['1 fatia', 20]], 'Queijo prato': [['1 fatia', 20]], 'Queijo parmesão': [['1 colher de sopa (ralado)', 5]],
  'Queijo coalho': [['1 espeto', 40]], 'Ricota': [['1 fatia', 30]], 'Requeijão': CS(30), 'Cream cheese': CS(20), 'Creme de leite': CS(15), 'Leite condensado': CS(20),
  'Banana': UN(70), 'Maçã': UN(130), 'Laranja': UN(150), 'Tangerina / mexerica': UN(100), 'Mamão': [['½ papaia', 150]], 'Manga': UN(150), 'Uva': [['10 uvas', 50]],
  'Abacaxi': [['1 fatia', 75]], 'Melancia': [['1 fatia', 200]], 'Melão': [['1 fatia', 115]], 'Morango': UN(12), 'Pera': UN(130), 'Goiaba': UN(150), 'Kiwi': UN(75), 'Abacate': CS(30), 'Caqui': UN(110), 'Pêssego': UN(100), 'Ameixa': UN(50),
  'Tomate': UN(100), 'Pepino': UN(150), 'Cebola': UN(100), 'Beterraba': UN(100),
  'Batata inglesa': UN(130), 'Batata-doce': [['1 pedaço médio', 100]], 'Mandioca (aipim)': [['1 pedaço médio', 100]], 'Purê de batata': [['1 colher de servir', 45]], 'Inhame': UN(100), 'Mandioquinha (batata-baroa)': UN(80),
  'Azeite de oliva': [['1 colher de sopa', 13], ['1 colher de chá', 4]], 'Óleo de soja': CS(13), 'Óleo de coco': CS(13), 'Manteiga': [['1 colher de chá', 5]], 'Margarina': [['1 colher de chá', 5]], 'Maionese': CS(12),
  'Castanha-do-pará': UN(4), 'Castanha de caju': UN(2.5), 'Amêndoa': UN(1.2), 'Nozes': UN(5), 'Mix de castanhas': [['1 punhado', 30]], 'Linhaça': CS(10), 'Chia': CS(10), 'Gergelim': CS(9),
  'Café': [['1 xícara (50 ml)', 50]], 'Suco de laranja': [['1 copo (250 ml)', 250]], 'Suco natural (frutas)': [['1 copo (250 ml)', 250]], 'Suco industrializado': [['1 copo (250 ml)', 250]],
  'Refrigerante': [['1 lata', 350]], 'Água de coco': [['1 copo (250 ml)', 250]], 'Achocolatado': CS(15), 'Isotônico': [['1 garrafa', 500]], 'Energético': [['1 lata', 250]],
  'Cerveja': [['1 lata', 350]], 'Vinho': [['1 taça', 150]], 'Destilado (cachaça, vodka...)': [['1 dose', 50]],
  'Açúcar': [['1 colher de chá', 5], ['1 colher de sopa', 12]], 'Mel': CS(20), 'Chocolate': [['1 barra pequena', 25]], 'Doce de leite': CS(20), 'Geleia': CS(20), 'Brigadeiro': UN(20), 'Paçoca': UN(22), 'Sorvete': [['1 bola', 60]],
  'Coxinha': UN(80), 'Pastel': UN(80), 'Esfirra': UN(80), 'Empada': UN(60), 'Misto-quente': UN(100), 'Pizza': [['1 fatia', 110]], 'Lasanha': [['1 pedaço', 200]], 'Sushi': UN(30)
};
function medidasDe(id) {
  const m = S.meus.find(x => x.id === id); if (m && m.porcao && m.porcao !== 100) return [['1 porção', m.porcao]];
  const sx = SIMPLES_DE.get(id); return (sx && MEDIDAS[sx.nome]) || [];
}
/* " (≈ 2 unidades)" quando a quantidade cai perto de um número redondo da medida */
function medidaTexto(id, g) {
  const ms = medidasDe(id); if (!ms.length || !g) return '';
  const [rot, gm] = ms[0]; const n = Math.round(g / gm * 2) / 2;
  if (n < 0.5 || n > 12 || Math.abs(n * gm - g) > Math.max(5, g * 0.12)) return '';
  if (n === 1) return ' (≈ ' + rot + ')';
  if (n === 0.5 && /^1 /.test(rot)) return ' (≈ ½ ' + rot.slice(2) + ')';
  if (!/^1 /.test(rot)) return ' (≈ ' + fmt(n, n % 1 ? 1 : 0) + ' × ' + rot + ')';
  return ' (≈ ' + fmt(n, n % 1 ? 1 : 0) + ' ' + plural(rot.slice(2)) + ')';
}
/* plural simples das medidas: "colher de sopa" → "colheres de sopa", "bife médio" → "bifes médios" */
function plural(t) {
  const pl = w => /ão$/.test(w) ? w.replace(/ão$/, 'ões') : /[rz]$/.test(w) ? w + 'es' : /[aeiouéêó]$/i.test(w) ? w + 's' : w;
  const p = t.split(' '); p[0] = pl(p[0]); if (p[1] && /^médi[oa]$/.test(p[1])) p[1] += 's'; return p.join(' ');
}
function folhaQuantidade(ref, id, idx, aoAdicionar) {
  if (!alimento(id)) return;
  let cur = id;
  const sx = SIMPLES_DE.get(id);
  const d0 = dia(dataSel);
  const meds = medidasDe(id);
  /* quantidade inicial: a que já está no item, senão a última que você usou, senão 1 medida caseira, senão 100 g */
  const g0 = idx != null ? d0.ref[ref][idx].g : (S.ultG[id] || (sx && sx.ids.some(v => S.ultG[v]) ? S.ultG[sx.ids.find(v => S.ultG[v])] : 0) || (meds.length ? meds[0][1] : 100));
  const variantes = sx && sx.ids.length > 1 ? sx.ids.map(v => FOODS.get(v)) : [];
  /* 1.6: com medida caseira, a quantidade é escolhida com − e +; as gramas ficam como alternativa */
  let mi = 0;
  const fl = abrirFolha('<h3 style="margin-bottom:4px">' + esc(nomeAlim(id)) + '</h3><div class="mini" style="margin-bottom:12px" id="qDet"></div>' +
    (meds.length ? '<div class="stepper"><button type="button" data-st="-1" aria-label="Menos">−</button><div class="val"><div class="num" id="stN"></div><div class="mini" id="stR"></div></div><button type="button" data-st="1" aria-label="Mais">+</button></div>' +
      (meds.length > 1 ? '<div class="chips" style="margin-bottom:10px" id="qMed">' + meds.map((m, i) => '<button class="chip" data-med="' + i + '">' + esc(m[0].replace(/^1 /, '')) + '</button>').join('') + '</div>' : '') : '') +
    '<label class="campo"><span>' + (meds.length ? 'Ou em gramas (g ou ml)' : 'Quantidade (g ou ml)') + '</span><input type="number" inputmode="decimal" id="qtdG" value="' + g0 + '"></label>' +
    (meds.length ? '<div class="mini" style="margin:-4px 0 12px">Medidas caseiras são aproximadas.</div>' : '<div class="chips" style="margin-bottom:12px">' + PORCOES.map(p => '<button class="chip" data-g="' + p[1] + '">' + p[0] + '</button>').join('') + '</div>') +
    '<div class="grade4" id="prevMac"></div>' +
    (variantes.length ? '<details id="qEsp" style="margin-top:12px"' + (especificado(id) ? ' open' : '') + '><summary>Especificar tipo / preparo (opcional) · ' + variantes.length + ' opções</summary><div id="qVar" style="margin-top:6px"></div></details>' : '') +
    '<details style="margin-top:10px"><summary>Mais nutrientes (por 100 g)</summary><div class="mini" style="margin-top:6px" id="qNut"></div></details>' +
    '<div class="grade2" style="margin-top:14px">' + (idx != null ? '<button class="btn perigo" id="remItem">Remover</button>' : '<button class="btn" id="cancQ">Cancelar</button>') + '<button class="btn pri" id="okQ">' + (idx != null ? 'Salvar' : 'Adicionar') + '</button></div>', el => {
      const inp = $('#qtdG', el);
      const prev = () => {
        const g = num(inp.value) || 0; const mm = macrosItem({ f: cur, g }); const f = alimento(cur);
        $('#prevMac', el).innerHTML = [['kcal', mm.kcal, '#ECEFF1'], ['Prot', mm.p, 'var(--p)'], ['Carb', mm.c, 'var(--c)'], ['Gord', mm.g, 'var(--g)']].map(x => '<div class="cartao" style="padding:8px;margin:0;text-align:center"><div class="num" style="font-size:20px">' + fmt(x[1], x[0] === 'kcal' ? 0 : 1) + '</div><div class="mini"><i class="ponto" style="background:' + x[2] + '"></i>' + x[0] + '</div></div>').join('');
        $('#qDet', el).textContent = (sx ? (cur === sx.ids[0] ? 'Tipo padrão: ' : 'Especificado: ') + detalheCurto(cur) : f.grupo) + ' · valores por 100 g (TBCA)';
        $('#qNut', el).innerHTML = 'Fibra ' + fmt(f.fibra, 1) + ' g · Sódio ' + fmt(sodioDe(f)) + ' mg' + (f.sal ? (S.cfg.semSal && f.sodioSemSal != null ? ' (preparo sem sal)' : ' (preparo com sal)') : '') + ' · Açúcar adicionado ' + fmt(f.acucar, 1) + ' g · Gord. saturada ' + fmt(f.sat, 1) + ' g · Cálcio ' + fmt(f.calcio) + ' mg · Ferro ' + fmt(f.ferro, 1) + ' mg · Potássio ' + fmt(f.potassio) + ' mg · Vitamina C ' + fmt(f.vitc, 1) + ' mg';
        if (variantes.length) $('#qVar', el).innerHTML = variantes.map((v, i) => '<div class="res" data-var="' + esc(v.id) + '" style="' + (v.id === cur ? 'background:var(--acento-esc);border-radius:10px' : '') + '"><div class="txt"><div class="t" style="font-size:14px">' + (v.id === cur ? '● ' : '○ ') + esc(v.nome) + '</div><div class="mini">' + (i === 0 ? '<b>padrão</b> · ' : '') + fmt(v.kcal) + ' kcal · P ' + fmt(v.p, 1) + ' · C ' + fmt(v.c, 1) + ' · G ' + fmt(v.g, 1) + '</div></div></div>').join('');
        if (meds.length) {
          const [rot, gm] = meds[mi]; const n = g / gm; const meio = Math.round(n * 2) / 2; const exato = Math.abs(meio - n) < 0.02;
          $('#stN', el).textContent = (exato ? '' : '≈ ') + (meio === 0.5 ? '½' : fmt(exato ? meio : n, (exato ? meio : n) % 1 ? 1 : 0));
          $('#stR', el).textContent = /^1 /.test(rot) ? (meio > 1 || !exato && n > 1 ? plural(rot.slice(2)) : rot.slice(2)) + ' · ' + fmt(g) + ' g' : '× ' + rot + ' · ' + fmt(g) + ' g';
          $$('[data-med]', el).forEach(b => b.classList.toggle('on', Number(b.dataset.med) === mi));
        }
      };
      inp.oninput = prev; prev();
      if (variantes.length) $('#qVar', el).onclick = e => { const r = e.target.closest('[data-var]'); if (r) { cur = r.dataset.var; prev(); } };
      $$('[data-g]', el).forEach(b => b.onclick = () => { inp.value = b.dataset.g; prev(); });
      if (meds.length) {
        /* − e +: de meia em meia medida até 2, depois de uma em uma */
        $$('[data-st]', el).forEach(b => b.onclick = () => {
          const gm = meds[mi][1]; const atual = Math.round((num(inp.value) || 0) / gm * 2) / 2; const sobe = b.dataset.st === '1';
          const passo = sobe ? (atual >= 2 ? 1 : 0.5) : (atual > 2 ? 1 : 0.5);
          const n = Math.max(0.5, atual + (sobe ? passo : -passo));
          inp.value = r1(n * gm); prev();
        });
        if ($('#qMed', el)) $('#qMed', el).onclick = e => { const b = e.target.closest('[data-med]'); if (b) { mi = Number(b.dataset.med); prev(); } };
      }
      if ($('#cancQ', el)) $('#cancQ', el).onclick = () => fecharFolha(fl);
      if ($('#remItem', el)) $('#remItem', el).onclick = () => { d0.ref[ref].splice(idx, 1); salvar(); fecharFolha(fl); render(); };
      $('#okQ', el).onclick = () => {
        const g = num(inp.value); if (!g || g <= 0) { toast('Informe a quantidade.'); return; }
        const d = dia(dataSel, true); d.ref[ref] = d.ref[ref] || [];
        if (idx != null) { d.ref[ref][idx].g = g; d.ref[ref][idx].f = cur; } else d.ref[ref].push({ f: cur, g });
        S.recentes = [cur].concat(S.recentes.filter(x => x !== cur)).slice(0, 30);
        S.ultG[cur] = g;
        salvar(); fecharFolha(fl); if (aoAdicionar) aoAdicionar(); render(); toast(idx != null ? 'Atualizado.' : 'Adicionado em ' + REFEICOES[ref] + '.');
      };
    });
}
function folhaNovoAlimento() {
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Criar alimento</h2><p class="mini">Para produtos que não estão na tabela (ex.: whey, barra de proteína). Use os dados do rótulo.</p>' +
    '<label class="campo"><span>Nome</span><input type="text" id="naNome" placeholder="Ex.: Whey protein concentrado"></label>' +
    '<label class="campo"><span>Os valores abaixo são de uma porção de (g)</span><input type="number" inputmode="decimal" id="naPor" value="100"></label>' +
    '<div class="grade2"><label class="campo"><span>Calorias (kcal)</span><input type="number" inputmode="decimal" id="naK"></label><label class="campo"><span>Proteína (g)</span><input type="number" inputmode="decimal" id="naP"></label><label class="campo"><span>Carboidrato (g)</span><input type="number" inputmode="decimal" id="naC"></label><label class="campo"><span>Gordura (g)</span><input type="number" inputmode="decimal" id="naG"></label><label class="campo"><span>Fibra (g)</span><input type="number" inputmode="decimal" id="naF"></label><label class="campo"><span>Sódio (mg)</span><input type="number" inputmode="decimal" id="naS"></label></div>' +
    '<div class="grade2"><button class="btn" id="naCanc">Cancelar</button><button class="btn pri" id="naOk">Salvar</button></div>', el => {
      $('#naCanc', el).onclick = () => fecharFolha(fl);
      $('#naOk', el).onclick = () => {
        const nome = $('#naNome', el).value.trim(); const por = num($('#naPor', el).value) || 100; const k = 100 / por;
        const v = id => { const n = num($(id, el).value); return n == null ? null : r1(n * k); };
        if (!nome || v('#naK') == null) { toast('Preencha pelo menos nome e calorias.'); return; }
        S.meus.push({ id: 'U' + Date.now(), nome, porcao: por, kcal: v('#naK'), p: v('#naP') || 0, c: v('#naC') || 0, g: v('#naG') || 0, fibra: v('#naF'), sodio: v('#naS') });
        salvar(); fecharFolha(fl); toast('Alimento criado. Ele aparece em "Meus alimentos" na busca.');
      };
    });
}

/* --- gerador de cardápio pelos macros --- */
const GER = {
  protPrincipal: [['C0997F', 'Peito de frango grelhado', 80, 260], ['C0045F', 'Patinho grelhado', 80, 240], ['C0486E', 'Tilápia grelhada', 100, 300], ['C0039E', 'Atum em conserva', 60, 170], ['C0194F', 'Peito de frango cozido', 80, 260]],
  protLeve: [['C0010J', 'Ovo cozido', 50, 200, 50], ['C0022G', 'Iogurte natural desnatado', 100, 340], ['C0052G', 'Queijo minas frescal', 20, 80], ['C0036G', 'Leite desnatado', 150, 400], ['C0004J', 'Clara cozida', 30, 200]],
  carbPrincipal: [['C0018A', 'Arroz branco', 60, 350], ['C0016A', 'Arroz integral', 60, 350], ['C0042B', 'Batata-doce cozida', 80, 450], ['C0053B', 'Mandioca cozida', 60, 350], ['C0834A', 'Macarrão cozido', 60, 350]],
  carbCafe: [['C0002A', 'Pão francês', 25, 150, 25], ['C0155A', 'Pão integral de forma', 25, 125, 25], ['C0024A', 'Aveia em flocos', 15, 90], ['C0906B', 'Tapioca', 30, 120], ['C0190A', 'Cuscuz de milho', 60, 300]],
  feijao: [['C0001T', 'Feijão carioca', 140], ['C0008T', 'Feijão preto', 140]],
  fruta: [['C0011C', 'Banana prata', 90], ['C0023C', 'Maçã', 130], ['C0044C', 'Mamão papaia', 150], ['C0020C', 'Laranja pera', 150]],
  verdura: [['C0009B', 'Alface', 40], ['C0035B', 'Tomate', 60], ['C0643B', 'Brócolis cozido', 80], ['C0509B', 'Cenoura cozida', 50]],
  gordura: [['C0002D', 'Azeite de oliva', 3, 20, 1], ['C0001C', 'Abacate', 30, 150], ['C0003U', 'Castanha-do-pará', 5, 30], ['C0021T', 'Amendoim torrado', 10, 40], ['C0290T', 'Pasta de amendoim', 10, 40]],
  /* low carb / keto / no carb */
  carbLow: [['C0042B', 'Batata-doce cozida', 40, 200], ['C0016A', 'Arroz integral', 40, 150], ['C0053B', 'Mandioca cozida', 40, 150]],
  frutaLow: [['C0029C', 'Morango', 100], ['C0044C', 'Mamão papaia', 100], ['C0023C', 'Maçã', 100]],
  protKeto: [['C0115F', 'Sobrecoxa assada c/ pele', 80, 260], ['C0460F', 'Picanha grelhada', 80, 240], ['C0297F', 'Contrafilé grelhado', 80, 240], ['C0461E', 'Sardinha frita', 60, 220], ['C0997F', 'Peito de frango grelhado', 80, 260], ['C0045F', 'Patinho grelhado', 80, 240]],
  ovoQueijo: [['C0015J', 'Ovo frito', 50, 200, 50], ['C0010J', 'Ovo cozido', 50, 200, 50], ['C0059G', 'Queijo muçarela', 20, 100], ['C0048G', 'Queijo coalho', 30, 120], ['C0064G', 'Queijo prato', 20, 100]],
  gordAnimal: [['C0006D', 'Manteiga', 5, 30, 1]],
  gordKeto: [['C0002D', 'Azeite de oliva', 3, 35, 1], ['C0006D', 'Manteiga', 5, 30, 1], ['C0001C', 'Abacate', 30, 200], ['C0003U', 'Castanha-do-pará', 5, 40], ['C0009U', 'Nozes', 5, 40], ['C0006G', 'Cream cheese', 15, 60], ['C0010G', 'Creme de leite', 15, 60], ['C0013C', 'Coco (polpa)', 15, 60]],
  verdKeto: [['C0116B', 'Couve-flor cozida', 80], ['C0152B', 'Abobrinha cozida', 80], ['C0073B', 'Espinafre cozido', 60], ['C0643B', 'Brócolis cozido', 80], ['C0061B', 'Alface', 40], ['C0030B', 'Pepino', 60]]
};
/* listas de cada estilo (para o cardápio e para as preferências) */
const LISTAS_ESTILO = {
  padrao: ['protPrincipal', 'protLeve', 'carbPrincipal', 'carbCafe', 'feijao', 'fruta', 'verdura', 'gordura'],
  lowcarb: ['protPrincipal', 'protLeve', 'carbLow', 'feijao', 'frutaLow', 'verdKeto', 'gordura'],
  keto: ['protKeto', 'ovoQueijo', 'gordKeto', 'verdKeto'],
  nocarb: ['protKeto', 'ovoQueijo', 'gordAnimal']
};
function estiloAtual() { return (S.perfil && ESTILOS[S.perfil.estilo]) ? S.perfil.estilo : 'padrao'; }
/* 1.6: alguns códigos da tabela foram juntados (c/ sal + s/ sal); troca pelos que ficaram */
Object.values(GER).forEach(l => l.forEach(x => { x[0] = ALIAS[x[0]] || x[0]; }));
/* 1.6: dieta econômica. Faixa de preço aproximada (preço comum de supermercado no Brasil, pelo que a porção entrega):
   1 = barato, 2 = médio, 3 = caro. O cardápio troca o caro pelo barato e a lista de compras mostra a faixa. */
const GER_ECON = {
  /* só carnes baratas e magras: sardinha, carne moída e sobrecoxa têm o dobro de gordura e, nas porções que a proteína pede, passam das calorias */
  protPrincipal: [['C0843F', 'Coxa de frango cozida (sem pele)', 80, 260], ['C0751F', 'Fígado bovino grelhado', 80, 200], ['C0670F', 'Músculo bovino cozido', 80, 220]],
  carbPrincipal: [['C0117B', 'Batata cozida', 100, 500], ['C0143A', 'Polenta (fubá cozido)', 100, 400]],
  verdura: [['C0033B', 'Repolho cru', 50], ['C0154B', 'Chuchu cozido', 80]],
  gordura: [['C0030D', 'Óleo de soja', 3, 20, 1]]
};
/* o caro → o barato que faz o mesmo papel na refeição */
const TROCA_ECON = {
  C0002D: ['C0030D', 'Óleo de soja', 3, 20, 1],
  /* amendoim tem proteína: com porção grande o cálculo o usa para bater a proteína e as calorias passam da meta */
  C0003U: ['C0021T', 'Amendoim torrado', 5, 15],
  C0009U: ['C0021T', 'Amendoim torrado', 5, 15],
  C0021T: ['C0021T', 'Amendoim torrado', 5, 15],
  C0045F: ['C0670F', 'Músculo bovino cozido', 80, 220],
  C0486E: ['C0843F', 'Coxa de frango cozida (sem pele)', 80, 260],
  C0460F: ['C0115F', 'Sobrecoxa assada c/ pele', 80, 260],
  C0297F: ['C0650F', 'Acém cozido', 80, 240],
  C0006G: ['C0010G', 'Creme de leite', 15, 60]
};
const CUSTO_BASE = {
  C0997F: 1, C0194F: 1, C0045F: 3, C0486E: 3, C0039E: 2, C0010J: 1, C0022G: 2, C0052G: 2, C0036G: 1, C0004J: 1,
  C0018A: 1, C0016A: 1, C0042B: 1, C0053B: 1, C0834A: 1, C0002A: 1, C0155A: 2, C0024A: 1, C0906B: 1, C0190A: 1,
  C0001T: 1, C0008T: 1, C0011C: 1, C0023C: 2, C0044C: 2, C0020C: 1, C0009B: 1, C0035B: 1, C0643B: 2, C0509B: 1,
  C0002D: 3, C0001C: 2, C0003U: 3, C0021T: 1, C0290T: 2, C0029C: 3, C0115F: 1, C0460F: 3, C0297F: 3, C0461E: 1,
  C0015J: 1, C0059G: 2, C0048G: 2, C0064G: 2, C0006D: 2, C0009U: 3, C0006G: 3, C0010G: 2, C0013C: 2,
  C0116B: 2, C0152B: 1, C0073B: 2, C0061B: 1, C0030B: 1,
  C0956F: 1, C0843F: 1, C0245F: 1, C0751F: 1, C0071E: 1, C0670F: 1, C0117B: 1, C0143A: 1, C0033B: 1, C0154B: 1, C0030D: 1, C0650F: 2
};
Object.values(GER_ECON).forEach(l => l.forEach(x => { x[0] = ALIAS[x[0]] || x[0]; }));
const TROCA = {}; for (const k in TROCA_ECON) { const v = TROCA_ECON[k].slice(); v[0] = ALIAS[v[0]] || v[0]; TROCA[ALIAS[k] || k] = v; }
const CUSTO = {}; for (const k in CUSTO_BASE) CUSTO[ALIAS[k] || k] = CUSTO_BASE[k];
function custo(id) { return CUSTO[ALIAS[id] || id] || 0; } /* 0 = sem faixa conhecida */
function economico() { return !!S.cfg.economico; }
/* as listas do cardápio; no modo econômico ganham as opções baratas (no fim, para os índices continuarem valendo) */
function listasGer() {
  if (!economico()) return GER;
  const o = {}; for (const k in GER) o[k] = GER[k].concat(GER_ECON[k] || []); return o;
}
const COMUNS = new Set([].concat(...Object.values(GER), ...Object.values(GER_ECON)).map(x => x[0]));
const PARTE_REF = { cafe: 0.22, lanche1: 0.10, almoco: 0.30, lanche2: 0.13, jantar: 0.25, ceia: 0.08 };
function sortear(l) { return l[Math.floor(Math.random() * l.length)]; }
/* resolve gramas de 3 itens (proteína, carbo, gordura) para bater P/C/G-alvo da refeição, com limites */
function resolver3(itens, alvo) {
  const vars = itens.filter(i => i.var);
  const fixos = itens.filter(i => !i.var);
  const resto = { p: alvo.p, c: alvo.c, g: alvo.g };
  fixos.forEach(i => { const f = alimento(i.f); resto.p -= f.p * i.g / 100; resto.c -= f.c * i.g / 100; resto.g -= f.g * i.g / 100; });
  /* mínimos quadrados com gradiente projetado: simples, estável e respeita min/max */
  const A = vars.map(i => { const f = alimento(i.f); return [f.p / 100, f.c / 100, f.g / 100]; });
  const b = [resto.p, resto.c, resto.g];
  const w = [1, 0.7, 1.6];
  let x = vars.map(i => (i.min + i.max) / 2);
  for (let it = 0; it < 4000; it++) {
    const r = [0, 0, 0];
    for (let k = 0; k < 3; k++) { let s = 0; vars.forEach((v, j) => s += A[j][k] * x[j]); r[k] = (s - b[k]) * w[k]; }
    let mudou = 0;
    vars.forEach((v, j) => {
      let gr = 0; for (let k = 0; k < 3; k++) gr += A[j][k] * r[k];
      const passo = 0.5 / (A[j][0] * A[j][0] + A[j][1] * A[j][1] + A[j][2] * A[j][2] + 1e-6);
      const nx = clamp(x[j] - gr * passo * 0.5, v.min, v.max); mudou += Math.abs(nx - x[j]); x[j] = nx;
    });
    if (mudou < 0.01) break;
  }
  vars.forEach((v, j) => { const st = v.passo || 5; v.g = Math.max(v.min, Math.round(x[j] / st) * st); });
  return itens.map(i => ({ f: i.f, g: i.g }));
}
function itemVar(def) { return { f: def[0], var: true, min: def[2], max: def[3], passo: def[4] || (def[3] <= 40 ? 1 : 5) }; }
function itemFixo(def, g) { return { f: def[0], g: g || def[2] }; }
function montarRefeicaoEstilo(k, alvo, est) {
  const G = listasGer(), itens = [];
  const V = (l, r) => { const x = sortearPref(l, r); if (x) itens.push(itemVar(x)); };
  const F = (l, g) => { const x = sortearPref(l); if (x) itens.push(itemFixo(x, g)); };
  const verd = n => { const ev = S.cfg.evitar || []; G.verdKeto.filter(x => !ev.includes(x[0]) && (!economico() || custo(x[0]) <= 1)).sort(() => Math.random() - 0.5).slice(0, n).forEach(x => itens.push(itemFixo(x))); };
  const principal = k === 'almoco' || k === 'jantar';
  const ovos = G.ovoQueijo.slice(0, 2), queijos = G.ovoQueijo.slice(2);
  if (est === 'nocarb') {
    if (principal) { V(G.protKeto); V(G.gordAnimal); }
    else if (k === 'cafe') { V(ovos); V(queijos); V(G.gordAnimal); }
    else { V(queijos); V(ovos); }
  } else if (est === 'keto') {
    if (principal) { V(G.protKeto); V(G.gordKeto.slice(0, 3), G.gordKeto); verd(2); }
    else if (k === 'cafe') { V(ovos); V(queijos); V([G.gordKeto[2], G.gordKeto[6], G.gordKeto[1]], G.gordKeto); }
    else { V(queijos.concat(ovos.slice(1))); V([G.gordKeto[3], G.gordKeto[4], G.gordKeto[7]], G.gordKeto); }
  } else { /* low carb */
    if (principal) { V(G.protPrincipal); V(G.carbLow); V([G.gordura[0]], G.gordura); if (k === 'almoco') F(G.feijao, 70); verd(2); }
    else if (k === 'cafe') { V([G.protLeve[0], G.protLeve[2]], G.protLeve); F(G.frutaLow); V([G.gordura[1], G.gordura[2], G.gordura[4]], G.gordura); }
    else { V([G.protLeve[1], G.protLeve[2], G.protLeve[0]], G.protLeve); if (k === 'lanche2' || k === 'lanche1') F(G.frutaLow); V([G.gordura[2], G.gordura[3], G.gordura[4]], G.gordura); }
  }
  return { itens, res: resolver3(itens, alvo) };
}
/* sorteio com preferências: tira os alimentos marcados para evitar e dá preferência aos favoritos */
function sortearPref(lista, reserva) {
  const evitar = S.cfg.evitar || [];
  let l = lista.filter(x => !evitar.includes(x[0]));
  if (!l.length && reserva) l = reserva.filter(x => !evitar.includes(x[0]));
  if (!l.length) return null;
  /* econômico: troca o caro pelo equivalente barato e fica com a faixa mais barata que sobrar */
  if (economico()) {
    const vistos = new Set();
    const trocada = l.map(x => TROCA[x[0]] || x).filter(x => !evitar.includes(x[0]) && !vistos.has(x[0]) && vistos.add(x[0]));
    if (trocada.length) l = trocada; /* se o barato está entre os evitados, fica com o original */
    const b1 = l.filter(x => custo(x[0]) === 1), b2 = l.filter(x => custo(x[0]) && custo(x[0]) <= 2);
    l = b1.length ? b1 : (b2.length ? b2 : l);
  }
  const favs = l.filter(x => S.favs.includes(x[0]) || (SIMPLES_DE.get(x[0]) && SIMPLES_DE.get(x[0]).ids.some(id => S.favs.includes(id))));
  return favs.length && Math.random() < 0.7 ? sortear(favs) : sortear(l);
}
function montarRefeicao(k, alvo) {
  const est = estiloAtual();
  if (est !== 'padrao') return montarRefeicaoEstilo(k, alvo, est);
  const G = listasGer(), itens = [];
  const V = (l, r) => { const x = sortearPref(l, r); if (x) itens.push(itemVar(x)); };
  const F = (l, r) => { const x = sortearPref(l, r); if (x) itens.push(itemFixo(x)); };
  const leve = [G.protLeve[0], G.protLeve[2], G.protLeve[1], G.protLeve[3]];
  if (k === 'almoco' || k === 'jantar') {
    V(G.protPrincipal, leve);
    V(k === 'almoco' ? G.carbPrincipal.slice(0, 2) : G.carbPrincipal, G.carbPrincipal);
    V([G.gordura[0]], G.gordura);
    if (k === 'almoco') F(G.feijao);
    const ev = S.cfg.evitar || [];
    G.verdura.filter(x => !ev.includes(x[0]) && (!economico() || custo(x[0]) <= 1)).sort(() => Math.random() - 0.5).slice(0, 2).forEach(x => itens.push(itemFixo(x)));
  } else if (k === 'cafe') {
    V([G.protLeve[0], G.protLeve[2], G.protLeve[1]], leve); V(G.carbCafe); F(G.fruta); V([G.gordura[1], G.gordura[4], G.gordura[2]], G.gordura);
  } else if (k === 'ceia') {
    V([G.protLeve[1], G.protLeve[3], G.protLeve[0]], leve); V([G.carbCafe[2]], G.carbCafe); V([G.gordura[2], G.gordura[3]], G.gordura);
  } else {
    V([G.protLeve[1], G.protLeve[3], G.protLeve[0]], leve); V([G.carbCafe[2], G.carbCafe[0], G.carbCafe[3]], G.carbCafe); F(G.fruta); V([G.gordura[2], G.gordura[3], G.gordura[4]], G.gordura);
  }
  return { itens, res: resolver3(itens, alvo) };
}
function gerarCardapio(m) {
  m = m || metaDia(dataSel); if (!m) return null;
  const refs = refAtivas(); const soma = refs.reduce((s, k) => s + PARTE_REF[k], 0);
  const plano = {}, alvos = {}, modelos = {};
  /* A TBCA calcula as kcal de cada alimento com fatores próprios, que dão ~3% a mais que 4/4/9.
     Para fechar as CALORIAS, mantemos a proteína e encolhemos carbo e gordura na proporção certa. */
  const alvoDia = { p: m.prot, c: m.carb, g: m.gord };
  refs.forEach(k => { const f = PARTE_REF[k] / soma; alvos[k] = { p: alvoDia.p * f, c: alvoDia.c * f, g: alvoDia.g * f }; plano[k] = montarRefeicao(k, alvos[k]); modelos[k] = plano[k].itens; plano[k] = plano[k].res; });
  for (let volta = 0; volta < 6; volta++) {
    const tot = somar([].concat(...refs.map(k => plano[k])));
    const atw = tot.p * 4 + tot.c * 4 + tot.g * 9; const razao = atw > 0 ? tot.kcal / atw : 1;
    const resto = m.kcal / razao - alvoDia.p * 4; const base = m.carb * 4 + m.gord * 9;
    const fat = base > 0 ? clamp(resto / base, 0.8, 1.05) : 1;
    alvoDia.c = m.carb * fat; alvoDia.g = m.gord * fat;
    /* keto/no carb: o carbo é um TETO; o que os alimentos não trazem de carbo vira gordura, para fechar as calorias */
    if ((m.estilo === 'keto' || m.estilo === 'nocarb') && tot.c < alvoDia.c) { alvoDia.g += (alvoDia.c - tot.c) * 4 / 9; alvoDia.c = tot.c; }
    const falta = { p: alvoDia.p - tot.p, c: alvoDia.c - tot.c, g: alvoDia.g - tot.g };
    if (Math.abs(falta.p) < 4 && Math.abs(falta.c) < 6 && Math.abs(falta.g) < 3 && Math.abs(tot.kcal - m.kcal) < 40) break;
    refs.forEach(k => {
      const f = PARTE_REF[k] / soma;
      alvos[k] = { p: Math.max(0, alvos[k].p + falta.p * f), c: Math.max(0, alvos[k].c + falta.c * f), g: Math.max(0, alvos[k].g + falta.g * f) };
      plano[k] = resolver3(modelos[k], alvos[k]);
    });
  }
  return plano;
}
function folhaCardapio() {
  const m = metaDia(dataSel); if (!m) { toast('Configure o perfil primeiro (aba Eu).'); return; }
  let plano = gerarCardapio(m);
  const listaPrefs = () => { const l = [], vistos = new Set(), G = listasGer(); LISTAS_ESTILO[estiloAtual()].forEach(nm => G[nm].forEach(x => { if (!vistos.has(x[0])) { vistos.add(x[0]); l.push(x); } })); return l; };
  const fl = abrirFolha('<h2>Cardápio pelos macros</h2><p class="mini" style="margin:4px 0 10px">Montado com alimentos comuns da TBCA' + (m.estilo !== 'padrao' ? ' no estilo <b>' + ESTILOS[m.estilo].nome.toLowerCase() + '</b>' : '') + ' e quantidades calculadas para bater sua meta' + (m.plantao ? ' <b>de dia de plantão</b>' : '') + '. Gere outro até gostar; depois ajuste as gramas na dieta.</p>' +
    '<div class="chips" style="margin-bottom:6px"><button class="chip" id="cardEcon">💰 Econômico</button></div><p class="mini" id="cardEconT" style="margin:0 0 10px"></p>' +
    '<details style="margin-bottom:10px"><summary>Preferências · <span id="cardEvN"></span></summary><p class="mini" style="margin:6px 0">Toque para <b>evitar</b> um alimento. Seus ★ favoritos aparecem com mais frequência.</p><div class="chips" id="cardEv"></div></details>' +
    '<div id="cardBody"></div><div class="grade2" style="margin-top:12px"><button class="btn" id="cardOutro">Gerar outro</button><button class="btn pri" id="cardUsar">Usar neste dia</button></div>' +
    '<button class="btn bloco" style="margin-top:8px" id="cardSemana">Usar nos próximos 7 dias (um cardápio diferente por dia)</button>', el => {
    const prefs = () => {
      const ev = S.cfg.evitar || [];
      $('#cardEv', el).innerHTML = listaPrefs().map(x => '<button class="chip' + (ev.includes(x[0]) ? ' riscado' : '') + '" data-ev="' + x[0] + '">' + (S.favs.includes(x[0]) ? '★ ' : '') + esc(x[1]) + '</button>').join('');
      $('#cardEvN', el).textContent = ev.length ? ev.length + ' evitado(s)' : 'nenhum alimento evitado';
    };
    const desenhar = () => {
      const todos = []; let h = '';
      refAtivas().forEach(k => {
        const s = somar(plano[k]); todos.push(...plano[k]);
        h += '<div class="cartao" style="margin-bottom:8px"><div class="cab" style="margin-bottom:4px"><h3>' + REFEICOES[k] + '</h3><span class="mini" style="margin-left:auto">' + fmt(s.kcal) + ' kcal</span></div>' + plano[k].map(it => '<div class="mini" style="color:var(--txt)">' + fmt(it.g) + ' g · ' + esc(nomeAlim(it.f)) + medidaTexto(it.f, it.g) + '</div>').join('') + '</div>';
      });
      const t = somar(todos);
      h = '<div class="grade4" style="margin-bottom:10px">' + [['kcal', t.kcal, m.kcal], ['Prot', t.p, m.prot], ['Carb', t.c, m.carb], ['Gord', t.g, m.gord]].map(x => '<div class="cartao" style="padding:8px;margin:0;text-align:center"><div class="num" style="font-size:19px">' + fmt(x[1]) + '</div><div class="mini">' + x[0] + ' · meta ' + fmt(x[2]) + '</div></div>').join('') + '</div>' + h;
      $('#cardBody', el).innerHTML = h;
    };
    const econ = () => { $('#cardEcon', el).classList.toggle('on', economico()); $('#cardEconT', el).textContent = economico() ? 'Ligado: troca os itens caros por frango, ovo, fígado, músculo, arroz, feijão, batata, banana e óleo de soja, sem sair da meta.' : 'Achou caro? Ligue para o cardápio usar alimentos baratos.'; };
    prefs(); desenhar(); econ();
    $('#cardEcon', el).onclick = () => { S.cfg.economico = !economico(); salvar(); econ(); plano = gerarCardapio(m); prefs(); desenhar(); };
    $('#cardEv', el).onclick = e => {
      const b = e.target.closest('[data-ev]'); if (!b) return; const id = b.dataset.ev; const ev = S.cfg.evitar || (S.cfg.evitar = []);
      const i = ev.indexOf(id); if (i >= 0) ev.splice(i, 1); else ev.push(id); salvar(); prefs(); plano = gerarCardapio(m); desenhar();
    };
    $('#cardOutro', el).onclick = () => { plano = gerarCardapio(m); desenhar(); };
    $('#cardUsar', el).onclick = async () => {
      const d = dia(dataSel, true);
      const tem = Object.keys(d.ref).some(k => d.ref[k].length);
      if (tem && !(await confirmar('Este dia já tem refeições registradas. Substituir pelo cardápio?', 'Substituir'))) return;
      d.ref = JSON.parse(JSON.stringify(plano)); salvar(); fecharFolha(fl); render(); toast('Cardápio aplicado. Toque num item para ajustar.');
    };
    /* a semana: o primeiro dia usa o cardápio da tela; os outros ganham um novo cada (respeitando plantão/folga) */
    $('#cardSemana', el).onclick = async () => {
      const dias = []; for (let i = 0; i < 7; i++) dias.push(addDias(dataSel, i));
      const ocupados = dias.filter(x => { const dd = dia(x); return dd && Object.keys(dd.ref).some(k => dd.ref[k].length); });
      if (ocupados.length === 7) { toast('Os 7 dias já têm refeições. Limpe algum dia antes.'); return; }
      if (ocupados.length && !(await confirmar(ocupados.length + ' dos 7 dias já têm refeições e ficam como estão. Preencher os outros ' + (7 - ocupados.length) + '?', 'Preencher'))) return;
      let n = 0;
      dias.forEach(x => {
        if (ocupados.includes(x)) return;
        const p = x === dataSel ? plano : gerarCardapio(metaDia(x)); if (!p) return;
        dia(x, true).ref = JSON.parse(JSON.stringify(p)); n++;
      });
      salvar(); fecharFolha(fl); render(); toast(n + ' dias preenchidos. A lista de compras está em Dieta.');
    };
  });
}

/* ===================== TREINO: divisões ===================== */
const GRUPOS = { peito: 'Peito', costas: 'Costas', ombros: 'Ombros', trapezio: 'Trapézio', biceps: 'Bíceps', triceps: 'Tríceps', quadriceps: 'Quadríceps', posterior: 'Posterior de coxa', gluteos: 'Glúteos', adutores: 'Adutores', panturrilha: 'Panturrilha', abdomen: 'Abdômen', lombar: 'Lombar', antebraco: 'Antebraço', mobilidade: 'Mobilidade', pescoco: 'Pescoço' };
const D = {
  FB_A: ['Full body A', [['quadriceps', 1], ['peito', 1], ['costas', 1], ['posterior', 1], ['ombros', 1], ['biceps', 1], ['abdomen', 1]]],
  FB_B: ['Full body B', [['posterior', 1], ['costas', 1], ['peito', 1], ['quadriceps', 1], ['ombros', 1], ['triceps', 1], ['abdomen', 1]]],
  FB_C: ['Full body C', [['quadriceps', 1], ['peito', 1], ['costas', 1], ['gluteos', 1], ['ombros', 1], ['biceps', 1], ['triceps', 1], ['panturrilha', 1]]],
  PUSH: ['Peito, ombros e tríceps', [['peito', 3], ['ombros', 2], ['triceps', 2]]],
  PULL: ['Costas, bíceps e trapézio', [['costas', 4], ['trapezio', 1], ['biceps', 2], ['abdomen', 1]]],
  LEGS: ['Pernas completas', [['quadriceps', 3], ['posterior', 2], ['gluteos', 1], ['panturrilha', 1], ['abdomen', 1]]],
  LEGS_Q: ['Pernas · foco quadríceps', [['quadriceps', 4], ['posterior', 1], ['panturrilha', 2], ['abdomen', 1]]],
  LEGS_P: ['Pernas · foco posterior e glúteo', [['posterior', 3], ['gluteos', 2], ['adutores', 1], ['quadriceps', 1], ['panturrilha', 1]]],
  SUP: ['Superior', [['peito', 2], ['costas', 2], ['ombros', 1], ['biceps', 1], ['triceps', 1]]],
  INF: ['Inferior', [['quadriceps', 2], ['posterior', 2], ['gluteos', 1], ['panturrilha', 1], ['abdomen', 1]]],
  PEITO_TRI: ['Peito e tríceps', [['peito', 4], ['triceps', 3]]],
  COSTAS_BI: ['Costas e bíceps', [['costas', 4], ['biceps', 3], ['antebraco', 1]]],
  OMBRO_ABD: ['Ombros e abdômen', [['ombros', 4], ['trapezio', 1], ['abdomen', 3]]],
  PEITO: ['Peito', [['peito', 5], ['abdomen', 2]]],
  COSTAS: ['Costas', [['costas', 5], ['lombar', 1], ['trapezio', 1]]],
  OMBROS: ['Ombros', [['ombros', 5], ['trapezio', 1], ['abdomen', 1]]],
  BRACOS: ['Braços', [['biceps', 3], ['triceps', 3], ['antebraco', 1]]],
  GLU_QUAD: ['Glúteos e quadríceps', [['gluteos', 2], ['quadriceps', 3], ['posterior', 1], ['panturrilha', 1], ['abdomen', 1]]],
  GLU_POST: ['Glúteos e posterior', [['gluteos', 3], ['posterior', 2], ['adutores', 1], ['panturrilha', 1], ['abdomen', 1]]],
  SUP_LEVE: ['Superior', [['costas', 2], ['ombros', 2], ['peito', 1], ['biceps', 1], ['triceps', 1], ['abdomen', 1]]],
  SUP_GLU: ['Superior + glúteos', [['costas', 2], ['ombros', 2], ['peito', 1], ['triceps', 1], ['gluteos', 2]]],
  FB_GA: ['Full body · glúteos e quadríceps', [['gluteos', 2], ['quadriceps', 1], ['posterior', 1], ['costas', 1], ['ombros', 1], ['peito', 1], ['abdomen', 1]]],
  INF_LEVE: ['Glúteos e pernas (leve)', [['gluteos', 2], ['quadriceps', 1], ['posterior', 1], ['panturrilha', 1], ['abdomen', 1]]],
  FB_GB: ['Full body · glúteos e posterior', [['gluteos', 2], ['posterior', 2], ['quadriceps', 1], ['costas', 1], ['ombros', 1], ['triceps', 1], ['panturrilha', 1]]],
  ATIVO: ['Cardio, core e mobilidade', [['abdomen', 3], ['lombar', 1], ['mobilidade', 4]], true],
  MOB: ['Mobilidade + cardio leve', [['mobilidade', 6]], true]
};
const DIVISOES = {
  FB: { nome: 'Full body (corpo todo)', seq: ['FB_A', 'FB_B', 'FB_C'], desc: 'Todos os grupos em cada treino. Ótimo para 3x ou dia sim, dia não, e para quem está começando.' },
  ABC: { nome: 'ABC · empurrar, puxar, pernas', seq: ['PUSH', 'PULL', 'LEGS'], desc: 'Cada grupo 1x a cada 3 treinos. Clássico de academia.' },
  AB: { nome: 'AB · superior e inferior', seq: ['SUP', 'INF'], desc: 'Cada grupo 2x por semana com 4 treinos.' },
  ABCD: { nome: 'ABCD', seq: ['PEITO_TRI', 'COSTAS_BI', 'LEGS', 'OMBRO_ABD'], desc: 'Peito/tríceps, costas/bíceps, pernas, ombros/abdômen.' },
  ABCDE: { nome: 'ABCDE · um grupo por dia', seq: ['PEITO', 'COSTAS', 'LEGS', 'OMBROS', 'BRACOS'], desc: 'Volume alto por grupo, cada um 1x por semana.' },
  PPLUL: { nome: 'Empurrar · Puxar · Pernas + Superior · Inferior', seq: ['PUSH', 'PULL', 'LEGS', 'SUP', 'INF'], desc: 'Cada grupo ~2x por semana em 5 treinos.' },
  PPL2: { nome: 'Empurrar · Puxar · Pernas ×2', seq: ['PUSH', 'PULL', 'LEGS_Q', 'PUSH', 'PULL', 'LEGS_P'], desc: 'Cada grupo 2x por semana, exercícios diferentes na 2ª passagem.' },
  ABC2: { nome: 'ABC ×2 (ABCABC)', seq: ['PEITO_TRI', 'COSTAS_BI', 'LEGS', 'PEITO_TRI', 'COSTAS_BI', 'LEGS'], desc: 'Repete o ABC com variação de exercícios.' },
  PPL2G: { nome: 'Empurrar · Puxar · Pernas ×2 + dia ativo', seq: ['PUSH', 'PULL', 'LEGS_Q', 'PUSH', 'PULL', 'LEGS_P', 'ATIVO'], desc: '6 treinos de força e 1 dia leve de cardio, core e mobilidade.' },
  GFFB: { nome: 'Full body com ênfase em pernas', seq: ['FB_GA', 'FB_GB', 'FB_GA'], enf: 'inf', desc: 'Corpo todo em cada treino, mas com glúteos em todos e mais pernas que braços.' },
  GF3: { nome: 'Inferior · Superior · Inferior', seq: ['GLU_QUAD', 'SUP_GLU', 'GLU_POST'], enf: 'inf', desc: 'Pernas 2x e glúteos 3x por semana; parte de cima 1x.' },
  GF4: { nome: 'Pernas 2x + Superior 2x (glúteo 3x)', seq: ['GLU_QUAD', 'SUP_LEVE', 'GLU_POST', 'SUP_GLU'], enf: 'inf', desc: 'Dois dias de pernas (um de quadríceps, um de posterior), dois de cima, e glúteo em três deles.' },
  GF5: { nome: 'Pernas 3x + Superior 2x', seq: ['GLU_QUAD', 'SUP_LEVE', 'GLU_POST', 'SUP_LEVE', 'INF_LEVE'], enf: 'inf', desc: 'Três dias de pernas e glúteos (o 3º mais leve), dois de parte de cima.' },
  GF6: { nome: 'Pernas 3x + Superior 3x', seq: ['GLU_QUAD', 'SUP_LEVE', 'GLU_POST', 'SUP_LEVE', 'INF_LEVE', 'SUP_LEVE'], enf: 'inf', desc: 'Alterna pernas e parte de cima; glúteo nos 3 dias de perna.' },
  GF7: { nome: 'Pernas 3x + Superior 3x + dia ativo', seq: ['GLU_QUAD', 'SUP_LEVE', 'GLU_POST', 'SUP_LEVE', 'INF_LEVE', 'SUP_LEVE', 'ATIVO'], enf: 'inf', desc: 'Igual ao de 6x, mais um dia leve de cardio, core e mobilidade.' },
  ABCDE2: { nome: 'ABCDE + 2 dias ativos', seq: ['PEITO', 'COSTAS', 'LEGS', 'OMBROS', 'BRACOS', 'ATIVO', 'MOB'], desc: '5 treinos de força e 2 dias de recuperação ativa.' }
};
const FREQS = {
  '3x': { nome: '3x por semana', dias: [1, 3, 5], div: ['FB', 'ABC', 'GF3', 'GFFB'] },
  alt: { nome: 'Dia sim, dia não', alt: true, div: ['ABC', 'FB', 'AB', 'GF3', 'GFFB'] },
  '4x': { nome: '4x por semana', dias: [1, 2, 4, 5], div: ['AB', 'ABCD', 'GF4'] },
  '5x': { nome: '5x por semana', dias: [1, 2, 3, 4, 5], div: ['PPLUL', 'ABCDE', 'GF5'] },
  '6x': { nome: '6x por semana', dias: [1, 2, 3, 4, 5, 6], div: ['PPL2', 'ABC2', 'GF6'] },
  '7x': { nome: 'Todos os dias (7x)', dias: [0, 1, 2, 3, 4, 5, 6], div: ['PPL2G', 'ABCDE2', 'GF7'] }
};
/* ênfase do treino: o padrão depende do sexo do perfil (mulheres → pernas e glúteos; homens → equilibrado) */
const ENFASES = {
  inf: { nome: 'Pernas e glúteos', desc: 'Mais dias e mais séries para glúteos, posterior e quadríceps; parte de cima com volume de manutenção a moderado.' },
  eq: { nome: 'Equilibrado', desc: 'Volume parecido para todos os grupos.' },
  sup: { nome: 'Parte de cima', desc: 'Divisões com mais dias para peito, costas, ombros e braços; pernas 1–2x por semana.' }
};
const PREF_SUP = ['ABC', 'ABCD', 'ABCDE', 'ABC2', 'ABCDE2', 'AB', 'FB', 'PPLUL', 'PPL2', 'PPL2G'];
function enfasePadrao() { return S.perfil && S.perfil.sexo === 'F' ? 'inf' : 'eq'; }
function divsPara(freq, enf) {
  const l = FREQS[freq].div;
  if (enf === 'inf') return l.filter(k => DIVISOES[k].enf === 'inf');
  const r = l.filter(k => DIVISOES[k].enf !== 'inf');
  return enf === 'sup' ? r.slice().sort((a, b) => PREF_SUP.indexOf(a) - PREF_SUP.indexOf(b)) : r;
};
const OBJ_TREINO = {
  hip: { nome: 'Hipertrofia', comp: [4, '8–10', 90], iso: [3, '10–12', 60], met: 5.0 },
  forca: { nome: 'Força', comp: [5, '4–6', 150], iso: [3, '8–10', 90], met: 6.0 },
  emag: { nome: 'Emagrecimento / condicionamento', comp: [3, '10–12', 60], iso: [3, '12–15', 45], met: 5.0 },
  resist: { nome: 'Resistência muscular', comp: [3, '15–20', 45], iso: [2, '15–20', 30], met: 3.5 }
};
const EQUIP_TREINO = ['Barra', 'Barra W', 'Halteres', 'Máquina', 'Cabo/polia', 'Kettlebell', 'Elástico', 'Peso corporal', 'Bola suíça', 'Outros', 'Nenhum'];
const PRESETS_EQUIP = {
  completa: ['Barra', 'Barra W', 'Halteres', 'Máquina', 'Cabo/polia', 'Kettlebell', 'Elástico', 'Peso corporal', 'Bola suíça', 'Outros', 'Nenhum'],
  basica: ['Barra', 'Halteres', 'Peso corporal', 'Nenhum', 'Elástico'],
  casa: ['Halteres', 'Elástico', 'Peso corporal', 'Nenhum', 'Kettlebell']
};
function prescrever(e, obj) {
  const o = OBJ_TREINO[obj] || OBJ_TREINO.hip;
  if (e.grupo === 'mobilidade' || e.tipo === 'Alongamento/Mobilidade') return { s: 1, r: '30–45 s', d: 15 };
  if (e.grupo === 'abdomen') return /Plank|Bridge|Pallof|Dead Bug/.test(e.en) ? { s: 3, r: '30–45 s', d: 45 } : { s: 3, r: '12–20', d: 45 };
  if (e.grupo === 'panturrilha') return { s: 4, r: '10–15', d: 45 };
  const x = e.mec === 'Multiarticular' ? o.comp : o.iso;
  /* mulheres costumam se recuperar mais rápido entre séries: descanso ~20% menor (mín. 30 s) */
  return { s: x[0], r: x[1], d: descansoAjustado(x[2]) };
}
function descansoAjustado(d) { return S.perfil && S.perfil.sexo === 'F' ? Math.max(30, Math.round(d * 0.8 / 15) * 15) : d; }
function poolGrupo(g, equip) {
  const ok = e => e && (equip.includes(e.equip));
  let l = (EX_CUR[g] || []).map(id => EXS.get(id)).filter(ok);
  if (l.length < 3) {
    const extra = []; EXS.forEach(e => { if (e.grupo === g && ok(e) && (e.tipo === 'Musculação' || (g === 'mobilidade' && e.tipo === 'Alongamento/Mobilidade')) && !l.includes(e)) extra.push(e); });
    l = l.concat(extra.slice(0, 10));
  }
  if (!l.length) l = (EX_CUR[g] || []).map(id => EXS.get(id)).filter(Boolean);
  return l;
}
function gerarPlano(cfg) {
  const div = DIVISOES[cfg.div]; const uso = {};
  const seq = div.seq.map(k => {
    const [nome, blocos, leve] = D[k]; const usados = new Set(); const ex = [];
    blocos.forEach(([g, n]) => {
      const pool = poolGrupo(g, cfg.equip); if (!pool.length) return;
      let off = uso[g] || 0, tent = 0, add = 0;
      while (add < n && tent < pool.length * 2) {
        const e = pool[(off + tent) % pool.length]; tent++;
        if (usados.has(e.id)) continue;
        usados.add(e.id); ex.push(Object.assign({ id: e.id }, prescrever(e, cfg.obj))); add++;
      }
      uso[g] = (off + tent) % Math.max(1, pool.length);
    });
    return { n: nome, k, leve: !!leve, ex };
  });
  return seq;
}
/* ---- grupos em foco: mais volume, mais frequência e treinados primeiro no dia ---- */
const FOCO_GRUPOS = ['gluteos', 'quadriceps', 'posterior', 'peito', 'costas', 'ombros', 'biceps', 'triceps', 'panturrilha', 'abdomen', 'trapezio', 'antebraco'];
function grupoEx(p) { const e = EXS.get(p.id); return e ? e.grupo : null; }
function aplicarFoco(T) {
  T.seq.forEach(d => { d.ex = d.ex.filter(p => !p.focoAdd); });
  const foco = (T.foco || []).filter(g => GRUPOS[g]); if (!foco.length) return;
  const dias = T.seq.map((_, i) => i).filter(i => !T.seq[i].leve); if (!dias.length) return;
  const n = T.seq.length;
  foco.forEach(g => {
    const pool = poolGrupo(g, T.equip); if (!pool.length) return;
    const alvo = dias.filter(i => T.seq[i].ex.some(p => grupoEx(p) === g));
    /* frequência: pelo menos 2 treinos da sequência tocam o grupo, o mais espaçados possível */
    const dist = i => alvo.length ? Math.min(...alvo.map(a => Math.min(Math.abs(a - i), n - Math.abs(a - i)))) : 0;
    while (alvo.length < 2) { const resto = dias.filter(i => !alvo.includes(i)); if (!resto.length) break; resto.sort((a, b) => dist(b) - dist(a)); alvo.push(resto[0]); }
    const uso = id => T.seq.reduce((s, d) => s + d.ex.filter(p => p.id === id).length, 0);
    alvo.forEach(i => {
      const d = T.seq[i]; const ja = new Set(d.ex.map(p => p.id));
      const e = pool.filter(x => !ja.has(x.id)).sort((a, b) => uso(a.id) - uso(b.id))[0]; if (!e) return;
      d.ex.push(Object.assign({ id: e.id }, prescrever(e, T.obj), { focoAdd: true }));
    });
  });
  /* prioridade: grupos em foco abrem o treino, quando você está descansado */
  T.seq.forEach(d => { if (d.leve) return; const f = d.ex.filter(p => foco.includes(grupoEx(p))); if (f.length) d.ex = f.concat(d.ex.filter(p => !foco.includes(grupoEx(p)))); });
}
function ehFoco(p) { return !!(S.treino && S.treino.foco && S.treino.foco.includes(grupoEx(p))); }
function nomesFoco(l) { return (l || []).map(g => GRUPOS[g]).join(' e '); }
function chipsFoco(sel, acao) {
  return '<div class="chips">' + FOCO_GRUPOS.map(g => '<button class="chip ' + (sel.includes(g) ? 'on' : '') + '" ' + (acao ? 'data-acao="' + acao + '" ' : '') + 'data-v="' + g + '">' + (sel.includes(g) ? '★ ' : '') + GRUPOS[g] + '</button>').join('') + '</div>';
}
function alternarFoco(l, g) {
  if (l.includes(g)) return l.filter(x => x !== g);
  if (l.length >= 2) { toast('Até 2 grupos em foco: mais que isso dilui o efeito.'); return l; }
  return l.concat(g);
}
function folhaFoco() {
  const T = S.treino; let sel = (T.foco || []).slice();
  const fl = abrirFolha('<h2>Grupo em foco</h2><p class="mini" style="margin:4px 0 10px">Escolha até 2. O app adiciona 1 exercício do grupo em pelo menos 2 treinos da semana e coloca esses exercícios no começo do treino. O resto do seu plano (e suas trocas manuais) continua igual.</p><div id="fcC"></div><div class="mini" id="fcT" style="margin-top:8px"></div><div class="grade2" style="margin-top:14px"><button class="btn" id="fcX">Cancelar</button><button class="btn pri" id="fcO">Aplicar</button></div>', el => {
    const pintar = () => { $('#fcC', el).innerHTML = chipsFoco(sel); $('#fcT', el).textContent = sel.length ? 'Foco: ' + nomesFoco(sel) + '.' : 'Sem foco: volume equilibrado entre os grupos.'; };
    pintar();
    $('#fcC', el).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; sel = alternarFoco(sel, b.dataset.v); pintar(); };
    $('#fcX', el).onclick = () => fecharFolha(fl);
    $('#fcO', el).onclick = () => { T.foco = sel; aplicarFoco(T); salvar(); fecharFolha(fl); render(); toast(sel.length ? 'Plano ajustado: foco em ' + nomesFoco(sel) + '.' : 'Foco removido.'); };
  });
}
function letra(i) { return String.fromCharCode(65 + i); }

/* qual treino cai numa data */
function treinoDoDia(iso) {
  const T = S.treino; if (!T || !T.seq.length) return null;
  const d = dia(iso);
  if (d && d.treino && d.treino.idx != null) return { idx: d.treino.idx, manual: !!d.treino.manual };
  const r = treinoDoDia0(iso);
  if (r && !r.descanso && T.evitarPlantao && ehPlantao(iso)) return { descanso: true, plantao: true, idx: r.idx };
  return r;
}
function treinoDoDia0(iso) {
  const T = S.treino; const d = dia(iso);
  const n = T.seq.length;
  if (T.modo === 'sequencia') {
    let ult = null;
    for (let i = 1; i <= 60; i++) { const dd = dia(addDias(iso, -i)); if (dd && dd.treino && dd.treino.fim) { ult = dd.treino.idx; break; } }
    const proximo = ult == null ? 0 : (ult + 1) % n;
    if (T.freq === 'alt') { const ontem = dia(addDias(iso, -1)); if (ontem && ontem.treino && ontem.treino.fim) return { descanso: true, idx: proximo }; }
    else if (!T.dias.includes(diaSemana(iso))) return { descanso: true, idx: proximo };
    return { idx: proximo };
  }
  const diff = diffDias(T.inicio, iso);
  if (T.freq === 'alt') {
    if (((diff % 2) + 2) % 2 !== 0) return { descanso: true, idx: (((Math.floor(diff / 2) + 1) % n) + n) % n };
    return { idx: (((diff / 2) % n) + n) % n };
  }
  if (!T.dias.includes(diaSemana(iso))) return { descanso: true };
  let cont = 0;
  if (diff >= 0) { for (let i = 0; i < diff; i++) if (T.dias.includes(diaSemana(addDias(T.inicio, i)))) cont++; }
  else { for (let i = diff; i < 0; i++) if (T.dias.includes(diaSemana(addDias(T.inicio, i)))) cont--; }
  return { idx: ((cont % n) + n) % n };
}
/* o cardio respeita "vezes por semana": dentre os dias candidatos da semana (seg–dom), escolhe N bem espalhados */
function cardioCandidato(iso, C) {
  const td = treinoDoDia(iso); const treina = td && !td.descanso;
  if (treina && S.treino && S.treino.seq[td.idx] && S.treino.seq[td.idx].leve) return 2; /* dia "ativo" do plano: sempre */
  if (C.quando === 'apos') return treina ? 1 : 0;
  if (C.quando === 'folga') return (!S.treino || (td && td.descanso)) ? 1 : 0;
  return 1; /* qualquer dia */
}
function cardioDoDia(iso) {
  const C = S.cardio; if (!C) return null;
  const seg = addDias(iso, -((diaSemana(iso) + 6) % 7));
  const semana = []; for (let i = 0; i < 7; i++) semana.push(addDias(seg, i));
  const cand = semana.map(x => [x, cardioCandidato(x, C)]).filter(x => x[1]);
  const fixos = cand.filter(x => x[1] === 2).map(x => x[0]);
  const livres = cand.filter(x => x[1] === 1).map(x => x[0]);
  const vagas = Math.max(0, (C.vezes || 3) - fixos.length);
  let escolhidos = fixos.slice();
  if (livres.length <= vagas) escolhidos = escolhidos.concat(livres);
  else for (let i = 0; i < vagas; i++) escolhidos.push(livres[Math.floor((i + 0.5) * livres.length / vagas)]);
  return escolhidos.includes(iso) ? C : null;
}
/* exercícios de um dia: o que foi congelado ao concluir (histórico fiel) ou o plano atual + extras + séries antigas */
function treinoDia(idx, reg) {
  const T = (S.treino && S.treino.seq[idx]) || { n: 'Treino', ex: [] };
  const base = (reg && reg.ex) ? reg.ex.map(p => Object.assign({}, p)) : T.ex.map(p => Object.assign({}, p));
  const tem = id => base.some(p => p.id === id);
  ((reg && reg.extra) || []).forEach(id => { if (!tem(id)) base.push({ id, s: 3, r: '10–12', d: 60, extra: true }); });
  if (reg && reg.s) Object.keys(reg.s).forEach(id => { if (!tem(id) && EXS.has(id) && reg.s[id].some(x => x.kg != null || x.r != null)) base.push({ id, s: reg.s[id].length, r: '10–12', d: 60, antigo: true }); });
  return { n: (reg && reg.n) || T.n, ex: base };
}
function duracaoEstimada(exs) {
  let seg = 0; exs.forEach(p => { const tempo = /s/.test(String(p.r)) ? 40 : 45; seg += p.s * (tempo + (p.d || 60)); });
  return Math.max(10, Math.round(seg / 60 / 5) * 5);
}
/* progressão dupla: bateu o topo da faixa em todas as séries → sobe a carga; abaixo do mínimo → mantém */
function progressao(p, e, ult) {
  if (!ult || !e) return null;
  const txt = String(p.r); if (/s\b|seg/.test(txt)) return null;
  const mm = txt.match(/(\d+)\s*[–-]\s*(\d+)/); const um = txt.match(/\d+/);
  const lo = mm ? Number(mm[1]) : (um ? Number(um[0]) : null), hi = mm ? Number(mm[2]) : lo; if (!lo) return null;
  const ss = ult.ss.filter(x => x.r != null); if (!ss.length) return null;
  const kgs = ss.map(x => x.kg).filter(x => x != null); const kg = kgs.length ? Math.max(...kgs) : null;
  const todasTopo = ss.length >= p.s && ss.every(x => x.r >= hi);
  const inc = e.equip === 'Halteres' ? 2 : (e.mec === 'Multiarticular' ? 2.5 : 2);
  if (todasTopo) return kg != null ? { tipo: 'subir', kg: r1(kg + inc), txt: '↑ Bateu ' + hi + ' reps em todas: suba para ' + fmt(kg + inc, 1) + ' kg' } : { tipo: 'subir', kg: null, txt: '↑ Bateu o topo: deixe mais difícil (carga extra ou variação)' };
  if (ss.some(x => x.r < lo)) return { tipo: 'manter', kg, txt: '= Mantenha ' + (kg != null ? fmt(kg, 1) + ' kg' : 'a carga') + ' até fazer ' + lo + '+ em todas' };
  return { tipo: 'reps', kg, txt: '→ Mesma carga, busque +1 rep até ' + hi };
}

/* ===================== TELA TREINO ===================== */
function telaTreino() {
  /* 1.6: a evolução das cargas foi para Progresso → Cargas */
  const sub = [['hoje', 'Treino do dia'], ['plano', 'Meu plano'], ['cardio', 'Cardio']];
  let h = '<div class="rolax" style="margin-bottom:12px">' + sub.map(([k, t]) => '<button class="chip ' + (subTreino === k ? 'on' : '') + '" data-acao="subTreino" data-v="' + k + '">' + t + '</button>').join('') + '</div>';
  if (subTreino === 'plano') return h + telaPlano();
  if (subTreino === 'cardio') return h + telaCardio();
  return h + telaTreinoDia();
}
/* valores sugeridos de uma série: os da última vez, ou a carga nova quando a progressão manda subir */
function sugestaoSerie(p, ult, pr, s) {
  const sug = ult && ult.ss[s] ? ult.ss[s] : (ult ? ult.ss[ult.ss.length - 1] : null);
  const base = String(p.r).split('–')[0].replace(/\D.*$/, '');
  const kg = pr && pr.tipo === 'subir' && pr.kg != null ? pr.kg : (sug && sug.kg != null ? sug.kg : '');
  const r = pr && pr.tipo === 'subir' ? base : (sug && sug.r != null ? sug.r : base);
  return { kg, r };
}
function ultimaSerie(exId, antesDe) {
  for (let i = 1; i <= 180; i++) {
    const iso = addDias(antesDe, -i); const d = S.dias[iso];
    if (d && d.treino && d.treino.s && d.treino.s[exId]) { const ss = d.treino.s[exId].filter(x => x.kg != null || x.r != null); if (ss.length) return { iso, ss }; }
  }
  return null;
}
let abertosEx = new Set(); /* exercícios concluídos que o usuário reabriu na tela */
function telaTreinoDia() {
  if (!S.treino) return '<div class="cartao realce"><h2>Monte seu treino</h2><p class="sub">Duas perguntas: quantas vezes por semana e onde você treina. O app monta os exercícios, séries e repetições.</p><button class="btn pri bloco" data-acao="subTreino" data-v="plano">Montar treino</button></div>';
  const td = treinoDoDia(dataSel); const d = dia(dataSel);
  let h = '';
  const outros = '<button class="btn peq" data-acao="escolherTreino">Trocar treino do dia</button>';
  if (td.descanso && !(d && d.treino)) {
    h += '<div class="cartao"><div class="cab"><h2>' + (td.plantao ? 'Plantão · sem treino' : 'Dia de descanso') + '</h2></div><p class="sub">' + (td.plantao ? 'Seu plano está configurado para não treinar em dia de plantão.' : 'Pelo seu plano, hoje é descanso.') + ' Se quiser treinar mesmo assim, escolha qual.</p>' + outros + '</div>';
    h += blocoCardioDia(td);
    return h;
  }
  const idx = td.idx; const reg = d && d.treino; const T = treinoDia(idx, reg); const exs = T.ex;
  const feitasEx = p => ((reg && reg.s && reg.s[p.id]) || []).filter(x => x.ok).length;
  const nFeitos = exs.filter(p => feitasEx(p) >= p.s).length;
  const temHistorico = !(reg && reg.fim) && exs.some(p => ultimaSerie(p.id, dataSel));
  h += '<div class="cartao realce"><div class="cab"><h2>' + letra(idx) + ' — ' + esc(T.n) + '</h2></div><div class="sub" style="margin-bottom:10px">' + exs.length + ' exercícios · ~' + duracaoEstimada(exs) + ' min · ' + OBJ_TREINO[S.treino.obj].nome + (reg && reg.fim ? ' · <b style="color:var(--ok)">concluído (' + hm((reg.fim - reg.ini) / 60000) + ', ~' + fmt(reg.kcal) + ' kcal)</b>' : (reg && reg.ini ? ' · ' + nFeitos + '/' + exs.length + ' feitos' : '')) + '</div><div class="chips">' +
    (reg && reg.ini && !reg.fim ? '<button class="btn pri" data-acao="concluirTreino">Concluir treino</button>' : (reg && reg.fim ? '<button class="btn" data-acao="reabrirTreino">Reabrir</button>' : '<button class="btn pri" data-acao="iniciarTreino">Iniciar treino</button>')) +
    (temHistorico ? '<button class="btn" data-acao="preencherCargas">Repetir cargas da última vez</button>' : '') + outros + '</div></div>';
  h += '<div class="cartao">';
  exs.forEach(p => {
    const e = EXS.get(p.id); if (!e) return;
    const feitas = (reg && reg.s && reg.s[p.id]) || [];
    const ult = ultimaSerie(p.id, dataSel);
    const pr = (reg && reg.fim) ? null : progressao(p, e, ult);
    const completo = feitasEx(p) >= p.s;
    if (completo && !abertosEx.has(p.id)) {
      h += '<div class="ex feito" data-acao="togEx" data-id="' + esc(p.id) + '"><div class="fig" style="background-image:url(' + imgEx(e) + ')"></div><div class="corpo"><div class="nome"><span style="color:var(--ok)">✓</span> ' + esc(e.nome) + '</div><div class="mini">' + feitas.filter(x => x.ok).map(x => (x.kg != null ? fmt(x.kg, 1) + 'kg' : '') + '×' + (x.r != null ? x.r : '–')).join(' · ') + ' · toque para abrir</div></div></div>';
      return;
    }
    h += '<div class="ex"><div class="fig" style="background-image:url(' + imgEx(e) + ')" data-acao="verEx" data-id="' + esc(e.id) + '"></div><div class="corpo"><div class="nome">' + esc(e.nome) + (p.antigo ? ' <span class="tag">registrado</span>' : '') + (ehFoco(p) ? ' <span class="tag foco">★ foco</span>' : '') + '</div><div class="mini">' + p.s + ' × ' + esc(p.r) + ' · descanso ' + p.d + ' s · ' + esc(e.equip) + '</div>' +
      (ult ? '<div class="mini" style="color:var(--txt2)">Última vez (' + dataCurta(ult.iso) + '): ' + ult.ss.map(x => (x.kg != null ? fmt(x.kg, 1) + 'kg' : '') + '×' + (x.r != null ? x.r : '–')).join(' · ') + '</div>' : '') +
      (pr ? '<div class="mini prog ' + pr.tipo + '">' + esc(pr.txt) + '</div>' : '') +
      '<div class="series"><span class="h">Série</span><span class="h">Carga (kg)</span><span class="h">Reps</span><span></span>';
    for (let s = 0; s < Math.max(p.s, feitas.length); s++) {
      const f = feitas[s] || {}; const sg = sugestaoSerie(p, ult, pr, s); const kgSug = sg.kg, rSug = sg.r;
      h += '<span class="n">' + (s + 1) + '</span><input type="number" inputmode="decimal" data-serie="' + esc(p.id) + '|' + s + '|kg" value="' + (f.kg != null ? f.kg : '') + '" placeholder="' + esc(kgSug) + '"><input type="number" inputmode="numeric" data-serie="' + esc(p.id) + '|' + s + '|r" value="' + (f.r != null ? f.r : '') + '" placeholder="' + esc(rSug) + '">' +
        '<button class="ok-btn ' + (f.ok ? 'on' : '') + '" data-acao="okSerie" data-id="' + esc(p.id) + '" data-s="' + s + '" data-d="' + p.d + '" data-total="' + p.s + '" aria-label="Série feita">' + IC.check + '</button>';
    }
    h += '</div><div class="chips" style="margin-top:6px"><button class="btn peq fant" data-acao="maisSerie" data-id="' + esc(p.id) + '" data-n="' + Math.max(p.s, feitas.length) + '">+ série</button>' + (p.extra ? '<button class="btn peq fant" data-acao="remExtra" data-id="' + esc(p.id) + '">remover</button>' : '') + (completo ? '<button class="btn peq fant" data-acao="togEx" data-id="' + esc(p.id) + '">recolher</button>' : '') + '</div></div></div>';
  });
  h += '<button class="btn bloco" style="margin-top:10px" data-acao="addExDia">+ Exercício só hoje</button></div>';
  h += blocoCardioDia(td);
  h += '<button class="btn bloco fant" data-acao="irProgresso" data-v="cargas">Ver a evolução das cargas ›</button>';
  return h;
}
function blocoCardioDia() {
  const d = dia(dataSel); const c = cardioDoDia(dataSel);
  let h = '<div class="cartao"><div class="cab"><h2>Cardio</h2><div class="dir"><button class="btn peq" data-acao="registrarCardio">Registrar</button></div></div>';
  if (c) { const cc = cardioCod(c.cod); h += '<div class="sub">Planejado: <b>' + esc(TIPOS_CARDIO[c.tipo].nome) + '</b> · ' + esc(cc ? cc.nome : '') + ' · ' + c.min + ' min</div>' + (TIPOS_CARDIO[c.tipo].hiit ? '<button class="btn peq" style="margin-top:8px" data-acao="cronHiit" data-tipo="' + c.tipo + '">Abrir cronômetro de intervalos</button>' : ''); }
  else h += '<div class="sub">Nada planejado para este dia.</div>';
  const feitos = (d && d.cardio) || [];
  if (feitos.length) h += '<ul class="lista" style="margin-top:8px">' + feitos.map((x, i) => { const cc = cardioCod(x.cod); return '<li><div class="txt"><div class="t">' + esc(cc ? cc.nome : x.cod) + '</div><div class="mini">' + x.min + ' min</div></div><div class="val">' + fmt(x.kcal) + ' kcal</div><button class="ic" data-acao="remCardio" data-i="' + i + '">' + IC.lixo + '</button></li>'; }).join('') + '</ul>';
  return h + '</div>';
}
function registroTreino(criar) {
  const d = dia(dataSel, criar); if (!d) return null;
  if (!d.treino && criar) { const td = treinoDoDia(dataSel); d.treino = { idx: td.idx || 0, s: {}, extra: [] }; }
  return d.treino;
}

/* --- plano --- */
let rascunho = null;
function telaPlano() {
  const T = S.treino;
  let h = '';
  if (T && !rascunho) {
    const vol = {};
    T.seq.forEach(dd => dd.ex.forEach(p => { const e = EXS.get(p.id); if (e && e.grupo !== 'mobilidade') vol[e.grupo] = (vol[e.grupo] || 0) + p.s; }));
    const fator = T.freq === 'alt' ? 3.5 / T.seq.length : T.dias.length / T.seq.length;
    h += '<div class="cartao"><div class="cab"><h2>' + esc(DIVISOES[T.div].nome) + '</h2></div><div class="sub">' + esc(FREQS[T.freq].nome) + (T.freq !== 'alt' ? ' (' + T.dias.slice().sort().map(x => DSEM[x]).join(', ') + ')' : '') + ' · ' + OBJ_TREINO[T.obj].nome + ' · ênfase: ' + ENFASES[T.enf || (DIVISOES[T.div].enf === 'inf' ? 'inf' : 'eq')].nome.toLowerCase() + ' · ' + (T.modo === 'sequencia' ? 'segue a sequência' : 'segue o calendário') + '</div>' +
      '<div class="chips" style="margin-top:10px"><button class="btn peq" data-acao="editarPlano">Alterar configuração</button><button class="btn peq" data-acao="regerarPlano">Gerar exercícios de novo</button></div></div>';
    const foco = T.foco || [];
    h += '<div class="cartao' + (foco.length ? ' foco-c' : '') + '"><div class="cab"><h3>Grupo em foco</h3><div class="dir"><button class="btn peq' + (foco.length ? '' : ' pri') + '" data-acao="editarFoco">' + (foco.length ? 'Alterar' : 'Escolher') + '</button></div></div>' +
      (foco.length ? '<div class="num" style="font-size:20px;color:var(--acento)">★ ' + esc(nomesFoco(foco)) + '</div><div class="mini" style="margin-top:4px">Mais séries, em pelo menos 2 treinos da semana e no começo do treino. Os exercícios extras têm a etiqueta <span class="tag foco">foco</span>.</div>' : '<p class="sub">Escolha até 2 grupos que você quer melhorar: o app aumenta o volume deles sem refazer o resto do plano.</p>') + '</div>';
    const ordem = Object.keys(vol).sort((a, b) => (foco.includes(b) - foco.includes(a)) || vol[b] - vol[a]);
    h += '<div class="cartao"><div class="cab"><h3>Séries por grupo na semana</h3><span class="mini" style="margin-left:auto">ideal 10–20' + (foco.length ? ' · foco 14–22' : '') + '</span></div>' + ordem.map(g => { const v = Math.round(vol[g] * fator); const f = foco.includes(g); return '<div class="macro"><div class="lin"><span>' + (f ? '<b style="color:var(--acento)">★ ' + GRUPOS[g] + '</b>' : GRUPOS[g]) + '</span><span><b>' + v + '</b> séries</span></div><div class="barra"><i style="width:' + clamp(v / (f ? 22 : 20) * 100, 0, 100) + '%;background:' + ((f ? v < 12 : v < 8) ? 'var(--alerta)' : 'var(--acento)') + '"></i></div></div>'; }).join('') +
      (foco.some(g => Math.round((vol[g] || 0) * fator) < 12) ? '<p class="mini" style="color:var(--alerta);margin-top:4px">Algum grupo em foco ficou com menos de 12 séries por semana. Adicione 1 exercício dele num dos treinos ou suba 1 série nos que já tem.</p>' : '') + '</div>';
    T.seq.forEach((dd, i) => {
      h += '<div class="cartao"><div class="cab"><h3>' + letra(i) + ' — ' + esc(dd.n) + '</h3><div class="dir"><button class="ic" data-acao="renomearDia" data-i="' + i + '">' + IC.editar + '</button></div></div>';
      dd.ex.forEach((p, j) => {
        const e = EXS.get(p.id); if (!e) return;
        h += '<div class="ex"><div class="fig" style="background-image:url(' + imgEx(e) + ')" data-acao="verEx" data-id="' + esc(e.id) + '"></div><div class="corpo"><div class="nome">' + esc(e.nome) + (p.focoAdd ? ' <span class="tag foco">foco</span>' : (ehFoco(p) ? ' <span class="foco-est">★</span>' : '')) + '</div><div class="mini">' + esc(GRUPOS[e.grupo] || e.musc1) + ' · ' + esc(e.equip) + '</div><button class="btn peq fant" style="padding-left:0" data-acao="editPresc" data-i="' + i + '" data-j="' + j + '">' + p.s + ' × ' + esc(p.r) + ' · ' + p.d + ' s ✎</button></div><div class="acoes"><button class="ic" data-acao="trocarEx" data-i="' + i + '" data-j="' + j + '" aria-label="Trocar">' + IC.troca + '</button><button class="ic" data-acao="moverEx" data-i="' + i + '" data-j="' + j + '" data-v="-1" aria-label="Subir">' + IC.cima + '</button><button class="ic" data-acao="moverEx" data-i="' + i + '" data-j="' + j + '" data-v="1" aria-label="Descer">' + IC.baixo + '</button><button class="ic" data-acao="remEx" data-i="' + i + '" data-j="' + j + '" aria-label="Remover">' + IC.lixo + '</button></div></div>';
      });
      h += '<button class="btn bloco" style="margin-top:8px" data-acao="addEx" data-i="' + i + '">+ Adicionar exercício</button></div>';
    });
    return h;
  }
  /* assistente (1.6): duas perguntas + resumo; o resto fica em "Opções avançadas" */
  const r = rascunho || (rascunho = T ? { freq: T.freq, div: T.div, dias: T.dias.slice(), obj: T.obj, equip: T.equip.slice(), modo: T.modo || 'calendario', evitarPlantao: !!T.evitarPlantao, foco: (T.foco || []).slice(), enf: T.enf || (DIVISOES[T.div].enf === 'inf' ? 'inf' : 'eq') } : { freq: '3x', div: 'FB', dias: [1, 3, 5], obj: 'hip', equip: PRESETS_EQUIP.completa.slice(), modo: 'calendario', evitarPlantao: !!S.plantao, foco: [] });
  const F = FREQS[r.freq];
  r.enf = r.enf || enfasePadrao();
  const divs = divsPara(r.freq, r.enf);
  if (!divs.includes(r.div)) r.div = divs[0];
  r.foco = r.foco || [];
  const mesmo = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const local = Object.keys(PRESETS_EQUIP).find(k => mesmo(PRESETS_EQUIP[k], r.equip));
  const NOME_LOCAL = { completa: 'Academia completa', basica: 'Academia simples', casa: 'Em casa' };
  h += '<div class="cartao"><h3 style="margin-bottom:8px">1. Quantas vezes por semana?</h3><div class="chips">' + Object.keys(FREQS).map(k => '<button class="chip ' + (r.freq === k ? 'on' : '') + '" data-acao="rFreq" data-v="' + k + '">' + FREQS[k].nome + '</button>').join('') + '</div>' +
    '<p class="mini" style="margin-top:8px">' + (F.alt ? 'Dia sim, dia não: o app alterna treino e descanso a partir de hoje, sem depender do dia da semana (combina com escala 12x36).' : 'Dias: ' + r.dias.slice().sort().map(x => DSEM[x]).join(', ') + '. Para trocar os dias, abra as opções avançadas.') + '</p></div>';
  h += '<div class="cartao"><h3 style="margin-bottom:8px">2. Onde você treina?</h3><div class="chips">' + Object.keys(NOME_LOCAL).map(k => '<button class="chip ' + (local === k ? 'on' : '') + '" data-acao="rPreset" data-v="' + k + '">' + NOME_LOCAL[k] + '</button>').join('') + '</div>' +
    (local ? '' : '<p class="mini" style="margin-top:8px">Equipamento escolhido à mão (veja nas opções avançadas).</p>') + '</div>';
  h += '<div class="cartao realce"><h3 style="margin-bottom:4px">O app vai montar</h3><div class="num" style="font-size:18px">' + esc(DIVISOES[r.div].nome) + '</div><div class="mini" style="margin-top:2px">' + esc(DIVISOES[r.div].desc) + '</div><div class="mini" style="margin-top:6px;color:var(--txt2)">' + OBJ_TREINO[r.obj].nome + ' · ênfase ' + ENFASES[r.enf].nome.toLowerCase() + (r.foco.length ? ' · foco em ' + esc(nomesFoco(r.foco)) : '') + '</div></div>';
  h += '<button class="btn bloco fant" style="margin-bottom:12px" data-acao="rAv">' + (r.av ? 'Esconder opções avançadas ▲' : 'Opções avançadas: dias, divisão, objetivo, foco… ▼') + '</button>';
  if (r.av) {
    if (!F.alt) h += '<div class="cartao"><h3 style="margin-bottom:8px">Dias da semana</h3><div class="grade4" style="grid-template-columns:repeat(7,minmax(0,1fr))">' + DSEM.map((n, i) => '<button class="chip ' + (r.dias.includes(i) ? 'on' : '') + '" style="justify-content:center;padding:6px 0" data-acao="rDia" data-v="' + i + '">' + n + '</button>').join('') + '</div><div class="mini" style="margin-top:6px">' + r.dias.length + ' dia(s) marcados</div></div>';
    h += '<div class="cartao"><h3 style="margin-bottom:4px">Ênfase</h3><p class="mini" style="margin-bottom:8px">' + (S.perfil ? 'Sugestão para ' + (S.perfil.sexo === 'F' ? 'mulher: <b>pernas e glúteos</b>' : 'homem: <b>equilibrado</b>') + '. Pode trocar à vontade.' : 'Preencha o perfil para o app sugerir pelo seu sexo.') + '</p><div class="chips">' + Object.keys(ENFASES).map(k => '<button class="chip ' + (r.enf === k ? 'on' : '') + '" data-acao="rEnf" data-v="' + k + '">' + ENFASES[k].nome + '</button>').join('') + '</div><p class="mini" style="margin-top:8px">' + ENFASES[r.enf].desc + '</p></div>';
    h += '<div class="cartao"><h3 style="margin-bottom:8px">Divisão</h3>' + divs.map(k => '<div class="tipo-c" style="border-color:' + (r.div === k ? 'var(--acento)' : 'var(--linha)') + '" data-acao="rDiv" data-v="' + k + '"><b>' + esc(DIVISOES[k].nome) + '</b><div class="mini">' + esc(DIVISOES[k].desc) + '</div><div class="mini" style="color:var(--txt2)">' + DIVISOES[k].seq.map((s, i) => letra(i) + ': ' + D[s][0]).join(' · ') + '</div></div>').join('') + '</div>';
    h += '<div class="cartao"><h3 style="margin-bottom:8px">Objetivo do treino</h3><div class="chips">' + Object.keys(OBJ_TREINO).map(k => '<button class="chip ' + (r.obj === k ? 'on' : '') + '" data-acao="rObj" data-v="' + k + '">' + OBJ_TREINO[k].nome + '</button>').join('') + '</div><p class="mini" style="margin-top:8px">Multiarticulares: ' + OBJ_TREINO[r.obj].comp[0] + ' × ' + OBJ_TREINO[r.obj].comp[1] + ' (descanso ' + descansoAjustado(OBJ_TREINO[r.obj].comp[2]) + ' s). Isoladores: ' + OBJ_TREINO[r.obj].iso[0] + ' × ' + OBJ_TREINO[r.obj].iso[1] + ' (' + descansoAjustado(OBJ_TREINO[r.obj].iso[2]) + ' s).' + (S.perfil && S.perfil.sexo === 'F' ? ' Descanso ~20% menor: mulheres costumam se recuperar mais rápido entre as séries.' : '') + '</p></div>';
    h += '<div class="cartao"><h3 style="margin-bottom:8px">Equipamento, um por um</h3><div class="chips">' + EQUIP_TREINO.filter(x => x !== 'Nenhum').map(k => '<button class="chip ' + (r.equip.includes(k) ? 'on' : '') + '" data-acao="rEquip" data-v="' + esc(k) + '">' + esc(k) + '</button>').join('') + '</div></div>';
    h += '<div class="cartao"><h3 style="margin-bottom:8px">Se faltar um dia</h3><div class="chips"><button class="chip ' + (r.modo === 'calendario' ? 'on' : '') + '" data-acao="rModo" data-v="calendario">Segue o calendário</button><button class="chip ' + (r.modo === 'sequencia' ? 'on' : '') + '" data-acao="rModo" data-v="sequencia">Continua de onde parei</button></div><p class="mini" style="margin-top:8px">' + (r.modo === 'sequencia' ? 'Se você faltar, o próximo treino é o que vem depois do último concluído — nenhum grupo fica para trás.' : 'O treino de cada dia é fixo pela data; faltar um dia pula aquele treino.') + '</p>' +
      (S.plantao ? '<div class="chips" style="margin-top:10px"><button class="chip ' + (r.evitarPlantao ? 'on' : '') + '" data-acao="rPlantao">Não treinar em dia de plantão</button></div><p class="mini" style="margin-top:6px">' + (r.evitarPlantao ? 'Nos plantões o app marca descanso' + (r.modo === 'sequencia' ? ' e o treino continua na folga seguinte.' : '. Dica: use "Continua de onde parei" para nenhum treino ser pulado.') : 'O plantão não muda o treino.') + '</p>' : '') + '</div>';
    h += '<div class="cartao"><h3 style="margin-bottom:4px">Grupo em foco <span class="mini">(até 2)</span></h3><p class="mini" style="margin-bottom:8px">O que você mais quer melhorar ganha mais séries, aparece em mais treinos da semana e vem primeiro no treino.</p>' + chipsFoco(r.foco, 'rFoco') + '</div>';
  }
  h += '<div class="grade2">' + (T ? '<button class="btn" data-acao="cancRasc">Cancelar</button>' : '<span></span>') + '<button class="btn pri" data-acao="criarPlano">' + (T ? 'Salvar e gerar' : 'Gerar meu treino') + '</button></div>';
  return h;
}

/* --- cardio --- */
const TIPOS_CARDIO = {
  liss: { nome: 'Contínuo leve (LISS)', zona: [60, 70], desc: 'Ritmo confortável, dá para conversar. 30–60 min. Queima gordura com pouco impacto na recuperação do treino de força.', mods: ['17358', '17034', '01216', '02048', '02071'], min: 40 },
  mict: { nome: 'Contínuo moderado', zona: [70, 80], desc: 'Fala frases curtas. 20–45 min. Melhora o condicionamento aeróbico.', mods: ['12050', '01224', '02049', '02072', '17035'], min: 30 },
  hiit: { nome: 'Intervalado (HIIT)', zona: [85, 95], desc: 'Tiros fortes alternados com recuperação, ex.: 30 s forte / 90 s leve × 8–10. 15–25 min. Muito eficiente em pouco tempo; não faça em dias seguidos.', mods: ['01305', '12060', '02214', '02073', '02068'], min: 20, hiit: { trab: 30, desc: 90, rounds: 10 } },
  tabata: { nome: 'Tabata', zona: [90, 100], desc: '20 s no máximo / 10 s parado × 8 = 4 min por bloco. Faça 1–3 blocos após aquecer.', mods: ['02214', '01305', '02068'], min: 12, hiit: { trab: 20, desc: 10, rounds: 8 } },
  sit: { nome: 'Sprint (SIT)', zona: [95, 100], desc: '30 s de esforço total / 4 min bem leve × 4–6. Intensidade máxima, volume baixo.', mods: ['01305', '12120', '02078'], min: 25, hiit: { trab: 30, desc: 240, rounds: 5 } },
  fartlek: { nome: 'Fartlek', zona: [65, 90], desc: 'Variação livre de ritmo dentro de uma corrida ou bike contínua. 20–40 min.', mods: ['12045', '01220'], min: 30 },
  inclinado: { nome: 'Caminhada inclinada', zona: [65, 75], desc: 'Esteira com inclinação 6–12% em passo firme. Gasto alto com baixo impacto nas articulações.', mods: ['17035', '17036', '02065'], min: 30 },
  circuito: { nome: 'Circuito / funcional', zona: [70, 85], desc: 'Exercícios em sequência com pouco descanso (burpee, kettlebell, corda, escalador).', mods: ['02040', '02032', '02058', '02020'], min: 25 },
  aula: { nome: 'Aula coletiva', zona: [65, 85], desc: 'Spinning, zumba, step, aeróbica.', mods: ['01270', '02310', '02002', '02006'], min: 45 }
};
function fcMax() { return S.perfil ? Math.round(208 - 0.7 * S.perfil.idade) : null; }
function sugestaoCardio() {
  const o = S.perfil ? S.perfil.objetivo : 'manter';
  if (o === 'perder') return { tipo: 'liss', cod: '17034', min: 35, vezes: 4, quando: 'apos', txt: 'Para perder gordura: 3–4x por semana de contínuo leve (30–45 min), podendo trocar 1 sessão por HIIT.' };
  if (o === 'ganhar') return { tipo: 'liss', cod: '01216', min: 20, vezes: 2, quando: 'folga', txt: 'Para ganhar massa: 2x por semana de 20–30 min leve, para saúde do coração sem atrapalhar o ganho.' };
  return { tipo: 'mict', cod: '01224', min: 30, vezes: 3, quando: 'folga', txt: 'Para manter: 2–3x por semana de 30 min moderado.' };
}
function telaCardio() {
  const fc = fcMax(); const C = S.cardio; const sug = sugestaoCardio();
  let h = '<div class="cartao"><div class="cab"><h2>Meu cardio</h2></div>';
  if (C) { const cc = cardioCod(C.cod); h += '<div class="num" style="font-size:20px">' + esc(TIPOS_CARDIO[C.tipo].nome) + '</div><div class="sub">' + esc(cc ? cc.nome : '') + ' · ' + C.min + ' min · ' + C.vezes + 'x/semana · ' + ({ apos: 'depois da musculação', folga: 'nos dias de descanso', todo: 'em qualquer dia' })[C.quando] + '</div><div class="chips" style="margin-top:10px"><button class="btn peq" data-acao="editarCardio">Alterar</button><button class="btn peq perigo" data-acao="remPlanoCardio">Remover</button></div>'; }
  else h += '<p class="sub">' + esc(sug.txt) + '</p><button class="btn pri bloco" data-acao="editarCardio">Montar meu cardio</button>';
  h += '</div>';
  if (fc) {
    const Z = [['Z1', 50, 60, '#4b5a63', 'Recuperação'], ['Z2', 60, 70, '#2E9BD6', 'Base aeróbica / queima de gordura'], ['Z3', 70, 80, '#4CC38A', 'Aeróbico moderado'], ['Z4', 80, 90, '#F2A93B', 'Limiar'], ['Z5', 90, 100, '#F0605D', 'Máximo']];
    h += '<div class="cartao"><div class="cab"><h3>Zonas de frequência cardíaca</h3><span class="mini" style="margin-left:auto">FC máx ≈ ' + fc + ' bpm</span></div>' + Z.map(z => '<div class="zona"><b>' + z[0] + '</b><span><i style="background:' + z[3] + ';width:' + (z[2] - 40) + '%"></i><span class="mini">' + z[4] + '</span></span><span class="num">' + Math.round(fc * z[1] / 100) + '–' + Math.round(fc * z[2] / 100) + '</span></div>').join('') + '<p class="mini" style="margin-top:6px">Estimativa pela fórmula de Tanaka (208 − 0,7 × idade). Um teste de esforço dá o valor real.</p></div>';
  }
  h += '<div class="cartao"><details><summary><b>Tipos de cardio</b> · saiba mais e cronômetros</summary><div style="margin-top:8px">' + Object.keys(TIPOS_CARDIO).map(k => { const t = TIPOS_CARDIO[k]; return '<div class="tipo-c"><b>' + esc(t.nome) + '</b> <span class="tag">' + t.zona[0] + '–' + t.zona[1] + '% FCmáx</span><div class="mini" style="margin-top:2px">' + esc(t.desc) + '</div>' + (t.hiit ? '<button class="btn peq" style="margin-top:6px" data-acao="cronHiit" data-tipo="' + k + '">Cronômetro ' + t.hiit.trab + 's/' + t.hiit.desc + 's × ' + t.hiit.rounds + '</button>' : '') + '</div>'; }).join('') + '</div></details></div>';
  return h;
}
function folhaPlanoCardio() {
  const C = S.cardio || sugestaoCardio(); let t = C.tipo, cod = C.cod;
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Plano de cardio</h2><label class="campo"><span>Tipo</span><select id="pcTipo">' + Object.keys(TIPOS_CARDIO).map(k => '<option value="' + k + '"' + (k === t ? ' selected' : '') + '>' + esc(TIPOS_CARDIO[k].nome) + '</option>').join('') + '</select></label><label class="campo"><span>Modalidade</span><select id="pcMod"></select></label>' +
    '<div class="grade2"><label class="campo"><span>Minutos</span><input type="number" inputmode="numeric" id="pcMin" value="' + C.min + '"></label><label class="campo"><span>Vezes por semana</span><input type="number" inputmode="numeric" id="pcVezes" value="' + C.vezes + '"></label></div>' +
    '<label class="campo"><span>Quando</span><select id="pcQuando"><option value="apos"' + (C.quando === 'apos' ? ' selected' : '') + '>Depois da musculação</option><option value="folga"' + (C.quando === 'folga' ? ' selected' : '') + '>Nos dias de descanso</option><option value="todo"' + (C.quando === 'todo' ? ' selected' : '') + '>Qualquer dia (espalhado na semana)</option></select></label><p class="mini" style="margin:-4px 0 10px">O app escolhe os dias da semana respeitando "vezes por semana".</p><div class="grade2"><button class="btn" id="pcCanc">Cancelar</button><button class="btn pri" id="pcOk">Salvar</button></div>', el => {
      const mods = () => {
        const tt = $('#pcTipo', el).value; const lista = TIPOS_CARDIO[tt].mods.map(cardioCod).filter(Boolean).concat(CARDIO.filter(c => !TIPOS_CARDIO[tt].mods.includes(c.cod)));
        $('#pcMod', el).innerHTML = lista.map(c => '<option value="' + c.cod + '"' + (c.cod === cod ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('');
      };
      mods();
      $('#pcTipo', el).onchange = () => { cod = TIPOS_CARDIO[$('#pcTipo', el).value].mods[0]; $('#pcMin', el).value = TIPOS_CARDIO[$('#pcTipo', el).value].min; mods(); };
      $('#pcMod', el).onchange = () => cod = $('#pcMod', el).value;
      $('#pcCanc', el).onclick = () => fecharFolha(fl);
      $('#pcOk', el).onclick = () => {
        S.cardio = { tipo: $('#pcTipo', el).value, cod: $('#pcMod', el).value, min: clamp(num($('#pcMin', el).value) || 30, 5, 240), vezes: clamp(num($('#pcVezes', el).value) || 3, 1, 14), quando: $('#pcQuando', el).value };
        salvar(); fecharFolha(fl); render(); toast('Cardio salvo. As metas de calorias consideram o novo gasto.');
      };
    });
}
function folhaRegistrarCardio() {
  const C = cardioDoDia(dataSel); const kg = pesoAtual();
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Registrar cardio</h2><label class="campo"><span>Atividade</span><select id="rcMod">' + CARDIO.map(c => '<option value="' + c.cod + '"' + (C && C.cod === c.cod ? ' selected' : '') + '>' + esc(c.mod + ' · ' + c.nome) + '</option>').join('') + '</select></label><label class="campo"><span>Minutos</span><input type="number" inputmode="numeric" id="rcMin" value="' + (C ? C.min : 30) + '"></label><div class="info" id="rcPrev"></div><div class="grade2"><button class="btn" id="rcCanc">Cancelar</button><button class="btn pri" id="rcOk">Registrar</button></div>', el => {
    const prev = () => { const c = cardioCod($('#rcMod', el).value); const mi = num($('#rcMin', el).value) || 0; $('#rcPrev', el).textContent = kg ? 'Gasto estimado: ' + fmt(c.met * kg * mi / 60) + ' kcal (MET ' + fmt(c.met, 1) + ').' : 'Registre seu peso para estimar o gasto.'; };
    $('#rcMod', el).onchange = prev; $('#rcMin', el).oninput = prev; prev();
    $('#rcCanc', el).onclick = () => fecharFolha(fl);
    $('#rcOk', el).onclick = () => {
      const c = cardioCod($('#rcMod', el).value); const mi = num($('#rcMin', el).value); if (!mi) { toast('Informe os minutos.'); return; }
      const d = dia(dataSel, true); d.cardio = d.cardio || []; d.cardio.push({ cod: c.cod, min: mi, kcal: kg ? Math.round(c.met * kg * mi / 60) : 0 });
      salvar(); fecharFolha(fl); render(); toast('Cardio registrado.');
    };
  });
}

/* --- cronômetro de intervalos (HIIT/Tabata/SIT) --- */
let somCtx = null;
function bip(freq, dur) {
  try { somCtx = somCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = somCtx.createOscillator(), g = somCtx.createGain(); o.frequency.value = freq || 880; o.connect(g); g.connect(somCtx.destination); g.gain.setValueAtTime(0.2, somCtx.currentTime); o.start(); o.stop(somCtx.currentTime + (dur || 0.15)); } catch (e) { /* sem áudio */ }
  if (navigator.vibrate) navigator.vibrate(dur && dur > 0.3 ? 400 : 120);
}
/* manter a tela acesa durante treino/cronômetro (Wake Lock; ignora se o aparelho não suportar) */
let travaTela = null, querTela = 0;
async function telaAcesa(liga) {
  querTela = Math.max(0, querTela + (liga ? 1 : -1));
  try {
    if (querTela && !travaTela && navigator.wakeLock) { travaTela = await navigator.wakeLock.request('screen'); travaTela.addEventListener('release', () => { travaTela = null; }); }
    else if (!querTela && travaTela) { const t = travaTela; travaTela = null; await t.release(); }
  } catch (e) { travaTela = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && querTela && !travaTela) { querTela--; telaAcesa(true); } });
function treinoEmAndamento() { const d = dia(hojeISO()); return !!(d && d.treino && d.treino.ini && !d.treino.fim); }

function folhaHiit(tipo) {
  const cfg = Object.assign({ prep: 10 }, TIPOS_CARDIO[tipo].hiit);
  let fase = 'pronto', resta = 0, round = 0, tm = null, fim = 0, ultBip = -1;
  const parar = () => { if (tm) { clearInterval(tm); tm = null; telaAcesa(false); } };
  const fl = abrirFolha('<h2>' + esc(TIPOS_CARDIO[tipo].nome) + '</h2><div class="grade4" style="margin:10px 0"><label class="campo"><span>Preparar (s)</span><input type="number" inputmode="numeric" id="hP" value="' + cfg.prep + '"></label><label class="campo"><span>Forte (s)</span><input type="number" inputmode="numeric" id="hT" value="' + cfg.trab + '"></label><label class="campo"><span>Leve (s)</span><input type="number" inputmode="numeric" id="hD" value="' + cfg.desc + '"></label><label class="campo"><span>Rounds</span><input type="number" inputmode="numeric" id="hR" value="' + cfg.rounds + '"></label></div><p class="mini" style="margin:-4px 0 10px">Faça 5–10 min de aquecimento leve antes de começar.</p><div class="hiit cartao"><div class="fase" id="hFase">Pronto</div><div class="grande num" id="hTempo">--</div><div class="mini" id="hRound"></div></div><div class="grade2"><button class="btn" id="hParar">Fechar</button><button class="btn pri" id="hIr">Começar</button></div>', el => {
    const pintar = () => {
      $('#hFase', el).textContent = { pronto: 'Pronto', prep: 'Prepare-se', trab: 'Forte!', desc: 'Leve', fim: 'Fim' }[fase];
      $('#hFase', el).style.color = fase === 'trab' ? 'var(--erro)' : fase === 'desc' ? 'var(--agua)' : 'var(--acento)';
      $('#hTempo', el).textContent = fase === 'pronto' ? '--' : Math.floor(resta / 60) + ':' + pad(resta % 60);
      $('#hRound', el).textContent = round ? 'Round ' + round + ' de ' + cfg.rounds : '';
    };
    const nova = (f, seg) => { fase = f; fim = Date.now() + seg * 1000; ultBip = -1; };
    const passo = () => {
      resta = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
      /* um bipe por segundo nos 3 últimos segundos */
      if (resta <= 3 && resta > 0 && resta !== ultBip) { ultBip = resta; bip(660, 0.08); }
      if (resta === 0) {
        if (fase === 'prep' || fase === 'desc') {
          if (round >= cfg.rounds) { fase = 'fim'; parar(); bip(990, 0.6); pintar(); return; }
          round++; nova('trab', cfg.trab); bip(990, 0.4);
        } else if (fase === 'trab') {
          if (round >= cfg.rounds) { fase = 'fim'; parar(); bip(990, 0.6); pintar(); return; }
          nova('desc', cfg.desc); bip(440, 0.4);
        }
        resta = Math.ceil((fim - Date.now()) / 1000);
      }
      pintar();
    };
    $('#hIr', el).onclick = () => {
      cfg.prep = Math.max(0, num($('#hP', el).value) ?? cfg.prep); cfg.trab = num($('#hT', el).value) || cfg.trab; cfg.desc = num($('#hD', el).value) || cfg.desc; cfg.rounds = num($('#hR', el).value) || cfg.rounds;
      const rodando = !!tm; if (tm) clearInterval(tm); round = 0; nova('prep', cfg.prep || 3); bip(880, 0.1);
      tm = setInterval(passo, 200); if (!rodando) telaAcesa(true); passo();
      $('#hIr', el).textContent = 'Recomeçar';
    };
    $('#hParar', el).onclick = () => fecharFolha(fl);
    pintar();
  });
  fl._aoFechar = parar; /* fechar de qualquer jeito (botão ou tocando fora) para o cronômetro */
}

/* --- descanso entre séries --- */
let descansoT = null;
function iniciarDescanso(seg) {
  pararDescanso();
  const fim = Date.now() + seg * 1000;
  const el = document.createElement('div'); el.className = 'timer'; el.id = 'timerDesc';
  el.innerHTML = '<div><div class="mini">Descanso</div><div class="grande num" id="tdT"></div></div><div style="margin-left:auto;display:flex;gap:6px"><button class="btn peq" id="tdMais">+15 s</button><button class="btn peq" id="tdPular">Pular</button></div>';
  document.body.appendChild(el); document.body.classList.add('com-timer');
  let alvo = fim, ultBip = -1;
  const tick = () => { const r = Math.max(0, Math.ceil((alvo - Date.now()) / 1000)); const t = $('#tdT'); if (t) t.textContent = Math.floor(r / 60) + ':' + pad(r % 60); if (r > 0 && r <= 3 && r !== ultBip) { ultBip = r; bip(660, 0.06); } if (r <= 0) { bip(990, 0.5); pararDescanso(); } };
  $('#tdMais', el).onclick = () => { alvo += 15000; tick(); };
  $('#tdPular', el).onclick = pararDescanso;
  tick(); descansoT = setInterval(tick, 500);
}
function pararDescanso() { clearInterval(descansoT); const t = $('#timerDesc'); if (t) t.remove(); document.body.classList.remove('com-timer'); }

/* --- evolução de cargas --- */
function registrosEx() {
  const reg = {};
  Object.keys(S.dias).sort().forEach(iso => { const t = S.dias[iso].treino; if (!t || !t.s) return; for (const id in t.s) { t.s[id].forEach(x => { if (x.kg != null && x.r) { const rm = x.kg * (1 + x.r / 30); (reg[id] = reg[id] || []).push({ iso, kg: x.kg, r: x.r, rm }); } }); } });
  return reg;
}
function volumePlanejado() {
  const T = S.treino; const vol = {}; if (!T) return vol;
  const fator = T.freq === 'alt' ? 3.5 / T.seq.length : T.dias.length / T.seq.length;
  T.seq.forEach(dd => dd.ex.forEach(p => { const e = EXS.get(p.id); if (e && e.grupo !== 'mobilidade') vol[e.grupo] = (vol[e.grupo] || 0) + p.s * fator; }));
  return vol;
}
function telaEvolucao() {
  const reg = registrosEx();
  const ids = Object.keys(reg);
  let feitos = 0; Object.keys(S.dias).forEach(iso => { const t = S.dias[iso].treino; if (t && t.fim && diffDias(iso, hojeISO()) < 30) feitos++; });
  let h = '<div class="cartao"><div class="linha-flex"><div class="grande">' + feitos + '</div><div class="sub">treinos concluídos nos últimos 30 dias</div></div></div>';
  /* volume real (séries marcadas ✓) dos últimos 7 dias vs o plano */
  const real = {}; ultimos7(dataSel).forEach(iso => { const t = S.dias[iso] && S.dias[iso].treino; if (!t || !t.s) return; for (const id in t.s) { const e = EXS.get(id); if (!e || e.grupo === 'mobilidade') continue; real[e.grupo] = (real[e.grupo] || 0) + t.s[id].filter(x => x.ok).length; } });
  const plan = volumePlanejado(); const grupos = Array.from(new Set(Object.keys(plan).concat(Object.keys(real)))).sort((x, y) => (plan[y] || 0) - (plan[x] || 0));
  if (grupos.length) h += '<div class="cartao"><div class="cab"><h3>Séries feitas · últimos 7 dias</h3><span class="mini" style="margin-left:auto">feitas / plano</span></div>' + grupos.map(g => { const r = real[g] || 0, p = Math.round(plan[g] || 0); return '<div class="macro"><div class="lin"><span>' + ((S.treino && (S.treino.foco || []).includes(g)) ? '<b style="color:var(--acento)">★ ' + (GRUPOS[g] || g) + '</b>' : (GRUPOS[g] || g)) + '</span><span><b>' + r + '</b> / ' + p + '</span></div><div class="barra"><i style="width:' + clamp(p ? r / p * 100 : 100, 0, 100) + '%;background:' + (p && r < p * 0.7 ? 'var(--alerta)' : 'var(--ok)') + '"></i></div></div>'; }).join('') + '<p class="mini">Conta só as séries marcadas com ✓.</p></div>';
  if (!ids.length) return h + '<div class="cartao vazio">Registre cargas e repetições nos treinos para acompanhar a evolução de cada exercício.</div>';
  h += '<div class="cartao"><div class="cab"><h3>Recordes (1RM estimado)</h3></div><p class="mini">Fórmula de Epley: carga × (1 + reps/30). Toque num exercício para ver o gráfico.</p><ul class="lista">' + ids.sort((x, y) => reg[y][reg[y].length - 1].iso.localeCompare(reg[x][reg[x].length - 1].iso)).map(id => {
    const l = reg[id]; const best = l.reduce((a, b) => b.rm > a.rm ? b : a); const prim = l[0]; const e = EXS.get(id);
    const ganho = prim.rm ? (best.rm / prim.rm - 1) * 100 : 0;
    return '<li data-acao="graficoEx" data-id="' + esc(id) + '"><div class="txt"><div class="t">' + esc(e ? e.nome : id) + '</div><div class="mini">Melhor: ' + fmt(best.kg, 1) + ' kg × ' + best.r + ' (' + dataCurta(best.iso) + ')</div></div><div class="val">' + fmt(best.rm) + ' kg<div class="mini" style="color:' + (ganho > 0 ? 'var(--ok)' : 'var(--txt3)') + '">' + (ganho > 0 ? '+' : '') + fmt(ganho) + '%</div></div></li>';
  }).join('') + '</ul></div>';
  return h;
}
function folhaGraficoEx(id) {
  const l = registrosEx()[id] || []; const e = EXS.get(id);
  const porDia = {}; l.forEach(x => { const d = porDia[x.iso] || (porDia[x.iso] = { iso: x.iso, rm: 0, vol: 0, top: null }); d.rm = Math.max(d.rm, x.rm); d.vol += x.kg * x.r; if (!d.top || x.kg > d.top.kg) d.top = x; });
  const dias = Object.values(porDia).sort((a, b) => a.iso < b.iso ? -1 : 1).slice(-30);
  let g = '<div class="mini">Treine este exercício mais vezes para ver o gráfico.</div>';
  if (dias.length >= 2) {
    const W = 320, H = 130, pe = 16, mE = 34; const v = dias.map(x => x.rm); let mn = Math.min(...v), mx = Math.max(...v); if (mx - mn < 4) { mn -= 2; mx += 2; }
    const X = i => mE + (W - mE - 6) * i / (dias.length - 1), Y = y => 6 + (H - 12) * (1 - (y - mn) / (mx - mn));
    g = '<svg class="graf" viewBox="0 0 ' + W + ' ' + (H + pe) + '" role="img" aria-label="1RM estimado por treino">' + [mn, (mn + mx) / 2, mx].map(y => '<line x1="' + mE + '" x2="' + W + '" y1="' + Y(y) + '" y2="' + Y(y) + '" stroke="#22272b"/><text x="' + (mE - 4) + '" y="' + (Y(y) + 3) + '" text-anchor="end">' + fmt(y) + '</text>').join('') +
      '<path d="' + dias.map((x, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x.rm).toFixed(1)).join('') + '" fill="none" stroke="var(--acento)" stroke-width="2" stroke-linejoin="round"/>' + dias.map((x, i) => '<circle cx="' + X(i) + '" cy="' + Y(x.rm) + '" r="3.5" fill="var(--acento)"/>').join('') +
      '<text x="' + mE + '" y="' + (H + 13) + '">' + dataCurta(dias[0].iso) + '</text><text x="' + W + '" y="' + (H + 13) + '" text-anchor="end">' + dataCurta(dias[dias.length - 1].iso) + '</text></svg><div class="mini" style="margin-top:4px">Linha: 1RM estimado (kg) de cada treino.</div>';
  }
  abrirFolha('<h2>' + esc(e ? e.nome : id) + '</h2><div style="margin:10px 0">' + g + '</div><ul class="lista">' + dias.slice().reverse().slice(0, 12).map(x => '<li><div class="txt"><div class="t">' + dataCurta(x.iso) + '</div><div class="mini">melhor série ' + fmt(x.top.kg, 1) + ' kg × ' + x.top.r + ' · volume ' + fmt(x.vol) + ' kg</div></div><div class="val">' + fmt(x.rm) + ' kg</div></li>').join('') + '</ul><button class="btn bloco" style="margin-top:10px" onclick="fecharFolha()">Fechar</button>');
}

/* --- seletor de exercícios --- */
function folhaEscolherEx(grupo, aoEscolher) {
  let g = grupo || '', limite = 60;
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Escolher exercício</h2><input type="search" id="qEx" placeholder="Buscar (ex.: supino, remada, agachamento)"><div class="rolax" style="margin:10px 0" id="gEx"></div><div id="resEx"></div>', el => {
    const desenhar = () => {
      $('#gEx', el).innerHTML = '<button class="chip ' + (!g ? 'on' : '') + '" data-g="">Todos</button>' + Object.keys(GRUPOS).filter(k => k !== 'pescoco').map(k => '<button class="chip ' + (g === k ? 'on' : '') + '" data-g="' + k + '">' + GRUPOS[k] + '</button>').join('');
      const tk = sem($('#qEx', el).value).split(/\s+/).filter(Boolean);
      let lista = [];
      if (!tk.length && g && EX_CUR[g]) lista = EX_CUR[g].map(id => EXS.get(id));
      const resto = []; EXS.forEach(e => { if (g && e.grupo !== g) return; if (tk.some(t => !e.busca.includes(t))) return; if (!lista.includes(e)) resto.push(e); });
      resto.sort((a, b) => (a.tipo === 'Musculação' ? 0 : 1) - (b.tipo === 'Musculação' ? 0 : 1) || a.nome.length - b.nome.length);
      lista = lista.concat(resto); const total = lista.length; lista = lista.slice(0, limite);
      $('#resEx', el).innerHTML = '<div class="mini" style="margin-bottom:4px">' + total + ' exercícios' + (g ? ' · ' + GRUPOS[g] : '') + '</div>' + lista.map(e => '<div class="res" data-id="' + esc(e.id) + '"><div class="fig" style="width:44px;height:44px;border-radius:9px;background:var(--card2) url(' + imgEx(e) + ') center/cover;flex-shrink:0"></div><div class="txt"><div class="t">' + esc(e.nome) + '</div><div class="mini">' + esc(e.musc1) + ' · ' + esc(e.equip) + ' · ' + esc(e.tipo) + '</div></div></div>').join('') + (total ? '' : '<div class="vazio">Nada encontrado.</div>') + (total > lista.length ? '<button class="btn bloco" style="margin-top:8px" data-mais="1">Mostrar mais (' + (total - lista.length) + ' restantes)</button>' : '');
    };
    let espera = null;
    $('#qEx', el).oninput = () => { limite = 60; clearTimeout(espera); espera = setTimeout(desenhar, 200); };
    $('#gEx', el).onclick = e => { const b = e.target.closest('[data-g]'); if (b) { g = b.dataset.g; limite = 60; desenhar(); } };
    $('#resEx', el).onclick = e => { if (e.target.closest('[data-mais]')) { limite += 100; desenhar(); return; } const r = e.target.closest('[data-id]'); if (r) { fecharFolha(fl); aoEscolher(EXS.get(r.dataset.id)); } };
    desenhar();
    el._paraBusca = () => clearTimeout(espera);
  });
  fl._aoFechar = () => { const fo = $('.folha', fl); if (fo && fo._paraBusca) fo._paraBusca(); };
}
function folhaVerEx(id) {
  const e = EXS.get(id); if (!e) return;
  const imgs = []; for (let i = 0; i < Math.min(e.nimg, 2); i++) imgs.push('<img src="' + imgEx(e, i) + '" alt="" style="width:100%;border-radius:12px;background:var(--card2);min-height:120px" loading="lazy">');
  abrirFolha('<h2>' + esc(e.nome) + '</h2><div class="mini" style="margin:4px 0 10px">' + esc(e.en) + '</div><div class="grade2" style="margin-bottom:10px">' + imgs.join('') + '</div><div class="sub">Músculo principal: <b>' + esc(e.musc1) + '</b>' + (e.musc2 ? '<br>Secundários: ' + esc(e.musc2) : '') + '<br>Equipamento: ' + esc(e.equip) + ' · Nível: ' + esc(e.nivel) + (e.mec ? ' · ' + esc(e.mec) : '') + '</div><p class="mini">Imagens: Free Exercise DB (precisam de internet). Busque "' + esc(e.en) + '" para ver vídeos de execução.</p><button class="btn bloco" onclick="fecharFolha()">Fechar</button>');
}
function folhaPresc(i, j) {
  const p = S.treino.seq[i].ex[j]; const e = EXS.get(p.id);
  const fl = abrirFolha('<h3 style="margin-bottom:10px">' + esc(e.nome) + '</h3><div class="grade3"><label class="campo"><span>Séries</span><input type="number" id="psS" value="' + p.s + '"></label><label class="campo"><span>Reps</span><input type="text" id="psR" value="' + esc(p.r) + '"></label><label class="campo"><span>Descanso (s)</span><input type="number" id="psD" value="' + p.d + '"></label></div><div class="grade2"><button class="btn" id="psC">Cancelar</button><button class="btn pri" id="psO">Salvar</button></div>', el => {
    $('#psC', el).onclick = () => fecharFolha(fl);
    $('#psO', el).onclick = () => { p.s = clamp(num($('#psS', el).value) || p.s, 1, 12); p.r = $('#psR', el).value.trim() || p.r; p.d = clamp(num($('#psD', el).value) || p.d, 0, 600); salvar(); fecharFolha(fl); render(); };
  });
}
function folhaEscolherTreino() {
  const T = S.treino;
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Treino deste dia</h2>' + T.seq.map((t, i) => '<button class="btn bloco" style="margin-bottom:8px;justify-content:flex-start" data-i="' + i + '">' + letra(i) + ' — ' + esc(t.n) + '</button>').join('') + '<button class="btn bloco fant" data-i="auto">Voltar ao do plano</button>', el => {
    $$('[data-i]', el).forEach(b => b.onclick = () => {
      const d = dia(dataSel, true);
      if (b.dataset.i === 'auto') { if (d.treino && !d.treino.ini) d.treino = null; else if (d.treino) { delete d.treino.manual; } }
      else { const i = Number(b.dataset.i); if (!d.treino) d.treino = { idx: i, s: {}, extra: [], manual: true }; else { d.treino.idx = i; d.treino.manual = true; } }
      salvar(); fecharFolha(fl); render();
    });
  });
}

/* ===================== ÁGUA E SONO ===================== */
function sonosQueTerminamEm(iso) { return S.sono.filter(s => s.fim.slice(0, 10) === iso); }
function sonoDoDia(iso) { const l = sonosQueTerminamEm(iso); const min = l.reduce((a, s) => a + minutosEntre(s.ini, s.fim), 0); const q = l.length ? Math.round(l.reduce((a, s) => a + (s.q || 0), 0) / l.length) : 0; return { min, q, lista: l }; }
/* Progresso → Sono e água: só os gráficos da semana; registrar fica em Hoje */
function telaSonoAgua() {
  const hj = hojeISO(); const dias7 = ultimos7(hj); const meta = metaAguaDia(hj);
  let h = '<div class="cartao"><div class="cab"><h3>Água · últimos 7 dias (L)</h3><div class="dir"><button class="btn peq" data-acao="folhaAgua" data-v="hoje">+ Água</button></div></div>' + grafBarras(dias7.map(x => aguaDia(x) / 1000), dias7.map(x => DSEM[diaSemana(x)]), meta / 1000, 'var(--agua)', 'L', 'agua') +
    '<p class="mini" style="margin-top:6px">Meta de hoje: ' + fmt(meta / 1000, 1) + ' L (+0,5 L em dia de treino' + (S.plantao ? ' e de plantão' : '') + ').</p></div>';
  const horas = dias7.map(x => sonoDoDia(x).min / 60);
  const comDado = horas.filter(x => x > 0);
  const media = comDado.length ? comDado.reduce((a, b) => a + b, 0) / comDado.length : 0;
  const divida = horas.reduce((a, v) => a + (v > 0 ? Math.max(0, 7.5 - v) : 0), 0);
  h += '<div class="cartao"><div class="cab"><h3>Sono · últimos 7 dias (h)</h3><div class="dir"><button class="btn peq" data-acao="folhaSono" data-v="hoje">+ Sono</button></div></div>' + grafBarras(horas, dias7.map(x => DSEM[diaSemana(x)]), 7.5, 'var(--sono)', 'h', 'sono') +
    '<div class="grade2" style="margin-top:8px"><div><div class="mini">Média</div><div class="num" style="font-size:22px">' + (media ? hm(media * 60) : '–') + '</div></div><div><div class="mini">Déficit na semana (vs 7h30)</div><div class="num" style="font-size:22px">' + hm(divida * 60) + '</div></div></div>' +
    '<p class="mini" style="margin-top:8px">Adultos: 7–9 h. Em plantão noturno, registre também o sono de dia e os cochilos — o app soma tudo que termina no mesmo dia.</p></div>';
  return h;
}
function folhaSono(s) {
  const agora = new Date(); const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1); ontem.setHours(23, 0, 0, 0);
  const ini = s ? s.ini : dtLocal(ontem), fim = s ? s.fim : dtLocal(agora); let q = s ? s.q || 0 : 0;
  const fl = abrirFolha('<h2 style="margin-bottom:10px">' + (s ? 'Editar sono' : 'Registrar sono') + '</h2><label class="campo"><span>Dormi em</span><input type="datetime-local" id="snI" value="' + ini + '"></label><label class="campo"><span>Acordei em</span><input type="datetime-local" id="snF" value="' + fim + '"></label><div class="mini" id="snDur" style="margin:-4px 0 10px"></div><label class="campo"><span>Qualidade</span><div class="estrelas" id="snQ"></div></label><label class="campo"><span>Observação</span><input type="text" id="snN" value="' + esc(s && s.nota || '') + '" placeholder="Ex.: pós-plantão, acordei várias vezes"></label><div class="grade2">' + (s ? '<button class="btn perigo" id="snDel">Excluir</button>' : '<button class="btn" id="snC">Cancelar</button>') + '<button class="btn pri" id="snO">Salvar</button></div>', el => {
    const est = () => { $('#snQ', el).innerHTML = [1, 2, 3, 4, 5].map(i => '<button type="button" class="' + (i <= q ? 'on' : '') + '" data-q="' + i + '">★</button>').join(''); };
    const dur = () => { const m = minutosEntre($('#snI', el).value, $('#snF', el).value); $('#snDur', el).textContent = isNaN(m) ? '' : (m > 0 ? 'Duração: ' + hm(m) : 'O horário de acordar precisa ser depois do de dormir.'); };
    est(); dur();
    $('#snQ', el).onclick = e => { const b = e.target.closest('[data-q]'); if (b) { q = Number(b.dataset.q); est(); } };
    $('#snI', el).oninput = dur; $('#snF', el).oninput = dur;
    if ($('#snC', el)) $('#snC', el).onclick = () => fecharFolha(fl);
    if ($('#snDel', el)) $('#snDel', el).onclick = async () => { if (await confirmar('Excluir este registro de sono?', 'Excluir', true)) { S.sono = S.sono.filter(x => x.id !== s.id); salvar(); fecharFolha(fl); render(); } };
    $('#snO', el).onclick = () => {
      const a = $('#snI', el).value, b = $('#snF', el).value; const m = minutosEntre(a, b);
      if (!a || !b || !(m > 0)) { toast('Confira os horários.'); return; }
      if (m > 20 * 60) { toast('Mais de 20 h de sono? Confira as datas.'); return; }
      const reg = { id: s ? s.id : 'S' + Date.now(), ini: a, fim: b, q, nota: $('#snN', el).value.trim() };
      if (s) Object.assign(s, reg); else S.sono.push(reg);
      S.sono.sort((x, y) => x.ini < y.ini ? -1 : 1);
      salvar(); fecharFolha(fl); render(); toast('Sono salvo: ' + hm(m) + '.');
    };
  });
}

/* ===================== EU: perfil, peso, dados ===================== */
function tendenciaPeso() {
  const l = S.peso.slice().sort((a, b) => a.d < b.d ? -1 : 1);
  if (l.length < 3) return null;
  const ult = l[l.length - 1].d; const jan = l.filter(x => diffDias(x.d, ult) <= 28);
  if (jan.length < 3 || diffDias(jan[0].d, ult) < 7) return null;
  const xs = jan.map(x => diffDias(jan[0].d, x.d)), ys = jan.map(x => x.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let num1 = 0, den = 0; xs.forEach((x, i) => { num1 += (x - mx) * (ys[i] - my); den += (x - mx) * (x - mx); });
  const incl = den ? num1 / den : 0;
  return { semana: incl * 7, pct: incl * 7 / my * 100, dias: diffDias(jan[0].d, ult), n: jan.length };
}
function sugestaoAjuste() {
  const p = S.perfil; if (!p || p.usarReal) return null;
  /* depois de um ajuste, espera 14 dias para o peso responder antes de sugerir de novo */
  if (p.ajusteEm && diffDias(p.ajusteEm, hojeISO()) < 14) return null;
  const t = tendenciaPeso(); if (!t || t.dias < 14) return null;
  if (Math.abs(p.ajusteKcal || 0) >= 600) return null;
  const alvo = RITMO_ALVO[p.objetivo][p.ritmo || 'moderado'];
  const dif = t.pct - alvo;
  if (p.objetivo === 'perder') { if (dif > 0.25) return { delta: -150, txt: 'Você está perdendo menos que o planejado (' + fmt(t.pct, 2) + '%/sem vs ' + fmt(alvo, 2) + '%).' }; if (dif < -0.5) return { delta: 150, txt: 'Você está perdendo mais rápido que o planejado (' + fmt(t.pct, 2) + '%/sem). Perder rápido demais custa massa muscular.' }; }
  if (p.objetivo === 'ganhar') { if (dif < -0.1) return { delta: 150, txt: 'O peso está subindo menos que o planejado (' + fmt(t.pct, 2) + '%/sem vs ' + fmt(alvo, 2) + '%).' }; if (dif > 0.25) return { delta: -150, txt: 'O peso está subindo rápido demais (' + fmt(t.pct, 2) + '%/sem), provavelmente com ganho de gordura.' }; }
  if (p.objetivo === 'manter' && Math.abs(t.pct) > 0.3) return { delta: t.pct > 0 ? -100 : 100, txt: 'O peso está ' + (t.pct > 0 ? 'subindo' : 'caindo') + ' ' + fmt(Math.abs(t.pct), 2) + '%/sem.' };
  return null;
}
function grafPeso() {
  const l = S.peso.slice().sort((a, b) => a.d < b.d ? -1 : 1).slice(-60);
  if (l.length < 2) return '<div class="mini">Registre o peso pelo menos 2 vezes para ver o gráfico.</div>';
  const W = 320, H = 130, pe = 16, mE = 30;
  const kgs = l.map(x => x.kg); let mn = Math.min(...kgs), mx = Math.max(...kgs); if (mx - mn < 2) { mn -= 1; mx += 1; }
  const d0 = l[0].d, dt = Math.max(1, diffDias(d0, l[l.length - 1].d));
  const X = d => mE + (W - mE - 6) * diffDias(d0, d) / dt, Y = v => 6 + (H - 12) * (1 - (v - mn) / (mx - mn));
  let s = '<svg class="graf" viewBox="0 0 ' + W + ' ' + (H + pe) + '" role="img" aria-label="Peso ao longo do tempo">';
  [mn, (mn + mx) / 2, mx].forEach(v => { s += '<line x1="' + mE + '" x2="' + W + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#22272b"/><text x="' + (mE - 4) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + fmt(v, 1) + '</text>'; });
  const media = l.map((x, i) => { const jan = l.filter(y => diffDias(y.d, x.d) >= 0 && diffDias(y.d, x.d) < 7); return jan.reduce((a, b) => a + b.kg, 0) / jan.length; });
  s += '<path d="' + l.map((x, i) => (i ? 'L' : 'M') + X(x.d).toFixed(1) + ' ' + Y(media[i]).toFixed(1)).join('') + '" fill="none" stroke="var(--acento)" stroke-width="2" stroke-linejoin="round"/>';
  l.forEach((x, i) => { s += '<circle cx="' + X(x.d) + '" cy="' + Y(x.kg) + '" r="3.5" fill="#6E7780" stroke="var(--card)" stroke-width="2"/><circle cx="' + X(x.d) + '" cy="' + Y(x.kg) + '" r="12" fill="transparent" data-ptxt="' + esc(dataCurta(x.d) + ': ' + fmt(x.kg, 1) + ' kg · média 7 dias ' + fmt(media[i], 1) + ' kg') + '"/>'; });
  s += '<text x="' + mE + '" y="' + (H + 13) + '">' + dataCurta(l[0].d) + '</text><text x="' + W + '" y="' + (H + 13) + '" text-anchor="end">' + dataCurta(l[l.length - 1].d) + '</text></svg><div class="tip" id="tip-peso">Pontos: pesagens · linha: média de 7 dias. Toque num ponto.</div>';
  return s;
}
document.addEventListener('click', e => { const c = e.target.closest('[data-ptxt]'); if (c) { const t = $('#tip-peso'); if (t) t.textContent = c.dataset.ptxt; } });
function telaEu() {
  const p = S.perfil; const m = calcMetas();
  let h = '<div class="cartao"><div class="cab"><h2>Perfil</h2><div class="dir"><button class="btn peq ' + (p ? '' : 'pri') + '" data-acao="editarPerfil">' + (p ? 'Editar' : 'Configurar') + '</button></div></div>';
  if (p) h += '<div class="sub">' + (p.sexo === 'M' ? 'Homem' : 'Mulher') + ' · ' + p.idade + ' anos · ' + p.altura + ' cm · ' + fmt(pesoAtual(), 1) + ' kg' + (p.bf ? ' · ' + p.bf + '% gordura' : '') + '<br>' + ROTINAS[p.rotina][0] + ' · ' + OBJETIVOS[p.objetivo] + (p.objetivo !== 'manter' ? ' (' + RITMOS[p.ritmo].toLowerCase() + ')' : '') + '</div>';
  else h += '<p class="sub">Preencha para o app calcular suas metas.</p>';
  h += '<button class="btn bloco" style="margin-top:10px" data-acao="novaBio">' + (S.bio.length ? 'Nova bioimpedância · última em ' + dataCurta(bioOrdenada().pop().d) : 'Preencher pela bioimpedância') + '</button></div>';
  if (m) {
    const pc = x => Math.round(x / m.kcal * 100);
    const sug = sugestaoAjuste();
    if (sug) h += '<div class="cartao realce"><div class="cab"><h3>Sugestão de ajuste</h3></div><p class="sub">' + esc(sug.txt) + ' Sugestão: ' + (sug.delta > 0 ? '+' : '') + sug.delta + ' kcal por dia.</p><button class="btn pri" data-acao="aplicarAjuste" data-v="' + sug.delta + '">Aplicar ' + (sug.delta > 0 ? '+' : '') + sug.delta + ' kcal</button></div>';
    h += '<div class="cartao"><div class="cab"><h2>Minhas metas diárias</h2>' + (m.manual ? '<span class="tag" style="margin-left:auto">manuais</span>' : '') + '</div>' + m.avisos.map(a => '<div class="aviso">' + esc(a) + '</div>').join('') +
      '<div class="linha-flex" style="margin-bottom:10px"><div class="grande">' + fmt(m.kcal) + '</div><div class="sub">kcal por dia' + (p.ajusteKcal ? '<br><span class="mini">inclui ajuste de ' + (p.ajusteKcal > 0 ? '+' : '') + p.ajusteKcal + ' kcal</span>' : '') + '</div></div>' +
      '<div class="grade3">' + [['Proteína', m.prot, 'var(--p)', m.prot * 4], ['Carboidrato', m.carb, 'var(--c)', m.carb * 4], ['Gordura', m.gord, 'var(--g)', m.gord * 9]].map(x => '<div class="cartao" style="margin:0;padding:10px"><div class="mini"><i class="ponto" style="background:' + x[2] + '"></i>' + x[0] + '</div><div class="num" style="font-size:24px">' + x[1] + ' g</div><div class="mini">' + pc(x[3]) + '% · ' + fmt(x[1] / m.kg, 1) + ' g/kg</div></div>').join('') + '</div>' +
      '<div class="grade2" style="margin-top:10px"><div><div class="mini">Água</div><div class="num" style="font-size:20px">' + fmt(m.agua / 1000, 1) + ' L</div><div class="mini">+0,5 L em dia de treino' + (S.plantao ? ' e de plantão' : '') + '</div></div><div><div class="mini">Fibra</div><div class="num" style="font-size:20px">' + m.fibra + ' g</div></div></div>' +
      '<details style="margin-top:10px"><summary>Como foi calculado</summary><div class="mini" style="margin-top:6px;line-height:1.6">Metabolismo basal (' + (p.bf ? 'Katch-McArdle, usa % de gordura' : 'Mifflin-St Jeor') + '): <b>' + fmt(m.tmb) + ' kcal</b><br>Fator de atividade: ' + fmt(m.fator, 2) + ' (rotina + ' + fmt(sessoesSemana(), 1) + ' treinos e ' + cardioSemana() + ' cardios por semana)<br>Gasto total ' + (m.usaReal ? '<b>real</b> (pelos seus registros): <b>' + fmt(m.get) + ' kcal</b> · pela fórmula seria ' + fmt(m.getFormula) : 'estimado: <b>' + fmt(m.get) + ' kcal</b>') + '<br>Objetivo: ' + OBJETIVOS[p.objetivo] + ' ' + (AJ[p.objetivo][p.ritmo] ? (AJ[p.objetivo][p.ritmo] > 0 ? '+' : '') + Math.round(AJ[p.objetivo][p.ritmo] * 100) + '%' : '') + '<br>Proteína e gordura por kg' + (m.imc > 30 ? ' de peso de referência (' + fmt(m.refKg, 1) + ' kg, IMC acima de 30)' : ' de peso') + '; carboidrato completa as calorias.<br>Estimativas: acompanhe o peso por 2–3 semanas e ajuste.</div></details></div>';
  }
  /* opções: cada uma numa linha; os detalhes abrem numa folha */
  const linha = (acao, t, sub) => '<li data-acao="' + acao + '" style="cursor:pointer"><div class="txt"><div class="t">' + t + '</div><div class="mini">' + sub + '</div></div><span class="seta">›</span></li>';
  const P = S.plantao;
  const prox = []; if (P) for (let i = 0; i < 14 && prox.length < 3; i++) { const x = addDias(hojeISO(), i); if (ehPlantao(x)) prox.push(x); }
  let op = '';
  if (m) {
    const J = S.jejum; const r = m.real;
    op += linha('editarEstilo', 'Estilo de dieta', esc(ESTILOS[m.estilo].nome) + (J ? ' + jejum ' + esc(J.tipo) : '') + ' · C ' + m.carb + ' g · P ' + m.prot + ' g · G ' + m.gord + ' g');
    op += linha('gastoReal', 'Gasto real (pelos seus registros)', p.usarReal ? (r ? 'Ligado: ' + fmt(r.kcal) + ' kcal/dia' : 'Ligado, esperando mais dados') : (r ? 'Pronto: ' + fmt(r.kcal) + ' kcal/dia · toque para usar' : 'Ainda calculando: precisa de ~2 semanas de registros'));
    op += linha('metasManuais', 'Metas do nutricionista', m.manual ? 'Ligadas: o app usa os números que você digitou' : 'Desligadas: metas calculadas pelo perfil');
    op += linha('togEconomico', 'Dieta econômica', economico() ? 'Ligada: o cardápio usa alimentos baratos' : 'Desligada · ligue se o cardápio sugerido ficar caro');
  }
  op += linha('editarPlantao', 'Escala de plantão', P ? esc(ESCALAS[P.tipo][0]) + ' · próximos: ' + (prox.length ? prox.map(x => rotuloDia(x)).join(', ') : 'nenhum em 14 dias') : 'Não uso (12x36, 24x48…)');
  h += '<div class="cartao"><div class="cab"><h2>Opções</h2></div><ul class="lista">' + op + '</ul></div>';
  /* ajustes */
  h += '<div class="cartao"><div class="cab"><h2>Ajustes</h2></div><div class="mini" style="margin-bottom:6px">Refeições do dia</div><div class="chips" style="margin-bottom:12px">' + ORDEM_REF.map(k => '<button class="chip ' + (S.cfg.refeicoes.includes(k) ? 'on' : '') + '" data-acao="togRef" data-v="' + k + '">' + REFEICOES[k] + '</button>').join('') + '</div>' +
    '<label class="campo"><span>Tamanho do copo (ml)</span><input type="number" inputmode="numeric" id="cfgCopo" value="' + S.cfg.copo + '"></label>' +
    '<div class="chips"><button class="chip ' + (S.cfg.semSal ? 'on' : '') + '" data-acao="togSemSal">Cozinho sem sal</button></div><p class="mini" style="margin-top:6px">' + (S.cfg.semSal ? 'Ligado: arroz, feijão, carnes e outros preparos contam o sódio sem sal.' : 'Desligado: os preparos contam o sódio com sal, como a maioria das receitas. Ligue se você cozinha sem sal.') + '</p></div>';
  h += '<div class="cartao"><div class="cab"><h2>Meus dados</h2></div><p class="mini">Tudo fica só neste aparelho (navegador). ' + (S.cfg.ultimoBackup ? 'Última cópia: <b>' + dataCurta(S.cfg.ultimoBackup) + '</b>.' : '<b style="color:var(--alerta)">Nenhuma cópia feita ainda.</b>') + ' O app lembra você a cada 2 semanas.' + (armazenamentoPersistente === true ? ' Armazenamento protegido contra limpeza automática ✓' : (armazenamentoPersistente === false ? ' <span style="color:var(--alerta)">O navegador não garantiu o armazenamento: instale o app na tela inicial e exporte cópias.</span>' : '')) + '</p><div class="grade2"><button class="btn" data-acao="exportar">Exportar cópia</button><button class="btn" data-acao="importar">Importar cópia</button></div><button class="btn bloco" style="margin-top:8px" data-acao="relatorio">Resumo de 30 dias para imprimir</button>' +
    (temCopiaAntes() ? '<button class="btn bloco" style="margin-top:8px" data-acao="baixarAntes">Baixar cópia de antes da versão 1.6</button><p class="mini" style="margin-top:4px">Os seus dados como estavam antes desta atualização. Só serve se precisar voltar para a versão anterior do app (lá, use Importar cópia).</p>' : '') +
    '<button class="btn perigo bloco" style="margin-top:8px" data-acao="apagarTudo">Apagar todos os dados</button></div>';
  h += '<div class="cartao"><details><summary>Fontes e créditos</summary><div class="mini" style="margin-top:6px;line-height:1.6">Alimentos: TBCA — Tabela Brasileira de Composição de Alimentos (USP/FoRC), ' + FOODS.size.toLocaleString('pt-BR') + ' itens, valores por 100 g (os preparos "com sal" e "sem sal" com as mesmas calorias viraram um item só; o sódio segue a opção "Cozinho sem sal").<br>Exercícios: Free Exercise DB (domínio público), ' + EXS.size + ' exercícios, nomes traduzidos.<br>Gasto calórico: Compendium of Physical Activities 2024 (MET).<br>Metabolismo: Mifflin-St Jeor / Katch-McArdle. FC máx: Tanaka. 1RM: Epley. Gasto real: média ingerida − variação de peso × 7.700 kcal/kg.<br>Medidas caseiras: valores aproximados, confira com balança quando puder.<br>As metas são estimativas e não substituem nutricionista ou médico.<br>Versão ' + APP_VERSAO + '</div></details></div>';
  h += '<p class="mini" style="text-align:center;margin:4px 0 14px">Forja · versão ' + APP_VERSAO + '</p>';
  return h;
}
/* gasto real numa folha (antes era um cartão fixo em Eu) */
function corpoGastoReal(m, p) {
  const r = m.real;
  if (!r) return '<p class="sub">Registre o que come e pese-se 2–3x por semana. Com ~2 semanas de dados o app calcula seu gasto <b>de verdade</b>, sem depender de fórmula.</p>';
  const dif = r.kcal - m.getFormula;
  return '<div class="linha-flex"><div class="grande">' + fmt(r.kcal) + '</div><div class="sub">kcal/dia gastos de fato<br><span class="mini">fórmula: ' + fmt(m.getFormula) + ' (' + (dif > 0 ? '+' : '') + fmt(dif) + ')</span></div></div>' +
    '<p class="mini" style="margin-top:8px">Últimos 28 dias: você comeu em média ' + fmt(r.mediaIngerida) + ' kcal (' + r.diasComida + ' dias registrados) e o peso variou ' + (r.kgSemana > 0 ? '+' : '') + fmt(r.kgSemana, 2) + ' kg/semana (' + r.pesagens + ' pesagens). ' + (p.usarReal ? 'As metas já usam esse valor e se atualizam sozinhas; o ajuste manual fica desligado.' : 'Ligue para as metas se corrigirem sozinhas com seus dados.') + '</p>';
}
function folhaGastoReal() {
  const p = S.perfil; const m = calcMetas(); if (!p || !m) return;
  const fl = abrirFolha('<h2 style="margin-bottom:8px">Gasto real</h2>' + corpoGastoReal(m, p) +
    '<div class="grade2" style="margin-top:12px"><button class="btn" id="grF">Fechar</button>' + (m.real || p.usarReal ? '<button class="btn pri" id="grU">' + (p.usarReal ? 'Voltar para a fórmula' : 'Usar nas metas') + '</button>' : '<span></span>') + '</div>', el => {
      $('#grF', el).onclick = () => fecharFolha(fl);
      if ($('#grU', el)) $('#grU', el).onclick = () => { fecharFolha(fl); ACOES.usarReal(); };
    });
}
function folhaEstilo() {
  const p = S.perfil; let est = estiloAtual(); let jt = S.jejum ? S.jejum.tipo : ''; let jIni = S.jejum ? S.jejum.inicio : '12:00';
  const fl = abrirFolha('<h2>Estilo de dieta</h2><p class="mini" style="margin:4px 0 10px">As calorias continuam as mesmas; muda a divisão entre carboidrato e gordura. O cardápio automático passa a usar alimentos desse estilo.</p><div id="esL"></div>' +
    '<h3 style="margin:14px 0 4px">Jejum intermitente</h3><p class="mini" style="margin-bottom:8px">Combina com qualquer estilo. Muda só <b>quando</b> você come, não quanto.</p><div class="chips" id="esJ"></div><div id="esJW"></div><div id="esAv"></div>' +
    '<div class="grade2" style="margin-top:14px"><button class="btn" id="esC">Cancelar</button><button class="btn pri" id="esO">Salvar</button></div>', el => {
      const pintar = () => {
        const prev = k => { const salvo = p.estilo; p.estilo = k; const mm = calcMetas0(); p.estilo = salvo; return mm; };
        $('#esL', el).innerHTML = Object.keys(ESTILOS).map(k => { const mm = prev(k); return '<div class="tipo-c" data-es="' + k + '" style="border-color:' + (k === est ? 'var(--acento)' : 'var(--linha)') + '"><b>' + (k === est ? '● ' : '○ ') + esc(ESTILOS[k].nome) + '</b><div class="mini" style="color:var(--txt2);margin:2px 0">C ' + mm.carb + ' g · P ' + mm.prot + ' g · G ' + mm.gord + ' g</div><div class="mini">' + esc(ESTILOS[k].desc) + '</div></div>'; }).join('');
        $('#esJ', el).innerHTML = '<button class="chip ' + (!jt ? 'on' : '') + '" data-j="">Sem jejum</button>' + Object.keys(JEJUNS).map(k => '<button class="chip ' + (jt === k ? 'on' : '') + '" data-j="' + k + '">' + k + '</button>').join('');
        if (jt) {
          const comer = 24 - JEJUNS[jt][0]; const [hh, mi] = jIni.split(':').map(Number); const w = { ini: hh * 60 + mi, comerMin: comer * 60 };
          $('#esJW', el).innerHTML = '<div class="mini" style="margin:8px 0 6px">' + esc(JEJUNS[jt][1]) + ': ' + JEJUNS[jt][0] + ' h de jejum e ' + comer + ' h para comer.</div><label class="campo"><span>Primeira refeição às</span><input type="time" id="esI" value="' + jIni + '"></label><div class="info" style="margin:0">Janela: ' + hhmm(w.ini) + ' às ' + hhmm(w.ini + w.comerMin) + '. Refeições do app nesse horário: <b>' + refeicoesNaJanela(w).map(r => REFEICOES[r]).join(', ') + '</b>.</div>';
          $('#esI', el).onchange = e => { jIni = e.target.value || '12:00'; pintar(); };
        } else $('#esJW', el).innerHTML = '';
        const av = [];
        if (AVISOS_ESTILO[est]) av.push(AVISOS_ESTILO[est]);
        if (jt) av.push('Jejum não é indicado na gravidez ou amamentação, para menores de 18 anos, para quem tem ou teve transtorno alimentar, nem para quem usa insulina ou remédio que dá hipoglicemia sem acompanhamento médico. Com as mesmas calorias, o jejum emagrece parecido com comer o dia todo: vale a pena se ficar mais fácil para você.');
        $('#esAv', el).innerHTML = av.length ? '<div class="aviso" style="margin-top:12px;line-height:1.5">' + av.map(esc).join('<br><br>') + '</div>' : '';
      };
      pintar();
      $('#esL', el).onclick = e => { const c = e.target.closest('[data-es]'); if (c) { est = c.dataset.es; pintar(); } };
      $('#esJ', el).onclick = e => { const c = e.target.closest('[data-j]'); if (c) { jt = c.dataset.j; pintar(); } };
      $('#esC', el).onclick = () => fecharFolha(fl);
      $('#esO', el).onclick = () => {
        const tinha = !!S.jejum;
        p.estilo = est;
        if (jt) {
          S.jejum = { tipo: jt, inicio: jIni };
          if (!tinha) S.cfg.refeicoesAntesJejum = S.cfg.refeicoes.slice();
          S.cfg.refeicoes = refeicoesNaJanela(janelaJejum());
        } else {
          S.jejum = null;
          if (tinha && S.cfg.refeicoesAntesJejum) { S.cfg.refeicoes = S.cfg.refeicoesAntesJejum; delete S.cfg.refeicoesAntesJejum; }
        }
        salvar(); fecharFolha(fl); render();
        toast(ESTILOS[est].curto + (jt ? ' + jejum ' + jt + ' · refeições: ' + S.cfg.refeicoes.map(r => REFEICOES[r]).join(', ') : '') + '.');
      };
    });
}
function folhaPlantao() {
  const P = S.plantao || { tipo: '12x36', inicio: hojeISO(), distribuir: true };
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Escala de plantão</h2><label class="campo"><span>Escala</span><select id="plT">' + Object.keys(ESCALAS).map(k => '<option value="' + k + '"' + (k === P.tipo ? ' selected' : '') + '>' + esc(ESCALAS[k][0]) + '</option>').join('') + '</select></label>' +
    '<label class="campo" id="plIW"><span>Um dia em que você está de plantão</span><input type="date" id="plI" value="' + P.inicio + '"></label>' +
    '<label class="campo"><span>Calorias</span><select id="plD"><option value="1"' + (P.distribuir ? ' selected' : '') + '>Mais no plantão, menos na folga (mesma média)</option><option value="0"' + (P.distribuir ? '' : ' selected') + '>Iguais todos os dias</option></select></label>' +
    '<p class="mini">Para não treinar no plantão: Treino → Meu plano → Alterar configuração → Opções avançadas.</p>' +
    '<div class="grade2" style="margin-top:10px">' + (S.plantao ? '<button class="btn perigo" id="plR">Remover escala</button>' : '<button class="btn" id="plC">Cancelar</button>') + '<button class="btn pri" id="plO">Salvar</button></div>', el => {
      const vis = () => { $('#plIW', el).style.display = $('#plT', el).value === 'manual' ? 'none' : ''; }; vis();
      $('#plT', el).onchange = vis;
      if ($('#plC', el)) $('#plC', el).onclick = () => fecharFolha(fl);
      if ($('#plR', el)) $('#plR', el).onclick = async () => { if (await confirmar('Remover a escala de plantão?', 'Remover', true)) { S.plantao = null; if (S.treino) S.treino.evitarPlantao = false; salvar(); fecharFolha(fl); render(); } };
      $('#plO', el).onclick = () => {
        S.plantao = { tipo: $('#plT', el).value, inicio: $('#plI', el).value || hojeISO(), distribuir: $('#plD', el).value === '1' };
        salvar(); fecharFolha(fl); render(); toast('Escala salva.' + (S.plantao.tipo === 'manual' ? ' Marque os plantões tocando na etiqueta em Hoje.' : ''));
      };
    });
}
function folhaPerfil(pre, daBio) {
  const p = S.perfil || Object.assign({ sexo: 'M', idade: 30, altura: 175, peso: 80, bf: null, rotina: 'sentado', objetivo: 'perder', ritmo: 'moderado' }, pre || {});
  const sel = (id, obj, v) => '<select id="' + id + '">' + Object.keys(obj).map(k => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + (Array.isArray(obj[k]) ? obj[k][0] : obj[k]) + '</option>').join('') + '</select>';
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Meu perfil</h2>' + (daBio ? '<div class="info" style="margin:0 0 10px">Peso e % de gordura vieram da bioimpedância. A <b>altura foi calculada pelo IMC</b> e pode errar 1 ou 2 cm: troque pela sua altura real. Depois complete sexo, idade, rotina e objetivo e salve.</div>' : '') + '<div class="grade2"><label class="campo"><span>Sexo</span><select id="pfSexo"><option value="M"' + (p.sexo === 'M' ? ' selected' : '') + '>Masculino</option><option value="F"' + (p.sexo === 'F' ? ' selected' : '') + '>Feminino</option></select></label><label class="campo"><span>Idade</span><input type="number" inputmode="numeric" id="pfIdade" value="' + p.idade + '"></label><label class="campo"><span>Altura (cm)</span><input type="number" inputmode="numeric" id="pfAlt" value="' + p.altura + '"></label><label class="campo"><span>Peso (kg)</span><input type="number" inputmode="decimal" step="0.1" id="pfPeso" value="' + (pesoAtual() || p.peso) + '"></label></div>' +
    '<label class="campo"><span>% de gordura (opcional, de bioimpedância ou dobras)</span><input type="number" inputmode="decimal" id="pfBf" value="' + (p.bf || '') + '" placeholder="Deixe vazio se não souber"></label>' +
    '<label class="campo"><span>Rotina de trabalho</span>' + sel('pfRot', ROTINAS, p.rotina) + '</label><div class="grade2"><label class="campo"><span>Objetivo</span>' + sel('pfObj', OBJETIVOS, p.objetivo) + '</label><label class="campo"><span>Ritmo</span>' + sel('pfRit', RITMOS, p.ritmo) + '</label></div>' +
    '<details style="margin-bottom:12px"><summary>Avançado: proteína e gordura por kg</summary><div class="grade2" style="margin-top:8px"><label class="campo"><span>Proteína (g/kg)</span><input type="number" inputmode="decimal" step="0.1" id="pfPk" value="' + (p.protKg || '') + '" placeholder="automático (1,8–2,0)"></label><label class="campo"><span>Gordura (g/kg)</span><input type="number" inputmode="decimal" step="0.1" id="pfGk" value="' + (p.gordKg || '') + '" placeholder="automático (0,8–0,9)"></label></div></details>' +
    '<div class="grade2"><button class="btn" id="pfC">Cancelar</button><button class="btn pri" id="pfO">Salvar</button></div>', el => {
      $('#pfC', el).onclick = () => fecharFolha(fl);
      $('#pfO', el).onclick = () => {
        const n = {
          sexo: $('#pfSexo', el).value, idade: num($('#pfIdade', el).value), altura: num($('#pfAlt', el).value), peso: num($('#pfPeso', el).value),
          bf: num($('#pfBf', el).value), rotina: $('#pfRot', el).value, objetivo: $('#pfObj', el).value, ritmo: $('#pfRit', el).value,
          protKg: num($('#pfPk', el).value), gordKg: num($('#pfGk', el).value), ajusteKcal: p.ajusteKcal || 0, ajusteEm: p.ajusteEm || null, manual: p.manual || null, usarReal: !!p.usarReal, estilo: p.estilo || 'padrao'
        };
        if (!n.idade || n.idade < 14 || n.idade > 100 || !n.altura || n.altura < 120 || n.altura > 230 || !n.peso || n.peso < 35 || n.peso > 300) { toast('Confira idade, altura e peso.'); return; }
        if (n.bf != null && (n.bf < 3 || n.bf > 60)) { toast('% de gordura fora do normal (3–60).'); return; }
        const mudouObj = S.perfil && (S.perfil.objetivo !== n.objetivo || S.perfil.ritmo !== n.ritmo);
        if (mudouObj) { n.ajusteKcal = 0; n.ajusteEm = null; }
        S.perfil = n;
        const hj = hojeISO(); const ultimo = S.peso.find(x => x.d === hj);
        if (!S.peso.length || (pesoAtual() !== n.peso)) { if (ultimo) ultimo.kg = n.peso; else S.peso.push({ d: hj, kg: n.peso }); }
        salvar(); fecharFolha(fl); render(); toast('Perfil salvo. Metas recalculadas.');
      };
    });
}
function folhaMetasManuais() {
  const p = S.perfil; const m = calcMetas(); const mm = p.manual || {};
  const fl = abrirFolha('<h2>Metas manuais</h2><p class="mini" style="margin:4px 0 10px">Use se o seu nutricionista passou números. Campo vazio = cálculo automático (valor atual entre parênteses).</p><div class="grade2">' + [['kcal', 'Calorias'], ['prot', 'Proteína (g)'], ['carb', 'Carboidrato (g)'], ['gord', 'Gordura (g)'], ['agua', 'Água (ml)']].map(([k, t]) => '<label class="campo"><span>' + t + '</span><input type="number" inputmode="numeric" data-k="' + k + '" value="' + (mm[k] || '') + '" placeholder="(' + m[k] + ')"></label>').join('') + '</div><div class="grade2"><button class="btn" id="mmLimpar">Voltar ao automático</button><button class="btn pri" id="mmOk">Salvar</button></div>', el => {
    $('#mmLimpar', el).onclick = () => { p.manual = null; salvar(); fecharFolha(fl); render(); };
    $('#mmOk', el).onclick = () => { const n = {}; $$('[data-k]', el).forEach(i => { const v = num(i.value); if (v) n[i.dataset.k] = Math.round(v); }); p.manual = Object.keys(n).length ? n : null; salvar(); fecharFolha(fl); render(); };
  });
}
function folhaPeso() {
  const fl = abrirFolha('<h2 style="margin-bottom:10px">Registrar peso</h2><div class="grade2"><label class="campo"><span>Data</span><input type="date" id="pzD" value="' + (aba === 'eu' || aba === 'progresso' ? hojeISO() : dataSel) + '"></label><label class="campo"><span>Peso (kg)</span><input type="number" inputmode="decimal" step="0.1" id="pzK" value="' + (pesoAtual() || '') + '"></label></div><p class="mini">Dica: pese-se de manhã, em jejum, depois do banheiro. Oscilações de 0,5–1 kg num dia são normais (água, sal, intestino); vale a média.</p><div class="grade2"><button class="btn" id="pzCanc">Cancelar</button><button class="btn pri" id="pzOk">Salvar</button></div>', el => {
    $('#pzCanc', el).onclick = () => fecharFolha(fl);
    $('#pzOk', el).onclick = () => {
      const d = $('#pzD', el).value, kg = num($('#pzK', el).value);
      if (!d || !kg || kg < 30 || kg > 300) { toast('Confira data e peso.'); return; }
      const ex = S.peso.find(x => x.d === d); if (ex) ex.kg = kg; else S.peso.push({ d, kg });
      if (S.perfil) S.perfil.peso = pesoAtual();
      salvar(); fecharFolha(fl); render(); toast('Peso salvo. Metas atualizadas com o novo peso.');
    };
  });
}

/* ===================== CORPO: fotos de antes e depois, medidas e peso ===================== */
const POSES = { frente: 'Frente', lado: 'Lado', costas: 'Costas', outra: 'Outra' };
const MED_CORPO = [['cintura', 'Cintura', 'cm', -1], ['abdomen', 'Abdômen (umbigo)', 'cm', -1], ['quadril', 'Quadril', 'cm', 0], ['peito', 'Peito', 'cm', 0], ['braco', 'Braço contraído', 'cm', 1], ['coxa', 'Coxa', 'cm', 0], ['panturrilha', 'Panturrilha', 'cm', 0], ['bf', '% de gordura', '%', -1]];
let cmp = { pose: 'frente', a: null, b: null, modo: 'lado' };
let medSel = 'cintura';

/* as fotos ficam no IndexedDB (cabe muito mais que o localStorage); em S fica só a lista */
let _fdb = null;
function fotoDB() {
  if (!_fdb) _fdb = new Promise((res, rej) => { const r = indexedDB.open('forja_fotos', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return _fdb;
}
function fotoOp(modo, fn) { return fotoDB().then(db => new Promise((res, rej) => { const t = db.transaction('img', modo); const q = fn(t.objectStore('img')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); })); }
const fotoPut = (k, b) => fotoOp('readwrite', st => st.put(b, k));
const fotoGet = k => fotoOp('readonly', st => st.get(k)).then(x => x || null);
const fotoDel = k => fotoOp('readwrite', st => st.delete(k));
const fotoLimpar = () => fotoOp('readwrite', st => st.clear());
const _urls = new Map();
async function fotoURL(id, mini) {
  const k = (mini ? 't:' : 'f:') + id; if (_urls.has(k)) return _urls.get(k);
  const b = await fotoGet(k); if (!b) return null; const u = URL.createObjectURL(b); _urls.set(k, u); return u;
}
function hidratarFotos(raiz) {
  $$('img[data-foto]', raiz || document).forEach(async im => {
    if (im.dataset.ok) return; im.dataset.ok = '1';
    const u = await fotoURL(im.dataset.foto, im.dataset.mini === '1').catch(() => null);
    if (u) im.src = u; else { const b = im.closest('.fotobox'); if (b) b.classList.add('sem'); }
  });
}
function imgFoto(id, mini, cls) { return '<img data-foto="' + esc(id) + '" data-mini="' + (mini ? 1 : 0) + '"' + (cls ? ' class="' + cls + '"' : '') + ' alt="">'; }
function abrirImagem(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Imagem inválida')); im.src = u; }); }
function reduzir(im, max, q) {
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, 'image/jpeg', q));
}
async function guardarFoto(file, d, pose) {
  const im = await abrirImagem(file);
  const [full, mini] = [await reduzir(im, 1440, 0.82), await reduzir(im, 360, 0.72)];
  URL.revokeObjectURL(im.src);
  const id = 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await fotoPut('f:' + id, full); await fotoPut('t:' + id, mini);
  S.fotos.push({ id, d, pose }); return id;
}
async function apagarFoto(id) {
  S.fotos = S.fotos.filter(f => f.id !== id);
  ['f:', 't:'].forEach(p => { const u = _urls.get(p + id); if (u) URL.revokeObjectURL(u); _urls.delete(p + id); });
  if (cmp.a === id) cmp.a = null; if (cmp.b === id) cmp.b = null;
  await fotoDel('f:' + id).catch(() => { }); await fotoDel('t:' + id).catch(() => { });
}
/* peso e medidas mais próximos de uma data (até 5 dias de distância) */
function pesoEm(d) { let m = null; S.peso.forEach(x => { const k = Math.abs(diffDias(x.d, d)); if (k <= 5 && (!m || k < m.k)) m = { k, kg: x.kg }; }); return m ? m.kg : null; }
function serieMedida(k) {
  const l = S.medidas.filter(x => x[k] != null).map(x => ({ d: x.d, v: x[k] }));
  return l.sort((a, b) => a.d < b.d ? -1 : 1);
}
function medidaEm(k, d) { let m = null; serieMedida(k).forEach(x => { const q = Math.abs(diffDias(x.d, d)); if (q <= 7 && (!m || q < m.q)) m = { q, v: x.v }; }); return m ? m.v : null; }
function sessoesFotos() {
  const g = {}; S.fotos.forEach(f => { (g[f.d] = g[f.d] || []).push(f); });
  return Object.keys(g).sort().reverse().map(d => ({ d, fotos: g[d].sort((a, b) => Object.keys(POSES).indexOf(a.pose) - Object.keys(POSES).indexOf(b.pose)) }));
}
function diasDesdeFoto() { if (!S.fotos.length) return null; const u = S.fotos.map(f => f.d).sort().pop(); return diffDias(u, hojeISO()); }

/* ===================== PROGRESSO: semana, peso, medidas, fotos, cargas, sono e água ===================== */
function telaProgresso() {
  const sub = [['semana', 'Semana'], ['peso', 'Peso'], ['bio', 'Bioimpedância'], ['medidas', 'Medidas'], ['fotos', 'Fotos'], ['cargas', 'Cargas'], ['sono', 'Sono e água']];
  if (!sub.some(x => x[0] === subProg)) subProg = 'semana';
  const h = '<div class="rolax" style="margin-bottom:12px">' + sub.map(([k, t]) => '<button class="chip ' + (subProg === k ? 'on' : '') + '" data-acao="subProg" data-v="' + k + '">' + t + '</button>').join('') + '</div>';
  if (subProg === 'peso') return h + telaPeso();
  if (subProg === 'bio') return h + telaBio();
  if (subProg === 'medidas') return h + telaMedidas();
  if (subProg === 'fotos') return h + telaFotos();
  if (subProg === 'cargas') return h + telaEvolucao();
  if (subProg === 'sono') return h + telaSonoAgua();
  return h + telaSemana();
}
function telaSemana() {
  const hj = hojeISO(); const dias7 = ultimos7(hj);
  if (!S.perfil) return '<div class="cartao realce"><h2>Resumo da semana</h2><p class="sub">Preencha o perfil para o app calcular as metas e montar o resumo.</p><button class="btn pri bloco" data-acao="editarPerfil">Preencher perfil</button></div>';
  let h = resumoSemana(hj);
  const md = metaDia(hj);
  h += '<div class="cartao"><div class="cab"><h3>Calorias · últimos 7 dias</h3></div>' + grafBarras(dias7.map(x => totaisDia(x).kcal), dias7.map(x => DSEM[diaSemana(x)]), md ? md.kcal : 0, 'var(--acento)', 'kcal', 'kcal7') + '</div>';
  h += '<div class="cartao"><div class="cab"><h3>Resumo para imprimir</h3></div><p class="sub">Uma página com os últimos 30 dias (calorias, proteína, treinos, água, sono e peso) para levar ao nutricionista ou ao médico. Dá para salvar em PDF.</p><button class="btn bloco" data-acao="relatorio">Gerar o resumo</button></div>';
  return h;
}
function resumoPeriodo(a, b) {
  const dias = diffDias(a.d, b.d); const pa = pesoEm(a.d), pb = pesoEm(b.d); const ca = medidaEm('cintura', a.d), cb = medidaEm('cintura', b.d);
  const partes = [dias + ' dias' + (dias >= 14 ? ' (' + fmt(dias / 7, 0) + ' semanas)' : '')];
  if (pa != null && pb != null) partes.push('peso ' + (pb - pa > 0 ? '+' : '') + fmt(pb - pa, 1) + ' kg');
  if (ca != null && cb != null) partes.push('cintura ' + (cb - ca > 0 ? '+' : '') + fmt(cb - ca, 1) + ' cm');
  return partes.join(' · ');
}
function telaFotos() {
  let h = '';
  const porPose = p => S.fotos.filter(f => f.pose === p).sort((a, b) => a.d < b.d ? -1 : (a.d > b.d ? 1 : 0));
  const poses = Object.keys(POSES).filter(p => porPose(p).length);
  /* comparação antes e depois */
  if (poses.length) {
    if (!poses.includes(cmp.pose)) cmp.pose = poses[0];
    const l = porPose(cmp.pose);
    let A = l.find(f => f.id === cmp.a) || l[0], B = l.find(f => f.id === cmp.b) || l[l.length - 1];
    if (A.d > B.d) [A, B] = [B, A];
    h += '<div class="cartao"><div class="cab"><h2>Antes e depois</h2></div><div class="chips" style="margin-bottom:10px">' + poses.map(p => '<button class="chip ' + (p === cmp.pose ? 'on' : '') + '" data-acao="cmpPose" data-v="' + p + '">' + POSES[p] + ' (' + porPose(p).length + ')</button>').join('') + '</div>';
    if (l.length < 2) h += '<div class="lado2">' + caixaCmp(A, 'Antes') + '<div class="fotobox vaga"><div class="vaga-t">Tire outra foto de <b>' + POSES[cmp.pose].toLowerCase() + '</b> daqui a algumas semanas para comparar</div></div></div>';
    else {
      h += '<div class="chips" style="margin-bottom:8px"><button class="chip ' + (cmp.modo === 'lado' ? 'on' : '') + '" data-acao="cmpModo" data-v="lado">Lado a lado</button><button class="chip ' + (cmp.modo === 'desliza' ? 'on' : '') + '" data-acao="cmpModo" data-v="desliza">Deslizar</button></div>';
      if (cmp.modo === 'desliza') h += '<div class="desliza fotobox" id="dsl">' + imgFoto(B.id, false) + '<div class="camada" id="dslTopo">' + imgFoto(A.id, false) + '</div><div class="linha" id="dslLinha"></div></div><input type="range" id="dslR" min="0" max="100" value="50" aria-label="Deslizar entre antes e depois" style="width:100%;margin-top:8px"><div class="lin mini" style="display:flex;justify-content:space-between"><span>◀ Antes · ' + dataCurta(A.d) + (pesoEm(A.d) != null ? ' · ' + fmt(pesoEm(A.d), 1) + ' kg' : '') + '</span><span>Depois · ' + dataCurta(B.d) + (pesoEm(B.d) != null ? ' · ' + fmt(pesoEm(B.d), 1) + ' kg' : '') + ' ▶</span></div>';
      else h += '<div class="lado2">' + caixaCmp(A, 'Antes') + caixaCmp(B, 'Depois') + '</div>';
      h += '<div class="info" style="margin:10px 0 0">' + esc(resumoPeriodo(A, B)) + '</div>';
      h += '<div class="grade2" style="margin-top:10px"><button class="btn" data-acao="cmpTrocar" data-a="' + A.id + '" data-b="' + B.id + '">Escolher fotos</button><button class="btn pri" data-acao="cmpCompartilhar" data-a="' + A.id + '" data-b="' + B.id + '">Salvar imagem</button></div>';
    }
    h += '</div>';
  }
  /* nova sessão */
  const dd = diasDesdeFoto();
  h += '<div class="cartao' + (S.fotos.length ? '' : ' realce') + '"><div class="cab"><h2>Minhas fotos</h2><div class="dir"><button class="btn peq pri" data-acao="novaSessaoFotos">+ Fotos</button></div></div>' +
    (S.fotos.length ? '<div class="mini">' + S.fotos.length + ' fotos em ' + sessoesFotos().length + ' registros · última há ' + (dd === 0 ? 'menos de 1 dia' : dd + ' dia' + (dd > 1 ? 's' : '')) + (dd >= 28 ? ' · <b style="color:var(--acento)">hora de uma nova!</b>' : '') + '</div>' : '<p class="sub">Tire 3 fotos (frente, lado e costas) agora e repita a cada 2–4 semanas. Elas mostram o que a balança não mostra.</p>') +
    '<details style="margin-top:8px"><summary class="mini">Como tirar fotos que dá para comparar</summary><div class="mini" style="margin-top:6px;line-height:1.6">Mesmo lugar, mesma luz e mesmo horário (de manhã, em jejum, é o ideal) · mesma roupa · celular na altura do umbigo e na mesma distância (use o timer ou peça ajuda) · corpo relaxado, braços soltos · uma de frente, uma de lado e uma de costas.</div></details></div>';
  /* galeria */
  sessoesFotos().forEach(ses => {
    const kg = pesoEm(ses.d); const nota = S.notasCorpo[ses.d];
    h += '<div class="cartao"><div class="cab"><h3>' + dataCurta(ses.d) + '</h3><span class="mini">' + (kg != null ? fmt(kg, 1) + ' kg' : '') + '</span><div class="dir"><button class="ic" data-acao="editarSessao" data-d="' + ses.d + '" aria-label="Editar registro">' + IC.editar + '</button></div></div>' +
      (nota ? '<div class="mini" style="margin:-4px 0 8px;color:var(--txt2)">“' + esc(nota) + '”</div>' : '') +
      '<div class="fotos-grid">' + ses.fotos.map(f => '<div class="fotobox" data-acao="verFoto" data-id="' + f.id + '">' + imgFoto(f.id, true) + '<span class="rot">' + POSES[f.pose] + '</span></div>').join('') + '</div></div>';
  });
  if (S.fotos.length) h += '<div class="cartao"><div class="mini">As fotos ficam só neste aparelho e <b>não</b> vão na cópia de segurança normal (para ela continuar leve). Guarde-as à parte:</div><div class="grade2" style="margin-top:8px"><button class="btn" data-acao="exportarFotos">Exportar fotos</button><button class="btn" data-acao="importarFotos">Importar fotos</button></div></div>';
  else h += '<div class="cartao"><button class="btn bloco fant" data-acao="importarFotos">Importar fotos de outra cópia</button></div>';
  return h;
}
function caixaCmp(f, rot) { const kg = pesoEm(f.d); return '<div class="fotobox" data-acao="verFoto" data-id="' + f.id + '">' + imgFoto(f.id, false) + '<span class="rot">' + rot + ' · ' + dataCurta(f.d) + (kg != null ? ' · ' + fmt(kg, 1) + ' kg' : '') + '</span></div>'; }

function folhaSessaoFotos(d0) {
  const editando = !!d0; let d = d0 || hojeISO();
  const novas = {}; /* pose -> File */
  const fl = abrirFolha('<h2 style="margin-bottom:10px">' + (editando ? 'Registro de ' + dataCurta(d) : 'Fotos de progresso') + '</h2>' +
    '<label class="campo"><span>Data</span><input type="date" id="sfD" value="' + d + '"' + (editando ? ' disabled' : '') + '></label>' +
    '<div class="fotos-grid" id="sfG"></div><p class="mini" style="margin-top:6px">Toque num quadro para tirar a foto ou escolher da galeria.</p>' +
    '<label class="campo" style="margin-top:8px"><span>Anotação (opcional)</span><input type="text" id="sfN" maxlength="140" placeholder="Ex.: fim do 1º mês, sem inchaço" value="' + esc(S.notasCorpo[d] || '') + '"></label>' +
    '<div class="grade2"><button class="btn" id="sfC">Cancelar</button><button class="btn pri" id="sfO">Salvar</button></div>', el => {
      const pintar = () => {
        $('#sfG', el).innerHTML = Object.keys(POSES).map(p => {
          const ex = S.fotos.find(f => f.d === d && f.pose === p);
          const prev = novas[p] ? '<img src="' + novas[p].url + '" alt="">' : (ex ? imgFoto(ex.id, true) : '');
          return '<label class="fotobox slot' + (prev ? ' cheio' : '') + '">' + prev + '<span class="' + (prev ? 'rot' : 'slot-t') + '">' + (prev ? POSES[p] + ' ✎' : '+ ' + POSES[p]) + '</span><input type="file" accept="image/*" data-pose="' + p + '" hidden></label>';
        }).join('');
        hidratarFotos(el);
      };
      pintar();
      $('#sfG', el).addEventListener('change', e => { const i = e.target.closest('input[data-pose]'); if (!i || !i.files[0]) return; const p = i.dataset.pose; if (novas[p]) URL.revokeObjectURL(novas[p].url); novas[p] = { file: i.files[0], url: URL.createObjectURL(i.files[0]) }; pintar(); });
      if (!editando) $('#sfD', el).onchange = () => { d = $('#sfD', el).value || hojeISO(); $('#sfN', el).value = S.notasCorpo[d] || ''; pintar(); };
      $('#sfC', el).onclick = () => fecharFolha(fl);
      $('#sfO', el).onclick = async () => {
        const ps = Object.keys(novas); const nota = $('#sfN', el).value.trim();
        if (!ps.length && !S.fotos.some(f => f.d === d)) { toast('Adicione pelo menos uma foto.'); return; }
        const b = $('#sfO', el); b.disabled = true; b.textContent = 'Salvando…';
        try {
          for (const p of ps) { const ant = S.fotos.find(f => f.d === d && f.pose === p); if (ant) await apagarFoto(ant.id); await guardarFoto(novas[p].file, d, p); }
          if (nota) S.notasCorpo[d] = nota; else delete S.notasCorpo[d];
          salvar(); fecharFolha(fl); render(); toast(ps.length ? ps.length + ' foto(s) salvas.' : 'Registro atualizado.');
        } catch (er) { console.error(er); b.disabled = false; b.textContent = 'Salvar'; toast('Não consegui salvar a foto. Tente outra imagem.'); }
      };
    });
  fl._aoFechar = () => Object.values(novas).forEach(n => URL.revokeObjectURL(n.url));
}
function folhaVerFoto(id) {
  const f = S.fotos.find(x => x.id === id); if (!f) return; const kg = pesoEm(f.d);
  const fl = abrirFolha('<div class="fotobox grande-f">' + imgFoto(id, false) + '</div><div class="cab" style="margin-top:10px"><h3>' + POSES[f.pose] + ' · ' + dataCurta(f.d) + '</h3><span class="mini">' + (kg != null ? fmt(kg, 1) + ' kg' : '') + '</span></div>' +
    '<div class="grade2"><button class="btn" data-op="a">Usar como “antes”</button><button class="btn" data-op="b">Usar como “depois”</button></div><div class="grade2" style="margin-top:8px"><button class="btn perigo" data-op="del">Excluir</button><button class="btn" data-op="x">Fechar</button></div>', el => {
      hidratarFotos(el);
      el.onclick = async e => {
        const b = e.target.closest('[data-op]'); if (!b) return; const op = b.dataset.op;
        if (op === 'x') return fecharFolha(fl);
        if (op === 'a' || op === 'b') { cmp.pose = f.pose; cmp[op] = id; subProg = 'fotos'; fecharFolha(fl); render(); window.scrollTo(0, 0); return; }
        if (op === 'del' && await confirmar('Excluir esta foto? Não dá para desfazer.', 'Excluir', true)) { await apagarFoto(id); salvar(); fecharFolha(fl); render(); }
      };
    });
}
function folhaEscolherCmp(aId, bId) {
  const l = S.fotos.filter(f => f.pose === cmp.pose).sort((x, y) => x.d < y.d ? -1 : 1);
  let sa = aId, sb = bId;
  const fl = abrirFolha('<h2>Escolher fotos · ' + POSES[cmp.pose] + '</h2><p class="mini" style="margin:4px 0 10px">Toque uma vez para “antes” e outra foto para “depois”.</p><div class="fotos-grid" id="ecG"></div><div class="grade2" style="margin-top:12px"><button class="btn" id="ecX">Cancelar</button><button class="btn pri" id="ecO">Comparar</button></div>', el => {
    let vez = 'a';
    const pintar = () => { $('#ecG', el).innerHTML = l.map(f => '<div class="fotobox' + (f.id === sa ? ' sel-a' : '') + (f.id === sb ? ' sel-b' : '') + '" data-id="' + f.id + '">' + imgFoto(f.id, true) + '<span class="rot">' + (f.id === sa ? 'Antes · ' : f.id === sb ? 'Depois · ' : '') + dataCurta(f.d) + '</span></div>').join(''); hidratarFotos(el); };
    pintar();
    $('#ecG', el).onclick = e => { const c = e.target.closest('[data-id]'); if (!c) return; if (vez === 'a') { sa = c.dataset.id; vez = 'b'; } else { sb = c.dataset.id; vez = 'a'; } pintar(); };
    $('#ecX', el).onclick = () => fecharFolha(fl);
    $('#ecO', el).onclick = () => { if (sa === sb) { toast('Escolha duas fotos diferentes.'); return; } cmp.a = sa; cmp.b = sb; fecharFolha(fl); render(); };
  });
}
/* monta uma imagem única (antes | depois) para guardar ou mandar */
async function imagemComparacao(aId, bId) {
  const A = S.fotos.find(f => f.id === aId), B = S.fotos.find(f => f.id === bId);
  const carregar = u => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
  const [ia, ib] = await Promise.all([fotoURL(aId), fotoURL(bId)].map(p => p.then(u => { if (!u) throw new Error('sem foto'); return carregar(u); })));
  const CW = 540, CH = 720, BAR = 120, c = document.createElement('canvas'); c.width = CW * 2; c.height = CH + BAR;
  const g = c.getContext('2d'); g.fillStyle = '#0E1012'; g.fillRect(0, 0, c.width, c.height);
  const cobrir = (im, x) => { const r = Math.max(CW / im.naturalWidth, CH / im.naturalHeight); const w = CW / r, h = CH / r; g.drawImage(im, (im.naturalWidth - w) / 2, (im.naturalHeight - h) / 2, w, h, x, 0, CW, CH); };
  cobrir(ia, 0); cobrir(ib, CW); g.fillStyle = '#0E1012'; g.fillRect(CW - 2, 0, 4, CH);
  const etiqueta = (t, x) => { g.font = '700 30px system-ui, sans-serif'; const w = g.measureText(t).width + 28; g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(x + 16, 16, w, 48); g.fillStyle = '#fff'; g.fillText(t, x + 30, 51); };
  etiqueta('ANTES', 0); etiqueta('DEPOIS', CW);
  g.fillStyle = '#ECEFF1'; g.font = '600 30px system-ui, sans-serif';
  const pa = pesoEm(A.d), pb = pesoEm(B.d);
  g.fillText(dataCurta(A.d) + (pa != null ? ' · ' + fmt(pa, 1) + ' kg' : ''), 24, CH + 46); g.fillText(dataCurta(B.d) + (pb != null ? ' · ' + fmt(pb, 1) + ' kg' : ''), CW + 24, CH + 46);
  g.fillStyle = '#C6F432'; g.font = '700 28px system-ui, sans-serif'; g.fillText(resumoPeriodo(A, B), 24, CH + 94);
  g.fillStyle = '#6E7780'; g.font = '700 22px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('FORJA', c.width - 24, CH + 94);
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
}
async function compartilharComparacao(aId, bId) {
  try {
    const blob = await imagemComparacao(aId, bId); const nome = 'forja-antes-depois-' + hojeISO() + '.jpg';
    const file = new File([blob], nome, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Antes e depois' }).catch(() => { }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Imagem salva.');
  } catch (e) { console.error(e); toast('Não consegui montar a imagem.'); }
}
async function exportarFotos() {
  if (!S.fotos.length) return;
  toast('Preparando as fotos…');
  const lerURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  const out = { tipo: 'forja-fotos', versao: 1, data: hojeISO(), notas: S.notasCorpo, fotos: [] };
  for (const f of S.fotos) { const b = await fotoGet('f:' + f.id); if (b) out.fotos.push(Object.assign({}, f, { img: await lerURL(b) })); }
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forja-fotos-' + hojeISO() + '.json'; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast(out.fotos.length + ' fotos exportadas (' + fmt(blob.size / 1048576, 1) + ' MB).');
}
async function importarFotos(o) {
  let n = 0;
  for (const f of o.fotos || []) {
    if (!f.id || !f.img || !POSES[f.pose] || !/^\d{4}-\d\d-\d\d$/.test(f.d)) continue;
    const blob = await (await fetch(f.img)).blob();
    const im = await abrirImagem(blob); const mini = await reduzir(im, 360, 0.72); URL.revokeObjectURL(im.src);
    await fotoPut('f:' + f.id, blob); await fotoPut('t:' + f.id, mini);
    if (!S.fotos.some(x => x.id === f.id)) S.fotos.push({ id: f.id, d: f.d, pose: f.pose });
    ['f:', 't:'].forEach(p => _urls.delete(p + f.id)); n++;
  }
  Object.assign(S.notasCorpo, o.notas || {});
  salvar(); render(); toast(n + ' fotos importadas.');
}

/* ---- medidas ---- */
function telaMedidas() {
  let h = '<div class="cartao"><div class="cab"><h2>Medidas</h2><div class="dir"><button class="btn peq pri" data-acao="novasMedidas">+ Registrar</button></div></div>';
  const comDado = MED_CORPO.filter(m => serieMedida(m[0]).length);
  if (!comDado.length) return h + '<p class="sub">A fita métrica mostra o que a balança esconde: dá para perder cintura e ganhar braço com o mesmo peso. Meça a cada 2–4 semanas.</p></div>' + dicaMedir();
  h += '<div class="grade2 tiles">' + comDado.map(m => {
    const l = serieMedida(m[0]); const ult = l[l.length - 1], pri = l[0]; const dv = ult.v - pri.v;
    const bom = m[3] === 0 || Math.abs(dv) < 0.05 ? null : (Math.sign(dv) === m[3]);
    return '<div class="tile' + (m[0] === medSel ? ' sel' : '') + '" data-acao="medSel" data-v="' + m[0] + '"><div class="mini">' + m[1] + '</div><div class="num" style="font-size:20px">' + fmt(ult.v, 1) + ' <span class="mini">' + m[2] + '</span></div><div class="mini" style="color:' + (bom === null ? 'var(--txt3)' : bom ? 'var(--ok)' : 'var(--alerta)') + '">' + (l.length > 1 ? (dv > 0 ? '+' : '') + fmt(dv, 1) + ' desde ' + dataCurta(pri.d) : 'primeiro registro') + '</div></div>';
  }).join('') + '</div>';
  if (!comDado.some(m => m[0] === medSel)) medSel = comDado[0][0];
  const mm = MED_CORPO.find(m => m[0] === medSel);
  h += '<div style="margin-top:12px"><div class="mini" style="margin-bottom:4px">' + mm[1] + ' (' + mm[2] + ') · toque num quadro acima para trocar</div>' + grafSerie(serieMedida(medSel), mm[2]) + '</div></div>';
  const hist = S.medidas.slice().sort((a, b) => a.d < b.d ? 1 : -1);
  if (hist.length) h += '<div class="cartao"><div class="cab"><h3>Histórico</h3></div><ul class="lista">' + hist.map(x => '<li data-acao="editarMedidas" data-d="' + x.d + '"><div class="txt"><div class="t">' + dataCurta(x.d) + '</div><div class="mini">' + MED_CORPO.filter(m => x[m[0]] != null).map(m => m[1].split(' ')[0] + ' ' + fmt(x[m[0]], 1)).join(' · ') + '</div></div><div class="val">' + IC.editar + '</div></li>').join('') + '</ul></div>';
  return h + dicaMedir();
}
function dicaMedir() {
  return '<div class="cartao"><details><summary class="mini">Como medir certo</summary><div class="mini" style="margin-top:6px;line-height:1.6">De manhã, antes de comer, sempre do mesmo lado do corpo. Fita firme sem apertar a pele, paralela ao chão.<br><b>Cintura:</b> parte mais fina do tronco · <b>Abdômen:</b> na linha do umbigo, relaxado · <b>Quadril:</b> parte mais larga do bumbum · <b>Peito:</b> na linha dos mamilos · <b>Braço:</b> maior ponto, contraído · <b>Coxa:</b> maior ponto, em pé · <b>Panturrilha:</b> maior ponto.</div></details></div>';
}
function grafSerie(l, un) {
  if (l.length < 2) return '<div class="mini">Registre pelo menos 2 vezes para ver o gráfico.</div>';
  const W = 320, H = 120, pe = 16, mE = 34; const v = l.map(x => x.v); let mn = Math.min(...v), mx = Math.max(...v); if (mx - mn < 2) { mn -= 1; mx += 1; }
  const d0 = l[0].d, dt = Math.max(1, diffDias(d0, l[l.length - 1].d));
  const X = d => mE + (W - mE - 6) * diffDias(d0, d) / dt, Y = y => 6 + (H - 12) * (1 - (y - mn) / (mx - mn));
  return '<svg class="graf" viewBox="0 0 ' + W + ' ' + (H + pe) + '" role="img" aria-label="Evolução da medida">' + [mn, (mn + mx) / 2, mx].map(y => '<line x1="' + mE + '" x2="' + W + '" y1="' + Y(y) + '" y2="' + Y(y) + '" stroke="#22272b"/><text x="' + (mE - 4) + '" y="' + (Y(y) + 3) + '" text-anchor="end">' + fmt(y, 1) + '</text>').join('') +
    '<path d="' + l.map((x, i) => (i ? 'L' : 'M') + X(x.d).toFixed(1) + ' ' + Y(x.v).toFixed(1)).join('') + '" fill="none" stroke="var(--acento)" stroke-width="2" stroke-linejoin="round"/>' + l.map(x => '<circle cx="' + X(x.d) + '" cy="' + Y(x.v) + '" r="3.5" fill="var(--acento)"/>').join('') +
    '<text x="' + mE + '" y="' + (H + 13) + '">' + dataCurta(l[0].d) + '</text><text x="' + W + '" y="' + (H + 13) + '" text-anchor="end">' + dataCurta(l[l.length - 1].d) + '</text></svg>';
}
function folhaMedidas(d0) {
  const d = d0 || hojeISO(); const ex = S.medidas.find(x => x.d === d) || {};
  const ult = {}; MED_CORPO.forEach(m => { const l = serieMedida(m[0]).filter(x => x.d < d); if (l.length) ult[m[0]] = l[l.length - 1].v; });
  const fl = abrirFolha('<h2 style="margin-bottom:10px">' + (d0 ? 'Medidas de ' + dataCurta(d) : 'Registrar medidas') + '</h2><label class="campo"><span>Data</span><input type="date" id="mdD" value="' + d + '"' + (d0 ? ' disabled' : '') + '></label><div class="grade2">' +
    MED_CORPO.map(m => '<label class="campo"><span>' + m[1] + ' (' + m[2] + ')</span><input type="number" inputmode="decimal" step="0.1" data-m="' + m[0] + '" value="' + (ex[m[0]] != null ? ex[m[0]] : '') + '" placeholder="' + (ult[m[0]] != null ? 'antes: ' + fmt(ult[m[0]], 1) : '') + '"></label>').join('') +
    '</div><p class="mini">Preencha só o que mediu. O campo cinza mostra a última medida.</p><div class="grade2" style="margin-top:10px">' + (d0 ? '<button class="btn perigo" id="mdR">Excluir</button>' : '<button class="btn" id="mdC">Cancelar</button>') + '<button class="btn pri" id="mdO">Salvar</button></div>', el => {
      if ($('#mdC', el)) $('#mdC', el).onclick = () => fecharFolha(fl);
      if ($('#mdR', el)) $('#mdR', el).onclick = async () => { if (await confirmar('Excluir as medidas de ' + dataCurta(d) + '?', 'Excluir', true)) { S.medidas = S.medidas.filter(x => x.d !== d); salvar(); fecharFolha(fl); render(); } };
      $('#mdO', el).onclick = () => {
        const dd = $('#mdD', el).value; if (!dd) { toast('Escolha a data.'); return; }
        const n = { d: dd }; let k = 0; let ruim = false;
        $$('[data-m]', el).forEach(i => { const v = num(i.value); if (v != null) { if (v <= 0 || v > 250 || (i.dataset.m === 'bf' && (v < 3 || v > 60))) ruim = true; n[i.dataset.m] = v; k++; } });
        if (ruim) { toast('Algum valor está fora do normal. Confira.'); return; }
        if (!k) { toast('Preencha pelo menos uma medida.'); return; }
        S.medidas = S.medidas.filter(x => x.d !== dd).concat(n);
        if (n.bf != null && S.perfil && dd >= (S.medidas.filter(x => x.bf != null && x.d !== dd).map(x => x.d).sort().pop() || '')) S.perfil.bf = n.bf;
        salvar(); fecharFolha(fl); render(); toast('Medidas salvas.' + (n.bf != null && S.perfil ? ' % de gordura atualizado no perfil.' : ''));
      };
    });
}
/* ---- bioimpedância: os números da balança; atualizam peso, % de gordura e o perfil ---- */
/* [chave, nome, unidade, melhor (-1 menor, 1 maior, 0 tanto faz), principal, mínimo, máximo], na ordem da tela da balança */
const BIO = [
  ['peso', 'Peso', 'kg', 0, 1, 30, 300], ['imc', 'IMC', '', -1, 1, 10, 80], ['gord', 'Gordura corporal', '%', -1, 1, 3, 75],
  ['musc', 'Taxa muscular', '%', 1, 0, 10, 95], ['magra', 'Massa corporal magra', 'kg', 1, 1, 20, 160], ['subcut', 'Gordura subcutânea', '%', -1, 0, 1, 70],
  ['visceral', 'Gordura visceral', '', -1, 1, 1, 60], ['agua', 'Água corporal', '%', 1, 0, 20, 80], ['esq', 'Músculo esquelético', '%', 1, 0, 10, 75],
  ['massaMusc', 'Massa muscular', 'kg', 1, 1, 15, 160], ['ossea', 'Massa óssea', 'kg', 0, 0, 1, 10], ['prot', 'Proteína', '%', 1, 0, 5, 30],
  ['tmb', 'TMB (metabolismo basal)', 'kcal', 0, 0, 700, 4500], ['idadeCorpo', 'Idade do corpo', 'anos', -1, 0, 10, 110], ['massaGorda', 'Massa gorda', 'kg', -1, 0, 1, 200],
  ['pesoAgua', 'Peso da água', 'kg', 0, 0, 10, 160], ['massaProt', 'Massa de proteína', 'kg', 1, 0, 2, 45], ['ideal', 'Peso corporal ideal', 'kg', 0, 0, 30, 200]
];
/* esquerdo/direito como a balança marca (L e R), sem reinterpretar a figura */
const SEGS = [['be', 'Braço esq. (L)'], ['bd', 'Braço dir. (R)'], ['tr', 'Tronco'], ['pe', 'Perna esq. (L)'], ['pd', 'Perna dir. (R)']];
let bioSel = 'gord';
const fmtN = v => (v == null || isNaN(v)) ? '–' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
function bioOrdenada() { return S.bio.slice().sort((a, b) => a.d < b.d ? -1 : 1); }
/* faixas gerais de adultos (a da balança pode ser um pouco diferente) */
function faixaBio(k, v) {
  if (v == null) return null; const F = S.perfil && S.perfil.sexo === 'F';
  if (k === 'imc') return v < 18.5 ? ['abaixo', 'alerta'] : v < 25 ? ['normal', 'ok'] : v < 30 ? ['sobrepeso', 'alerta'] : ['obesidade', 'erro'];
  /* gordura: faixas de Gallagher (2000) por sexo e idade do perfil: 20–39, 40–59 e 60+ anos */
  if (k === 'gord') { const id = S.perfil ? S.perfil.idade : 30; const [a, b, c] = F ? (id < 40 ? [21, 33, 39] : id < 60 ? [23, 34, 40] : [24, 36, 42]) : (id < 40 ? [8, 20, 25] : id < 60 ? [11, 22, 28] : [13, 25, 30]); return v < a ? ['baixa', 'alerta'] : v < b ? ['normal', 'ok'] : v < c ? ['alta', 'alerta'] : ['muito alta', 'erro']; }
  if (k === 'visceral') return v < 10 ? ['normal', 'ok'] : v < 15 ? ['alta', 'alerta'] : ['muito alta', 'erro'];
  if (k === 'agua') { const [a, b] = F ? [45, 60] : [50, 65]; return v < a ? ['baixa', 'alerta'] : v <= b ? ['normal', 'ok'] : ['alta', 'alerta']; }
  return null;
}
function tileBio(c, x, ant) {
  const v = x[c[0]]; if (v == null) return '';
  const fx = faixaBio(c[0], v); const dv = ant && ant[c[0]] != null ? v - ant[c[0]] : null;
  const bom = dv == null || c[3] === 0 || Math.abs(dv) < 0.05 ? null : Math.sign(dv) === c[3];
  return '<div class="tile' + (c[0] === bioSel ? ' sel' : '') + '" data-acao="bioSel" data-v="' + c[0] + '"><div class="mini">' + c[1] + '</div><div class="num" style="font-size:20px">' + fmtN(v) + (c[2] ? ' <span class="mini">' + c[2] + '</span>' : '') + '</div>' +
    (fx ? '<div class="mini" style="color:var(--' + fx[1] + ')">' + fx[0] + '</div>' : '') +
    (dv != null ? '<div class="mini" style="color:' + (bom === null ? 'var(--txt3)' : bom ? 'var(--ok)' : 'var(--alerta)') + '">' + (dv > 0 ? '+' : '') + fmtN(Math.round(dv * 10) / 10) + ' desde ' + dataCurta(ant.d) + '</div>' : '') + '</div>';
}
function cartaoSegmentos(sg) {
  const cel = (par, faixa) => {
    if (!par || (par[0] == null && par[1] == null)) return '<td>–</td>';
    const p = par[1]; const fora = p != null && (p < faixa[0] || p > faixa[1]);
    return '<td>' + (par[0] != null ? fmtN(par[0]) + ' kg' : '') + (p != null ? '<div class="mini" style="color:' + (fora ? 'var(--alerta)' : 'var(--ok)') + '">' + fmtN(p) + '%' + (fora ? (p > faixa[1] ? ' alto' : ' baixo') : '') + '</div>' : '') + '</td>';
  };
  return '<div class="cartao"><div class="cab"><h3>Por segmento</h3></div><div class="rel"><table><thead><tr><th>Parte</th><th>Gordura</th><th>Músculo</th></tr></thead><tbody>' +
    SEGS.map(([k, n]) => '<tr><td>' + n + '</td>' + cel(sg.g && sg.g[k], [80, 160]) + cel(sg.m && sg.m[k], [80, 115]) + '</tr>').join('') +
    '</tbody></table></div><p class="mini" style="margin-top:6px">O % compara com o padrão da balança para o seu corpo: gordura entre 80% e 160% e músculo entre 80% e 115% são o normal.</p></div>';
}
function telaBio() {
  const l = bioOrdenada();
  if (!l.length) return '<div class="cartao realce"><h2>Bioimpedância</h2><p class="sub">Copie para cá os números da sua balança de bioimpedância. O app atualiza o seu peso e o seu % de gordura no perfil, recalcula as metas com a sua massa magra e mostra a evolução a cada avaliação.</p><button class="btn pri bloco" data-acao="novaBio">+ Registrar bioimpedância</button></div>';
  const x = l[l.length - 1], ant = l.length > 1 ? l[l.length - 2] : null;
  let h = '<div class="cartao"><div class="cab"><h2>Última avaliação</h2><span class="mini">' + dataCurta(x.d) + '</span><div class="dir"><button class="ic" data-acao="editarBio" data-d="' + x.d + '" aria-label="Editar">' + IC.editar + '</button><button class="btn peq pri" data-acao="novaBio">+ Nova</button></div></div>';
  h += '<div class="grade2 tiles">' + BIO.filter(c => c[4]).map(c => tileBio(c, x, ant)).join('') + '</div>';
  const m = calcMetas();
  if (m) h += '<div class="info" style="margin:10px 0 0">Metabolismo basal: ' + (x.tmb ? 'balança <b>' + fmt(x.tmb) + ' kcal</b> · ' : '') + 'app <b>' + fmt(m.tmb) + ' kcal</b>' + (S.perfil.bf ? ', calculado com a sua massa magra' : '') + '. As metas usam o peso e o % de gordura mais recentes.</div>';
  const resto = BIO.filter(c => !c[4] && x[c[0]] != null);
  if (resto.length) h += '<details style="margin-top:10px"><summary>Os outros números da balança (' + resto.length + ')</summary><div class="grade2 tiles" style="margin-top:8px">' + resto.map(c => tileBio(c, x, ant)).join('') + '</div></details>';
  h += '</div>';
  if (x.seg) h += cartaoSegmentos(x.seg);
  const c = BIO.find(y => y[0] === bioSel) || BIO[2];
  const serie = l.filter(y => y[c[0]] != null).map(y => ({ d: y.d, v: y[c[0]] }));
  h += '<div class="cartao"><div class="cab"><h3>Evolução · ' + c[1] + '</h3></div><div class="mini" style="margin-bottom:4px">Toque num quadro acima para trocar o gráfico.</div>' + grafSerie(serie, c[2]) + '</div>';
  h += '<div class="cartao"><div class="cab"><h3>Avaliações</h3></div><ul class="lista">' + l.slice().reverse().map(y => '<li data-acao="editarBio" data-d="' + y.d + '"><div class="txt"><div class="t">' + dataCurta(y.d) + '</div><div class="mini">' + [y.peso != null ? fmtN(y.peso) + ' kg' : '', y.gord != null ? fmtN(y.gord) + '% de gordura' : '', y.visceral != null ? 'visceral ' + fmtN(y.visceral) : ''].filter(Boolean).join(' · ') + '</div></div><span class="seta">' + IC.editar + '</span></li>').join('') + '</ul>' +
    '<p class="mini" style="margin-top:8px">As cores são referências gerais pela idade e pelo sexo do perfil, não um diagnóstico; a da sua balança pode ser um pouco diferente. Para comparar uma avaliação com a outra, meça sempre no mesmo horário, em jejum, de bexiga vazia e sem ter treinado.</p></div>';
  return h;
}
function folhaBio(d0) {
  const d = d0 || hojeISO(); const ex = S.bio.find(x => x.d === d) || {};
  const ant = bioOrdenada().filter(x => x.d < d).pop() || {};
  const campo = c => '<label class="campo"><span>' + c[1] + (c[2] ? ' (' + c[2] + ')' : '') + '</span><input type="number" inputmode="decimal" step="any" data-b="' + c[0] + '" value="' + (ex[c[0]] != null ? ex[c[0]] : '') + '" placeholder="' + (ant[c[0]] != null ? 'antes: ' + fmtN(ant[c[0]]) : '') + '"></label>';
  const sg = ex.seg || {};
  const segIn = (t, k, i) => { const v = sg[t] && sg[t][k] ? sg[t][k][i] : null; return '<input type="number" inputmode="decimal" step="any" data-s="' + t + '|' + k + '|' + i + '" value="' + (v != null ? v : '') + '">'; };
  const fl = abrirFolha('<h2>' + (d0 ? 'Bioimpedância de ' + dataCurta(d) : 'Registrar bioimpedância') + '</h2><p class="mini" style="margin:4px 0 10px">Copie os números da balança na mesma ordem em que ela mostra. Só o peso é obrigatório: deixe vazio o que a sua balança não tiver.</p>' +
    '<label class="campo"><span>Data da avaliação</span><input type="date" id="bioD" value="' + d + '"' + (d0 ? ' disabled' : '') + '></label>' +
    '<div class="grade2">' + BIO.map(campo).join('') + '</div>' +
    '<details style="margin:6px 0 12px"><summary>Análise por segmento (opcional)</summary><p class="mini" style="margin:6px 0">Gordura e músculo de cada parte do corpo: o peso (kg) e o % que a balança mostra embaixo dele.</p><div class="bio-seg"><span></span><span class="mini">Gord. kg</span><span class="mini">Gord. %</span><span class="mini">Músc. kg</span><span class="mini">Músc. %</span>' +
    SEGS.map(([k, n]) => '<span class="mini">' + n + '</span>' + segIn('g', k, 0) + segIn('g', k, 1) + segIn('m', k, 0) + segIn('m', k, 1)).join('') + '</div></details>' +
    '<div class="grade2">' + (d0 ? '<button class="btn perigo" id="bioR">Excluir</button>' : '<button class="btn" id="bioC">Cancelar</button>') + '<button class="btn pri" id="bioO">Salvar</button></div>', el => {
      if ($('#bioC', el)) $('#bioC', el).onclick = () => fecharFolha(fl);
      if ($('#bioR', el)) $('#bioR', el).onclick = async () => { if (await confirmar('Excluir a bioimpedância de ' + dataCurta(d) + '? O peso e o % de gordura dela continuam em Peso e Medidas.', 'Excluir', true)) { S.bio = S.bio.filter(x => x.d !== d); salvar(); fecharFolha(fl); render(); } };
      $('#bioO', el).onclick = () => {
        const dd = $('#bioD', el).value; if (!dd) { toast('Escolha a data.'); return; }
        const n = { d: dd }; let ruim = null;
        $$('[data-b]', el).forEach(i => { const v = num(i.value); if (v == null) return; const c = BIO.find(y => y[0] === i.dataset.b); if (v < c[5] || v > c[6]) ruim = c[1]; n[c[0]] = v; });
        if (ruim) { toast('Confira: ' + ruim + ' está fora do normal.'); return; }
        if (n.peso == null) { toast('Preencha pelo menos o peso.'); return; }
        const seg = { g: {}, m: {} }; let temSeg = false;
        $$('[data-s]', el).forEach(i => { const v = num(i.value); if (v == null || v < 0 || v > 1000) return; const [t, k, j] = i.dataset.s.split('|'); (seg[t][k] = seg[t][k] || [null, null])[Number(j)] = v; temSeg = true; });
        if (temSeg) n.seg = seg;
        S.bio = S.bio.filter(x => x.d !== dd).concat(n);
        fecharFolha(fl); aplicarBio(n);
      };
    });
}
/* a avaliação vai para Peso e Medidas; sem perfil, abre o perfil já preenchido (altura sai do IMC) */
function aplicarBio(n) {
  const maisNova = bioOrdenada().pop().d === n.d;
  const pz = S.peso.find(x => x.d === n.d); if (pz) pz.kg = n.peso; else S.peso.push({ d: n.d, kg: n.peso });
  if (n.gord != null) { let md = S.medidas.find(x => x.d === n.d); if (!md) { md = { d: n.d }; S.medidas.push(md); } md.bf = n.gord; }
  if (!S.perfil) {
    salvar(); render();
    const alt = n.imc ? Math.round(Math.sqrt(n.peso / n.imc) * 100) : null;
    folhaPerfil({ peso: n.peso, bf: n.gord != null ? n.gord : null, altura: alt && alt >= 120 && alt <= 230 ? alt : 175 }, true);
    return;
  }
  if (maisNova) { S.perfil.peso = pesoAtual(); if (n.gord != null) S.perfil.bf = n.gord; }
  salvar(); render();
  toast(maisNova ? 'Bioimpedância salva. Peso' + (n.gord != null ? ' e % de gordura' : '') + ' atualizados no perfil; metas recalculadas.' : 'Bioimpedância salva.');
}
/* ---- peso ---- */
function telaPeso() {
  const t = tendenciaPeso();
  let h = '<div class="cartao"><div class="cab"><h2>Peso</h2><div class="dir"><button class="btn peq pri" data-acao="novoPeso">+ Registrar</button></div></div>' + grafPeso() +
    (t ? '<div class="sub" style="margin-top:6px">Tendência das últimas ' + Math.round(t.dias / 7) + ' semanas: <b>' + (t.semana > 0 ? '+' : '') + fmt(t.semana, 2) + ' kg/semana</b> (' + (t.pct > 0 ? '+' : '') + fmt(t.pct, 2) + '%)</div>' : '');
  const pl = S.peso.slice().sort((a, b) => a.d < b.d ? 1 : -1).slice(0, 15);
  if (pl.length) h += '<ul class="lista" style="margin-top:8px">' + pl.map(x => '<li><div class="txt"><div class="t">' + dataCurta(x.d) + '</div></div><div class="val">' + fmt(x.kg, 1) + ' kg</div><button class="ic" data-acao="remPeso" data-d="' + x.d + '">' + IC.lixo + '</button></li>').join('') + '</ul>';
  return h + '</div>';
}


/* ===================== RESUMO PARA IMPRIMIR (ou salvar em PDF) ===================== */
function htmlRelatorio(n) {
  const fim = hojeISO(); const ini = addDias(fim, -(n - 1));
  const lista = []; for (let i = n - 1; i >= 0; i--) lista.push(addDias(fim, -i));
  const p = S.perfil; const m = calcMetas();
  let nCom = 0, kc = 0, pr = 0, treinos = 0, minCardio = 0, aguaOk = 0; const sonos = [];
  const linhas = lista.map(iso => {
    const t = totaisDia(iso); const md = metaDia(iso); const d = dia(iso);
    const tr = d && d.treino && d.treino.fim ? (d.treino.n || 'Treino ' + letra(d.treino.idx || 0)) : '';
    const cd = ((d && d.cardio) || []).reduce((a, x) => a + (x.min || 0), 0);
    const ag = aguaDia(iso); const sn = sonoDoDia(iso).min; const pz = S.peso.find(x => x.d === iso);
    if (t.kcal > 300) { nCom++; kc += t.kcal; pr += t.p; }
    if (tr) treinos++; minCardio += cd; if (ag >= metaAguaDia(iso)) aguaOk++; if (sn) sonos.push(sn);
    return '<tr><td>' + dataCurta(iso) + '</td><td>' + (t.kcal > 0 ? fmt(t.kcal) : '–') + (md ? ' <span class="mini">/ ' + fmt(md.kcal) + '</span>' : '') + '</td><td>' + (t.kcal > 0 ? fmt(t.p) : '–') + '</td><td>' + esc(tr) + (cd ? (tr ? ' + ' : '') + 'cardio ' + cd + ' min' : '') + '</td><td>' + (ag ? fmt(ag / 1000, 1) : '–') + '</td><td>' + (sn ? hm(sn) : '–') + '</td><td>' + (pz ? fmt(pz.kg, 1) : '') + '</td></tr>';
  });
  const pesos = S.peso.filter(x => x.d >= ini && x.d <= fim).sort((a, b) => a.d < b.d ? -1 : 1);
  const cint = serieMedida('cintura').filter(x => x.d >= ini && x.d <= fim);
  const bios = S.bio.filter(x => x.d >= ini && x.d <= fim).sort((a, b) => a.d < b.d ? -1 : 1); const ub = bios[bios.length - 1];
  const item = (rot, val) => '<tr><td>' + rot + '</td><td>' + val + '</td></tr>';
  let h = '<div class="rel"><h1>Forja · resumo de ' + n + ' dias</h1><div class="sub">' + dataCurta(ini) + ' a ' + dataCurta(fim) + '</div>';
  if (p) h += '<p class="sub">' + (p.sexo === 'M' ? 'Homem' : 'Mulher') + ', ' + p.idade + ' anos, ' + p.altura + ' cm · objetivo: ' + OBJETIVOS[p.objetivo].toLowerCase() + (m ? ' · meta: ' + fmt(m.kcal) + ' kcal, ' + m.prot + ' g de proteína, ' + m.carb + ' g de carboidrato, ' + m.gord + ' g de gordura' + (m.manual ? ' (metas do nutricionista)' : '') : '') + '</p>';
  h += '<h3>Resumo</h3><table>' +
    item('Dias com alimentação registrada', nCom + ' de ' + n) +
    item('Calorias (média dos dias registrados)', nCom ? fmt(kc / nCom) + ' kcal' : '–') +
    item('Proteína (média)', nCom ? fmt(pr / nCom) + ' g' : '–') +
    item('Treinos concluídos', String(treinos) + (minCardio ? ' · cardio ' + minCardio + ' min no total' : '')) +
    item('Dias na meta de água', aguaOk + ' de ' + n) +
    item('Sono (média)', sonos.length ? hm(sonos.reduce((a, b) => a + b, 0) / sonos.length) + ' (' + sonos.length + ' noites)' : '–') +
    item('Peso', pesos.length ? fmt(pesos[0].kg, 1) + ' kg → ' + fmt(pesos[pesos.length - 1].kg, 1) + ' kg (' + (pesos.length > 1 ? (pesos[pesos.length - 1].kg - pesos[0].kg > 0 ? '+' : '') + fmt(pesos[pesos.length - 1].kg - pesos[0].kg, 1) + ' kg, ' : '') + pesos.length + ' pesagens)' : 'sem pesagens') +
    (cint.length ? item('Cintura', fmt(cint[0].v, 1) + ' cm → ' + fmt(cint[cint.length - 1].v, 1) + ' cm') : '') +
    (ub ? item('Bioimpedância (' + dataCurta(ub.d) + ')', [ub.gord != null ? fmtN(ub.gord) + '% de gordura' : '', ub.magra != null ? 'massa magra ' + fmtN(ub.magra) + ' kg' : '', ub.massaMusc != null ? 'massa muscular ' + fmtN(ub.massaMusc) + ' kg' : '', ub.visceral != null ? 'gordura visceral ' + fmtN(ub.visceral) : ''].filter(Boolean).join(' · ') || 'registrada') : '') + '</table>';
  h += '<h3>Dia a dia</h3><div class="tab-rol"><table><thead><tr><th>Dia</th><th>kcal / meta</th><th>Prot. (g)</th><th>Treino</th><th>Água (L)</th><th>Sono</th><th>Peso</th></tr></thead><tbody>' + linhas.join('') + '</tbody></table></div>';
  h += '<p class="mini" style="margin-top:10px">Gerado pelo app Forja em ' + dataCurta(fim) + '. Valores de alimentos pela TBCA (USP) e medidas caseiras aproximadas; são estimativas e não substituem a avaliação de um profissional.</p></div>';
  return h;
}
function folhaRelatorio() {
  let n = 30;
  const fl = abrirFolha('<h2>Resumo para imprimir</h2><p class="mini" style="margin:4px 0 10px">Uma página com calorias, proteína, treinos, água, sono e peso de cada dia. No celular, escolha <b>Salvar como PDF</b> na tela de impressão para mandar por WhatsApp ou e-mail.</p><div class="chips" id="rlD"><button class="chip on" data-d="30">30 dias</button><button class="chip" data-d="14">14 dias</button><button class="chip" data-d="7">7 dias</button></div><div class="grade2" style="margin-top:12px"><button class="btn" id="rlC">Cancelar</button><button class="btn pri" id="rlO">Imprimir ou salvar PDF</button></div>', el => {
    $('#rlD', el).onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return; n = Number(b.dataset.d); $$('#rlD .chip', el).forEach(c => c.classList.toggle('on', c === b)); };
    $('#rlC', el).onclick = () => fecharFolha(fl);
    $('#rlO', el).onclick = () => { fecharFolha(fl); imprimirRelatorio(n); };
  });
}
function imprimirRelatorio(n) {
  let r = document.getElementById('relatorio');
  if (!r) { r = document.createElement('div'); r.id = 'relatorio'; document.body.appendChild(r); }
  r.innerHTML = htmlRelatorio(n);
  setTimeout(() => window.print(), 80);
}

/* ===================== ações (delegação única) ===================== */
const ACOES = {
  irAba: b => irAba(b.dataset.v),
  irProgresso: b => { subProg = (b && b.dataset.v) || 'semana'; irAba('progresso'); },
  subProg: b => { subProg = b.dataset.v; pularRolagem = true; render(); window.scrollTo(0, 0); },
  addRefeicaoAgora: () => folhaBusca(refeicaoAgora(), true),
  folhaAgua: b => { if (b && b.dataset.v === 'hoje') dataSel = hojeISO(); folhaAgua(); },
  folhaSono: b => { if (b && b.dataset.v === 'hoje') dataSel = hojeISO(); folhaSonoDia(); },
  listaCompras: () => folhaCompras(),
  gastoReal: () => folhaGastoReal(),
  relatorio: () => folhaRelatorio(),
  cmpPose: b => { cmp = { pose: b.dataset.v, a: null, b: null, modo: cmp.modo }; render(); },
  cmpModo: b => { cmp.modo = b.dataset.v; render(); },
  cmpTrocar: b => folhaEscolherCmp(b.dataset.a, b.dataset.b),
  cmpCompartilhar: b => compartilharComparacao(b.dataset.a, b.dataset.b),
  novaSessaoFotos: () => folhaSessaoFotos(null),
  editarSessao: b => folhaSessaoFotos(b.dataset.d),
  verFoto: b => folhaVerFoto(b.dataset.id),
  exportarFotos: () => exportarFotos(),
  importarFotos: () => $('#arqFotos').click(),
  novasMedidas: () => folhaMedidas(null),
  editarMedidas: b => folhaMedidas(b.dataset.d),
  medSel: b => { medSel = b.dataset.v; render(); },
  irTreinoPlano: () => { subTreino = 'plano'; irAba('treino'); },
  irTreinoHoje: () => { subTreino = 'hoje'; irAba('treino'); },
  agua: b => { const d = dia(dataSel, true); d.agua.push({ ml: Number(b.dataset.v), h: horaAgora() }); salvar(); render(); const ag = aguaDia(dataSel), mt = metaAguaDia(dataSel); toast(ag >= mt ? 'Meta de água batida! 💧' : '+' + b.dataset.v + ' ml · faltam ' + fmt((mt - ag) / 1000, 2) + ' L'); },
  dormir: () => { S.sonoAberto = dtLocal(new Date()); salvar(); render(); toast('Boa noite! Toque em "Acordei agora" ao levantar.'); },
  cancDormir: () => { S.sonoAberto = null; salvar(); render(); },
  acordei: () => {
    const ini = S.sonoAberto, fim = dtLocal(new Date()); const m = minutosEntre(ini, fim);
    S.sonoAberto = null;
    if (m < 10) { salvar(); render(); toast('Menos de 10 min — não registrado.'); return; }
    const s = { id: 'S' + Date.now(), ini, fim, q: 0, nota: '' }; S.sono.push(s); salvar(); dataSel = fim.slice(0, 10); render(); folhaSono(s);
  },
  novoPeso: () => folhaPeso(),
  remPeso: async b => { if (await confirmar('Excluir o peso de ' + dataCurta(b.dataset.d) + '?', 'Excluir', true)) { S.peso = S.peso.filter(x => x.d !== b.dataset.d); if (S.perfil && pesoAtual()) S.perfil.peso = pesoAtual(); salvar(); render(); } },
  editarPerfil: () => folhaPerfil(),
  metasManuais: () => folhaMetasManuais(),
  editarEstilo: () => { if (!S.perfil) { toast('Configure o perfil primeiro.'); return; } folhaEstilo(); },
  usarReal: () => { S.perfil.usarReal = !S.perfil.usarReal; salvar(); render(); toast(S.perfil.usarReal ? 'Metas agora seguem seu gasto real.' : 'Metas voltaram para a fórmula.'); },
  editarPlantao: () => folhaPlantao(),
  togPlantaoDia: () => { const atual = ehPlantao(dataSel); const regra = (() => { const o = S.plantaoDias[dataSel]; delete S.plantaoDias[dataSel]; const r = ehPlantao(dataSel); if (o != null) S.plantaoDias[dataSel] = o; return r; })(); if (!atual === regra) delete S.plantaoDias[dataSel]; else S.plantaoDias[dataSel] = !atual; salvar(); render(); toast(rotuloDia(dataSel) + ': ' + (!atual ? 'plantão' : 'folga') + '.'); },
  aplicarAjuste: b => { S.perfil.ajusteKcal = (S.perfil.ajusteKcal || 0) + Number(b.dataset.v); S.perfil.ajusteEm = hojeISO(); salvar(); render(); toast('Meta ajustada. A próxima sugestão vem daqui a 2 semanas.'); },
  togRef: b => { const k = b.dataset.v; const l = S.cfg.refeicoes; if (l.includes(k)) { if (l.length <= 2) { toast('Mínimo de 2 refeições.'); return; } S.cfg.refeicoes = l.filter(x => x !== k); } else S.cfg.refeicoes = l.concat(k); salvar(); render(); },
  addAlim: b => folhaBusca(b.dataset.ref),
  editItem: b => { const d = dia(dataSel); const it = d.ref[b.dataset.ref][Number(b.dataset.i)]; if (it.q) { folhaRapido(b.dataset.ref, Number(b.dataset.i)); return; } folhaQuantidade(b.dataset.ref, it.f, Number(b.dataset.i)); },
  gerarCardapio: () => folhaCardapio(),
  menuRef: b => folhaMenuRef(b.dataset.ref),
  gerirModelos: () => folhaModelos(null),
  novoAlimento: () => folhaNovoAlimento(),
  copiarOntem: async () => {
    let orig = null; for (let i = 1; i <= 14; i++) { const dd = dia(addDias(dataSel, -i)); if (dd && Object.keys(dd.ref).some(k => dd.ref[k].length)) { orig = addDias(dataSel, -i); break; } }
    if (!orig) { toast('Nenhum dia com refeições nos últimos 14 dias.'); return; }
    const d = dia(dataSel, true); const tem = Object.keys(d.ref).some(k => d.ref[k].length);
    if (tem && !(await confirmar('Substituir as refeições deste dia pelas de ' + rotuloDia(orig).toLowerCase() + '?', 'Substituir'))) return;
    d.ref = JSON.parse(JSON.stringify(S.dias[orig].ref)); salvar(); render(); toast('Copiado de ' + rotuloDia(orig).toLowerCase() + '.');
  },
  limparDia: async () => { if (await confirmar('Apagar todas as refeições deste dia?', 'Apagar', true)) { dia(dataSel).ref = {}; salvar(); render(); } },
  subTreino: b => { subTreino = b.dataset.v; if (subTreino !== 'plano') rascunho = null; pularRolagem = true; render(); window.scrollTo(0, 0); },
  rFreq: b => { rascunho.freq = b.dataset.v; const F = FREQS[b.dataset.v]; if (!F.alt) rascunho.dias = F.dias.slice(); rascunho.div = divsPara(rascunho.freq, rascunho.enf || enfasePadrao())[0]; render(); },
  rEnf: b => { rascunho.enf = b.dataset.v; rascunho.div = divsPara(rascunho.freq, rascunho.enf)[0]; render(); },
  rDia: b => { const v = Number(b.dataset.v); const l = rascunho.dias; rascunho.dias = l.includes(v) ? l.filter(x => x !== v) : l.concat(v).sort(); render(); },
  rDiv: b => { rascunho.div = b.dataset.v; render(); },
  rObj: b => { rascunho.obj = b.dataset.v; render(); },
  rPreset: b => { rascunho.equip = PRESETS_EQUIP[b.dataset.v].slice(); render(); },
  rEquip: b => { const v = b.dataset.v; const l = rascunho.equip; rascunho.equip = l.includes(v) ? l.filter(x => x !== v) : l.concat(v); if (!rascunho.equip.includes('Nenhum')) rascunho.equip.push('Nenhum'); render(); },
  rModo: b => { rascunho.modo = b.dataset.v; render(); },
  rPlantao: () => { rascunho.evitarPlantao = !rascunho.evitarPlantao; render(); },
  rAv: () => { rascunho.av = !rascunho.av; render(); },
  rFoco: b => { rascunho.foco = alternarFoco(rascunho.foco || [], b.dataset.v); render(); },
  editarFoco: () => folhaFoco(),
  cancRasc: () => { rascunho = null; render(); },
  criarPlano: async () => {
    const r = rascunho; if (!FREQS[r.freq].alt && !r.dias.length) { toast('Marque pelo menos um dia.'); return; }
    if (S.treino && !(await confirmar('Gerar um novo plano substitui os exercícios atuais (o histórico de cargas continua). Seguir?', 'Gerar'))) return;
    const seq = gerarPlano(r);
    S.treino = { freq: r.freq, div: r.div, dias: FREQS[r.freq].alt ? [] : r.dias.slice(), obj: r.obj, equip: r.equip.slice(), modo: r.modo, evitarPlantao: !!r.evitarPlantao, foco: (r.foco || []).slice(), enf: r.enf || enfasePadrao(), inicio: hojeISO(), seq };
    aplicarFoco(S.treino);
    rascunho = null; salvar(); render(); toast('Treino criado: ' + seq.length + ' treinos (' + seq.map((_, i) => letra(i)).join('') + ')' + (S.treino.foco.length ? ', foco em ' + nomesFoco(S.treino.foco) : '') + '.');
  },
  editarPlano: () => { rascunho = null; const T = S.treino; rascunho = { freq: T.freq, div: T.div, dias: T.dias.slice(), obj: T.obj, equip: T.equip.slice(), modo: T.modo || 'calendario', evitarPlantao: !!T.evitarPlantao, foco: (T.foco || []).slice(), enf: T.enf || (DIVISOES[T.div].enf === 'inf' ? 'inf' : 'eq') }; render(); },
  regerarPlano: async () => { if (await confirmar('Sortear os exercícios de novo com a mesma configuração? Ajustes manuais serão perdidos.', 'Gerar de novo')) { const T = S.treino; T.seq = gerarPlano(T); aplicarFoco(T); salvar(); render(); } },
  renomearDia: b => { const i = Number(b.dataset.i); const t = S.treino.seq[i]; const fl = abrirFolha('<h3 style="margin-bottom:10px">Nome do treino ' + letra(i) + '</h3><label class="campo"><span>Nome</span><input type="text" id="rnN" value="' + esc(t.n) + '"></label><div class="grade2"><button class="btn" id="rnC">Cancelar</button><button class="btn pri" id="rnO">Salvar</button></div>', el => { $('#rnC', el).onclick = () => fecharFolha(fl); $('#rnO', el).onclick = () => { t.n = $('#rnN', el).value.trim() || t.n; salvar(); fecharFolha(fl); render(); }; }); },
  editPresc: b => folhaPresc(Number(b.dataset.i), Number(b.dataset.j)),
  trocarEx: b => { const i = Number(b.dataset.i), j = Number(b.dataset.j); const p = S.treino.seq[i].ex[j]; const e = EXS.get(p.id); folhaEscolherEx(e && e.grupo, n => { S.treino.seq[i].ex[j] = Object.assign({ id: n.id }, prescrever(n, S.treino.obj)); salvar(); render(); toast('Trocado por ' + n.nome + '.'); }); },
  moverEx: b => { const i = Number(b.dataset.i), j = Number(b.dataset.j), v = Number(b.dataset.v) || -1; const l = S.treino.seq[i].ex; const k = j + v; if (k < 0 || k >= l.length) return; [l[k], l[j]] = [l[j], l[k]]; salvar(); render(); },
  remEx: async b => { const i = Number(b.dataset.i), j = Number(b.dataset.j); const e = EXS.get(S.treino.seq[i].ex[j].id); if (await confirmar('Remover ' + esc(e ? e.nome : '') + ' do treino ' + letra(i) + '?', 'Remover', true)) { S.treino.seq[i].ex.splice(j, 1); salvar(); render(); } },
  addEx: b => { const i = Number(b.dataset.i); folhaEscolherEx('', n => { S.treino.seq[i].ex.push(Object.assign({ id: n.id }, prescrever(n, S.treino.obj))); salvar(); render(); }); },
  verEx: b => folhaVerEx(b.dataset.id),
  graficoEx: b => folhaGraficoEx(b.dataset.id),
  escolherTreino: () => folhaEscolherTreino(),
  iniciarTreino: () => { const t = registroTreino(true); t.ini = Date.now(); salvar(); render(); if (dataSel === hojeISO()) telaAcesa(true); toast('Bom treino! Marque ✓ em cada série para cronometrar o descanso. A tela fica acesa.'); },
  preencherCargas: () => {
    const reg0 = registroTreino(false); const idx = reg0 ? reg0.idx : treinoDoDia(dataSel).idx;
    const T = treinoDia(idx, reg0); const t = registroTreino(true); let n = 0;
    T.ex.forEach(p => {
      const e = EXS.get(p.id); const ult = ultimaSerie(p.id, dataSel); if (!e || !ult) return;
      const pr = progressao(p, e, ult); t.s[p.id] = t.s[p.id] || [];
      for (let k = 0; k < p.s; k++) {
        while (t.s[p.id].length <= k) t.s[p.id].push({});
        const x = t.s[p.id][k]; if (x.ok) continue;
        const sg = sugestaoSerie(p, ult, pr, k);
        if (x.kg == null && sg.kg !== '' && num(String(sg.kg)) != null) { x.kg = num(String(sg.kg)); n++; }
        if (x.r == null && sg.r !== '' && num(String(sg.r)) != null) { x.r = num(String(sg.r)); n++; }
      }
    });
    salvar(); render(); toast(n ? 'Preenchido com a última vez (e a subida de carga sugerida). Mude o que for diferente.' : 'Nada para preencher.');
  },
  togEx: b => { const id = b.dataset.id; if (abertosEx.has(id)) abertosEx.delete(id); else abertosEx.add(id); render(); },
  concluirTreino: () => {
    const t = registroTreino(true); t.fim = Date.now();
    let min = (t.fim - (t.ini || t.fim)) / 60000;
    if (min < 5 || min > 240) { let ns = 0; for (const k in t.s) ns += t.s[k].filter(x => x.ok).length; min = Math.max(20, ns * 2.5); t.ini = t.fim - min * 60000; }
    const kg = pesoAtual() || 75; const met = S.treino.seq[t.idx] && S.treino.seq[t.idx].leve ? 3.0 : OBJ_TREINO[S.treino.obj].met;
    t.kcal = Math.round(met * kg * min / 60);
    /* congela o que foi feito: mudar o plano depois não altera este dia no histórico */
    const td = treinoDia(t.idx, t); t.n = td.n; t.ex = td.ex.map(p => ({ id: p.id, s: p.s, r: p.r, d: p.d })); t.extra = [];
    abertosEx.clear(); salvar(); pararDescanso(); if (querTela) telaAcesa(false); render(); toast('Treino concluído: ' + hm(min) + ' · ~' + t.kcal + ' kcal.');
  },
  reabrirTreino: () => { const t = registroTreino(false); if (t) { delete t.fim; delete t.kcal; salvar(); render(); } }, /* a lista congelada continua valendo */
  okSerie: b => {
    const t = registroTreino(true); const id = b.dataset.id, s = Number(b.dataset.s);
    t.s[id] = t.s[id] || []; while (t.s[id].length <= s) t.s[id].push({});
    const reg = t.s[id][s];
    const ins = $$('input[data-serie^="' + CSS.escape(id) + '|' + s + '|"]');
    ins.forEach(i => { const campo = i.dataset.serie.split('|')[2]; const v = num(i.value !== '' ? i.value : i.placeholder); if (v != null && reg[campo] == null) reg[campo] = v; });
    reg.ok = !reg.ok; if (!t.ini) t.ini = Date.now();
    salvar();
    b.classList.toggle('on', reg.ok);
    ins.forEach(i => { const campo = i.dataset.serie.split('|')[2]; if (reg[campo] != null) i.value = reg[campo]; });
    if (reg.ok) iniciarDescanso(Number(b.dataset.d) || 60);
    /* exercício completo: recolhe para a tela não ficar enorme */
    if (reg.ok && t.s[id].filter(x => x.ok).length >= Number(b.dataset.total || 99)) { abertosEx.delete(id); setTimeout(render, 350); }
  },
  maisSerie: b => { const t = registroTreino(true); const id = b.dataset.id; t.s[id] = t.s[id] || []; while (t.s[id].length < Number(b.dataset.n) + 1) t.s[id].push({}); salvar(); render(); },
  addExDia: () => folhaEscolherEx('', n => { const t = registroTreino(true); t.extra = t.extra || []; if (!t.extra.includes(n.id)) t.extra.push(n.id); salvar(); render(); }),
  remExtra: b => { const t = registroTreino(false); if (!t) return; t.extra = (t.extra || []).filter(x => x !== b.dataset.id); delete t.s[b.dataset.id]; salvar(); render(); },
  registrarCardio: () => folhaRegistrarCardio(),
  remCardio: b => { const d = dia(dataSel); d.cardio.splice(Number(b.dataset.i), 1); salvar(); render(); },
  editarCardio: () => folhaPlanoCardio(),
  remPlanoCardio: async () => { if (await confirmar('Remover o plano de cardio?', 'Remover', true)) { S.cardio = null; salvar(); render(); } },
  cronHiit: b => folhaHiit(b.dataset.tipo),
  exportar: () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forja-copia-' + hojeISO() + '.json'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    S.cfg.ultimoBackup = hojeISO(); S.cfg.backupAdiado = null; salvar(); render(); toast('Cópia gerada. Guarde o arquivo no Drive ou mande para você mesmo.');
  },
  importar: () => $('#arqImport').click(),
  novaBio: () => folhaBio(null),
  editarBio: b => folhaBio(b.dataset.d),
  bioSel: b => { bioSel = b.dataset.v; render(); },
  togEconomico: () => { S.cfg.economico = !economico(); salvar(); render(); toast(economico() ? 'Dieta econômica ligada: o cardápio passa a usar alimentos baratos.' : 'Dieta econômica desligada.'); },
  togSemSal: () => { S.cfg.semSal = !S.cfg.semSal; salvar(); render(); toast(S.cfg.semSal ? 'Sódio dos preparos agora sem sal.' : 'Sódio dos preparos agora com sal.'); },
  baixarAntes: () => { let t = textoAntes; try { t = t || localStorage.getItem(KEY_ANTES); } catch (e) { } if (!t) { toast('A cópia não está mais neste aparelho.'); return; } baixarTexto(t, 'forja-copia-antes-1.6.json'); toast('Cópia baixada. Guarde o arquivo.'); },
  adiarBackup: () => { S.cfg.backupAdiado = hojeISO(); salvar(); render(); },
  apagarTudo: async () => {
    if (!(await confirmar('Apagar TODOS os dados do app (perfil, treinos, refeições, água, sono, peso, medidas e fotos)?', 'Continuar', true))) return;
    if (!(await confirmar('Tem certeza? Isso não pode ser desfeito. Exporte uma cópia antes, se quiser.', 'Apagar tudo', true))) return;
    localStorage.removeItem(KEY); localStorage.removeItem(KEY_ANTES); textoAntes = null; S = padrao(); rascunho = null; dataSel = hojeISO(); await fotoLimpar().catch(() => { }); _urls.clear(); render(); toast('Dados apagados.');
  }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-acao]'); if (!b || !ACOES[b.dataset.acao]) return;
  if (b.closest('.fundo')) return; /* folhas tratam os próprios botões */
  ACOES[b.dataset.acao](b, e);
});
document.addEventListener('input', e => {
  if (e.target.id !== 'dslR') return; const v = e.target.value;
  const t = $('#dslTopo'), l = $('#dslLinha'); if (t) t.style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)'; if (l) l.style.left = v + '%';
});
/* séries: salvar ao sair do campo, sem redesenhar (não perde o foco) */
document.addEventListener('change', e => {
  const i = e.target.closest('input[data-serie]');
  if (i) {
    const [id, s, campo] = i.dataset.serie.split('|'); const t = registroTreino(true);
    t.s[id] = t.s[id] || []; while (t.s[id].length <= Number(s)) t.s[id].push({});
    t.s[id][Number(s)][campo] = num(i.value); salvar(); return;
  }
  if (e.target.id === 'cfgCopo') { const v = num(e.target.value); if (v && v >= 50 && v <= 2000) { S.cfg.copo = Math.round(v); salvar(); } return; }
  if (e.target.id === 'arqFotos') {
    const f = e.target.files[0]; if (!f) return; e.target.value = '';
    const rd = new FileReader();
    rd.onload = async () => { let o; try { o = JSON.parse(rd.result); } catch (er) { toast('Arquivo inválido.'); return; } if (!o || o.tipo !== 'forja-fotos') { toast('Este arquivo não é uma exportação de fotos da Forja.'); return; } toast('Importando fotos…'); try { await importarFotos(o); } catch (er) { console.error(er); toast('Falhou ao importar algumas fotos.'); } };
    rd.readAsText(f); return;
  }
  if (e.target.id === 'arqImport') {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      let o; try { o = JSON.parse(rd.result); } catch (er) { toast('Arquivo inválido.'); return; }
      if (o && o.tipo === 'forja-fotos') { toast('Importando fotos…'); importarFotos(o).catch(() => toast('Falhou ao importar algumas fotos.')); return; }
      if (!o || typeof o !== 'object' || !('dias' in o) || !('cfg' in o)) { toast('Este arquivo não é uma cópia da Forja.'); return; }
      const nd = Object.keys(o.dias || {}).length;
      if (!(await confirmar('Importar a cópia (' + nd + ' dias registrados)? Os dados atuais deste aparelho serão substituídos.', 'Importar'))) return;
      S = migrar(o); salvar(); render(); toast('Cópia importada.');
    };
    rd.readAsText(f); e.target.value = '';
  }
});

/* ===================== início ===================== */
/* atalhos do ícone do app (manifest "shortcuts"): index.html?acao=agua|refeicao|treino|peso */
function atalhoInicial() {
  let a = null; try { a = new URLSearchParams(location.search).get('acao'); } catch (e) { }
  if (!a) return;
  try { history.replaceState(null, '', location.pathname); } catch (e) { }
  dataSel = hojeISO();
  if (a === 'agua') folhaAgua();
  else if (a === 'refeicao') folhaBusca(refeicaoAgora(), true);
  else if (a === 'treino') { subTreino = 'hoje'; irAba('treino'); }
  else if (a === 'peso') folhaPeso();
}
/* campos de arquivo escondidos: existem em qualquer aba (Importar cópia aparece em Hoje e em Eu) */
['arqFotos', 'arqImport'].forEach(id => { const i = document.createElement('input'); i.type = 'file'; i.id = id; i.accept = '.json,application/json'; i.hidden = true; document.body.appendChild(i); });
/* a cópia de antes da 1.6 não coube no aparelho: oferece baixar antes de qualquer coisa */
function avisoCopiaAntes() {
  if (!textoAntes) return;
  const fl = abrirFolha('<h2>Atualização para a versão 1.6</h2><p class="sub" style="margin:6px 0 12px">O app organizou os seus dados para a versão nova. Não coube guardar uma cópia de como estavam antes, então baixe agora e guarde o arquivo: ele só serve se você precisar voltar para a versão anterior.</p><div class="grade2"><button class="btn" id="caF">Agora não</button><button class="btn pri" id="caB">Baixar cópia</button></div>', el => {
    $('#caF', el).onclick = () => fecharFolha(fl);
    $('#caB', el).onclick = () => { baixarTexto(textoAntes, 'forja-copia-antes-1.6.json'); fecharFolha(fl); toast('Cópia baixada. Guarde o arquivo.'); };
  });
}
if (!window.ALIM || !window.EX) {
  document.getElementById('main').innerHTML = '<div class="aviso">Os dados de alimentos e exercícios não carregaram. O arquivo pode estar incompleto: baixe o app de novo.</div>';
} else {
  render();
  /* reabriu o app no meio do treino: a tela volta a ficar acesa */
  if (treinoEmAndamento()) telaAcesa(true);
  avisoCopiaAntes();
  if (!textoAntes) atalhoInicial();
}
/* virada do dia com o app aberto */
let ultimoHoje = hojeISO();
/* contador do jejum na tela Hoje */
setInterval(() => { if (aba === 'hoje' && S.jejum && dataSel === hojeISO() && !$('.fundo') && document.visibilityState === 'visible') render(); }, 60000);
setInterval(() => { const h = hojeISO(); if (h !== ultimoHoje) { if (dataSel === ultimoHoje) dataSel = h; ultimoHoje = h; if (!$('.fundo')) render(); } }, 60000);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
