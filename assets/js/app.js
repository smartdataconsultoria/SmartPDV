// ─── AUTENTICAÇÃO ────────────────────────────────────────────────────────────
// Credenciais Supabase — fixas no código
var SUPABASE_URL = 'https://tnaasnshthzyvbfxxerg.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuYWFzbnNodGh6eXZiZnh4ZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MzM0NjgsImV4cCI6MjA4OTEwOTQ2OH0.8iYQ6kAhNrtucanFCPfYrwNN18YmFeQ8JfwGPRUZxs4';

function initSupabase() {
  // Credenciais já embutidas — não precisa de configuração manual
  SUPABASE_URL = SUPABASE_URL || ls('sb-url') || '';
  SUPABASE_KEY = SUPABASE_KEY || ls('sb-key') || '';
}

function cpfParaEmail(cpf) {
  // Converte CPF em e-mail interno para o Supabase Auth
  var limpo = cpf.replace(/\D/g,'');
  return limpo + '@smartpdv.app';
}

function fazerLogin() {
  var cpf   = (document.getElementById('login-email').value || '').trim();
  var senha = (document.getElementById('login-senha').value || '').trim();
  var errEl = document.getElementById('login-error');

  if (errEl) { errEl.style.display='none'; errEl.textContent=''; }
  if (!cpf || !senha) { mostrarErroLogin('Preencha o CPF e a senha.'); return; }

  var cpfLimpo = cpf.replace(/\D/g,'');
  var btnEl    = document.getElementById('login-btn');
  var loadEl   = document.getElementById('login-loading');
  if (btnEl)  btnEl.disabled = true;
  if (loadEl) { loadEl.style.display='block'; loadEl.textContent='⏳ Verificando...'; }

  fetch(SUPABASE_URL + '/rest/v1/promotores?select=id,nome,cpf,loja,ativo&cpf=eq.' + cpfLimpo + '&senha=eq.' + encodeURIComponent(senha), {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  })
  .then(function(r) {
    return r.text().then(function(txt) { return { status: r.status, txt: txt }; });
  })
  .then(function(res) {
    if (btnEl)  btnEl.disabled = false;
    if (loadEl) loadEl.style.display = 'none';

    var dados = null;
    try { dados = JSON.parse(res.txt); } catch(e) {}

    if (res.status === 200 && Array.isArray(dados) && dados.length > 0) {
      var p = dados[0];
      lss('auth-cpf', cpf);
      lss('auth-token', SUPABASE_KEY);
      lss('promotor-nome', p.nome || cpfLimpo);
      lss('promotor-id', String(p.id || ''));
      if (p.loja) lss('promotor-loja', p.loja);
      if (loadEl) { loadEl.style.display='block'; loadEl.textContent='⏳ Carregando seus dados...'; }
      buscarProdutosDoBanco(function() {
        if (loadEl) loadEl.style.display='none';
        entrarNoApp();
      });
    } else if (res.status === 200 && Array.isArray(dados) && dados.length === 0) {
      mostrarErroLogin('CPF ou senha incorretos.');
    } else {
      mostrarErroLogin('Erro ' + res.status + ': ' + res.txt.slice(0, 80));
    }
  })
  .catch(function(e) {
    if (btnEl)  btnEl.disabled = false;
    if (loadEl) loadEl.style.display = 'none';
    mostrarErroLogin('Erro de conexão: ' + String(e));
  });
}







function mostrarErroLogin(msg) {
  var el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function entrarNoApp() {
  document.getElementById('sc-login').style.display = 'none';
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  document.getElementById('sc-home').classList.add('active');
  var nav = document.getElementById('main-nav');
  if (nav) nav.style.display = 'flex';
  initApp();
  calcMeta();
}

function verificarSessao() {
  // Autenticação via banco — verifica se tem sessão local válida
  var cpf  = ls('auth-cpf');
  var nome = ls('promotor-nome');
  if (cpf && nome) {
    entrarNoApp();
  } else {
    mostrarLogin();
  }
}

function mostrarLogin() {
  document.getElementById('sc-login').style.display = 'flex';
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  var nav2 = document.getElementById('main-nav'); if (nav2) nav2.style.display = 'none';
}


// ─── CARREGAR DADOS DO BANCO NO LOGIN ────────────────────────────────────────
function carregarDadosDoBanco(promotorId, callback) {
  var pid = String(promotorId || ls('promotor-id') || '').trim();
  var cpf = String(ls('auth-cpf') || '').replace(/\D/g,'');
  var chProd = 'p:' + cpf + ':cadastro-produtos';
  var chConc = 'p:' + cpf + ':cadastro-concorrentes';

  var url = SUPABASE_URL + '/rest/v1/produtos?select=id,nome,sku,minimo,preco_sugerido,fornecedor,lojas&promotor_id=eq.' + pid + '&order=nome';

  fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Accept': 'application/json'
    }
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function(prods) {
    var lista = Array.isArray(prods) ? prods.map(function(p) {
      return { id: p.id, nome: p.nome||'', sku: p.sku||'', minimo: p.minimo||0, preco_sugerido: p.preco_sugerido||0, fornecedor: p.fornecedor||'', lojas: pgArray(p.lojas) };
    }) : [];
    localStorage.setItem(chProd, JSON.stringify(lista));

    return fetch(SUPABASE_URL + '/rest/v1/concorrentes?select=id,produto_id,empresa,produto_similar&promotor_id=eq.' + pid, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Accept': 'application/json'
      }
    });
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP conc ' + r.status);
    return r.json();
  })
  .then(function(concs) {
    var lista = Array.isArray(concs) ? concs.map(function(c) {
      return { id: c.id, produto_id: c.produto_id, empresa: c.empresa||'', similar: c.produto_similar||'' };
    }) : [];
    localStorage.setItem(chConc, JSON.stringify(lista));
    if (typeof callback === 'function') callback();
  })
  .catch(function(e) {
    console.error('[SmartPDV] Erro carregarDadosDoBanco:', e);
    if (typeof callback === 'function') callback();
  });
}

function fazerLogout() {
  lss('auth-token',''); lss('auth-cpf','');
  lss('promotor-nome',''); lss('promotor-id','');
  lss('promotor-loja',''); lss('promotor-rede',''); lss('promotor-cidade','');
  estSistema={}; estGondola={}; precoProp={}; precoConc={};
  avarias=[]; oportunidades=[]; expoChecks=0; produtos=[];
  mostrarLogin();
  var em = document.getElementById('login-email');
  var se = document.getElementById('login-senha');
  if (em) em.value = '';
  if (se) se.value = '';
}

window.onload = function() {
  var nav = document.getElementById('main-nav');
  if (nav) nav.style.display = 'none';
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  if (ls('tema') === 'light') document.body.classList.add('light');
  var cpfEl = document.getElementById('login-email');
  if (cpfEl) {
    cpfEl.oninput = function() {
      var v = this.value.replace(/\D/g,'').slice(0,11);
      if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/,'$1.$2.$3-$4');
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/,'$1.$2.$3');
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/,'$1.$2');
      this.value = v;
    };
    cpfEl.onkeydown = function(e){ if(e.key==='Enter'){ var s=document.getElementById('login-senha'); if(s)s.focus(); } };
  }
  var senhaEl = document.getElementById('login-senha');
  if (senhaEl) senhaEl.onkeydown = function(e){ if(e.key==='Enter') fazerLogin(); };
  verificarSessao();
};

// ─── DADOS DE PRODUTOS ───────────────────────────────────────────────────────
// Produtos carregados do localStorage (cadastrados em Config)
// ─── GERADOR DE UUID ──────────────────────────────────────────────────────────
function gerarUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ─── CACHE EM MEMÓRIA (sempre vem do banco, nunca do localStorage) ────────────
var _produtosCache = [];
var _concorrentesCache = [];

function carregarProdutos() { return _produtosCache; }
function carregarConcorrentes() { return _concorrentesCache; }

function getProdutos() {
  var lojaAtiva = ls('promotor-loja') || '';
  // Filtrar por loja ativa — se produto tem lojas definidas, mostra só na loja certa
  // Se produto não tem lojas definidas (array vazio), aparece em todas
  var filtrados = _produtosCache.filter(function(p) {
    if (!p.lojas || !p.lojas.length) return true;
    return p.lojas.indexOf(lojaAtiva) !== -1;
  });
  return filtrados.map(function(p) {
    var conc = _concorrentesCache.find(function(c){ return c.produto_id === p.id; });
    return Object.assign({}, p, {
      concorrente: conc ? {nome: conc.produto_similar || conc.similar, empresa: conc.empresa} : null,
      sistema: {gondola: 0, deposito: 0, total: 0}
    });
  });
}

// Busca produtos e concorrentes do banco e atualiza o cache em memória

// Converte array PostgreSQL {val1,val2} ou JSON ["val1"] para array JS
function pgArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    // Formato PostgreSQL: {"Fit Camisas -ZN","Fit Camisas -ZS"}
    if (val.startsWith('{')) {
      var inner = val.slice(1, -1);
      if (!inner) return [];
      return inner.split(',').map(function(s) {
        return s.replace(/^"(.*)"$/, '$1').trim();
      });
    }
    // Formato JSON string
    try { return JSON.parse(val); } catch(e) { return []; }
  }
  return [];
}

function buscarProdutosDoBanco(callback) {
  var pid = ls('promotor-id') || '';
  if (!pid) { if (callback) callback(); return; }

  Promise.all([
    fetch(SUPABASE_URL + '/rest/v1/produtos?select=id,nome,sku,minimo,preco_sugerido,fornecedor,lojas&promotor_id=eq.' + pid + '&order=nome', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' }
    }).then(function(r){ return r.ok ? r.json() : []; }),
    fetch(SUPABASE_URL + '/rest/v1/concorrentes?select=id,produto_id,empresa,produto_similar&promotor_id=eq.' + pid, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' }
    }).then(function(r){ return r.ok ? r.json() : []; }),
    fetch(SUPABASE_URL + '/rest/v1/lojas?select=id,nome,rede,cidade&promotor_id=eq.' + pid + '&order=criado_em', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' }
    }).then(function(r){ return r.ok ? r.json() : []; })
  ])
  .then(function(res) {
    _produtosCache = Array.isArray(res[0]) ? res[0].map(function(p) {
      return { id: p.id, nome: p.nome||'', sku: p.sku||'', minimo: p.minimo||0, preco_sugerido: p.preco_sugerido||0, fornecedor: p.fornecedor||'', lojas: pgArray(p.lojas) };
    }) : [];
    _concorrentesCache = Array.isArray(res[1]) ? res[1].map(function(c) {
      return { id: c.id, produto_id: c.produto_id, empresa: c.empresa||'', similar: c.produto_similar||'' };
    }) : [];
    _lojasCache = Array.isArray(res[2]) ? res[2] : [];
    produtos = getProdutos();
    if (typeof callback === 'function') callback();
  })
  .catch(function(e) {
    console.error('[SmartPDV] buscarProdutosDoBanco erro:', e);
    if (typeof callback === 'function') callback();
  });
}

var produtos = [];

// Estado da sessão

// ─── CHAVE POR LOJA ───────────────────────────────────────────────────────────
function lojaKey(suffix) {
  var loja = ls('promotor-loja') || 'default';
  return 'loja:' + loja + ':' + suffix;
}
function lsLoja(suffix) {
  return localStorage.getItem(lojaKey(suffix));
}
function lssLoja(suffix, val) {
  localStorage.setItem(lojaKey(suffix), val);
}
function lsLojaObj(suffix) {
  try { return JSON.parse(lsLoja(suffix) || 'null'); } catch(e){ return null; }
}
function lssLojaObj(suffix, obj) {
  lssLoja(suffix, JSON.stringify(obj));
}

var estSistema  = {};
var estGondola  = {};
var precoProp   = {};
var precoConc   = {};
var avarias     = [];
var oportunidades = [];
var expoChecks  = 0;

// ─── CARREGAR/SALVAR ESTADO POR LOJA ─────────────────────────────────────────
function limparEstoqueParaHoje() {
  // Ao abrir o app, sempre começar com campos em branco
  estSistema = {}; estGondola = {}; precoProp = {};
  lssLojaObj('estoque', { sistema:{}, gondola:{}, preco:{}, conc: precoConc||{} });
}

function carregarEstadoLoja() {
  // Estoque SEMPRE começa em branco — dados vêm do banco via data
  estSistema = {};
  estGondola = {};
  precoProp  = {};
  precoConc  = lsLojaObj('estoque') ? (lsLojaObj('estoque').conc || {}) : {};
  avarias       = lsLojaObj('avarias') || [];
  oportunidades = lsLojaObj('oportunidades') || [];
  expoChecks    = parseInt(lsLoja('expo-checks') || '0');

  // Meta da loja
  var fr = lsLoja('fat-real') || '';
  var fm = lsLoja('fat-meta') || '';
  var elR = document.getElementById('fat-real-input');
  var elM = document.getElementById('fat-meta-input');
  var elCR = document.getElementById('cfg-realizado');
  var elCM = document.getElementById('cfg-meta');
  if (elR) elR.value = fr;
  if (elM) elM.value = fm;
  if (elCR) elCR.value = fr;
  if (elCM) elCM.value = fm;
  calcMeta();
}

function salvarEstadoLoja() {
  lssLojaObj('estoque', {sistema: estSistema, gondola: estGondola, preco: precoProp, conc: precoConc});
  lssLojaObj('avarias', avarias);
  lssLojaObj('oportunidades', oportunidades);
  lssLoja('expo-checks', expoChecks);
}
var expoTotal   = 8;


// ─── LIMPEZA DE EMERGÊNCIA ────────────────────────────────────────────────────
function limparEstoqueLocalStorage() {
  // Remove TODAS as chaves de estoque do localStorage
  var keysParaRemover = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && (k.indexOf(':estoque') !== -1 || k.indexOf('est-ultimo') !== -1)) {
      keysParaRemover.push(k);
    }
  }
  keysParaRemover.forEach(function(k){ localStorage.removeItem(k); });
  estSistema={}; estGondola={}; precoProp={};
  renderEstoque();
  alert('✓ Cache de estoque limpo! (' + keysParaRemover.length + ' chaves removidas)');
}


// ─── CORRIGIR LANÇAMENTO ──────────────────────────────────────────────────────
function editarLancamento() {
  var dataLanc = lsLoja('data-lancamento') || new Date().toISOString().slice(0,10);
  var hoje     = new Date().toISOString().slice(0,10);
  var loja     = ls('promotor-loja') || '';
  var token    = ls('auth-token') || SUPABASE_KEY;

  // Verificar se há campos preenchidos para corrigir
  var temDados = produtos.some(function(p) {
    return estSistema[p.id] !== undefined || estGondola[p.id] !== undefined;
  });
  if (!temDados) {
    alert('Preencha os campos com os valores corretos antes de corrigir.');
    return;
  }

  if (!confirm('Isso vai SUBSTITUIR o lançamento de ' + dataLanc + ' pelos valores atuais na tela.\nDeseja continuar?')) return;

  // Deletar registros do dia selecionado para esta loja
  var urlDelete = SUPABASE_URL + '/rest/v1/estoque' +
    '?loja=eq.' + encodeURIComponent(loja) +
    '&data_registro=gte.' + dataLanc + 'T00:00:00.000Z' +
    '&data_registro=lte.' + dataLanc + 'T23:59:59.999Z';

  fetch(urlDelete, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token }
  })
  .then(function(r) {
    if (!r.ok) {
      return r.text().then(function(t){ throw new Error('Erro ao remover: ' + t); });
    }
    // Inserir novos registros
    var registros = [];
    produtos.forEach(function(p) {
      var sis   = parseInt(estSistema[p.id]) || 0;
      var gon   = parseInt(estGondola[p.id]) || 0;
      var preco = precoProp[p.id] ? parseFloat(String(precoProp[p.id]).replace(',','.')) : null;
      registros.push({
        promotor:         ls('promotor-nome') || '',
        loja:             loja,
        produto_nome:     p.nome,
        sku:              p.sku,
        qtd_sistema:      sis,
        qtd_gondola:      gon,
        preco_encontrado: preco,
        preco_sugerido:   p.preco_sugerido || 0
      });
    });
    return fetch(SUPABASE_URL + '/rest/v1/estoque', {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal'
      },
      body: JSON.stringify(registros)
    });
  })
  .then(function(r) {
    if (r && r.ok) {
      lssLoja('est-ultimo-lancamento', dataLanc);
      alert('✓ Lançamento de ' + dataLanc + ' corrigido com sucesso!');
      atualizarHome();
      renderEstoque();
    } else if (r) {
      r.text().then(function(t){ alert('Erro ao salvar correção: ' + t.slice(0,150)); });
    }
  })
  .catch(function(e) {
    alert('Erro: ' + String(e));
  });
}

// ─── CLOCK ───────────────────────────────────────────────────────────────────
function tick() {
  var now = new Date();
  var t = now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  var h = now.getHours();
  var gr = h<12?'Bom dia!':h<18?'Boa tarde!':'Boa noite!';
  var d = now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  d = d.charAt(0).toUpperCase()+d.slice(1);
  setTxt('hclock',t); setTxt('clk-est',t); setTxt('greeting',gr); setTxt('hdate',d);
}
function setTxt(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
tick(); setInterval(tick,30000);


// ─── LOJAS MÚLTIPLAS ──────────────────────────────────────────────────────────
// ─── LOJAS — SEMPRE DO BANCO ─────────────────────────────────────────────────
var _lojasCache = [];

function carregarLojas() { return _lojasCache; }

function buscarLojasDoBanco(callback) {
  var pid = ls('promotor-id') || '';
  if (!pid) { if (callback) callback(); return; }
  fetch(SUPABASE_URL + '/rest/v1/lojas?select=id,nome,rede,cidade&promotor_id=eq.' + pid + '&order=criado_em', {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' }
  })
  .then(function(r) { return r.ok ? r.json() : []; })
  .then(function(lojas) {
    _lojasCache = Array.isArray(lojas) ? lojas : [];
    if (callback) callback();
  })
  .catch(function(e) {
    console.error('[SmartPDV] buscarLojasDoBanco erro:', e);
    if (callback) callback();
  });
}

function addLoja() {
  var nome   = document.getElementById('nova-loja-nome').value.trim();
  var rede   = document.getElementById('nova-loja-rede').value.trim();
  var cidade = document.getElementById('nova-loja-cidade').value.trim();
  if (!nome) { alert('Informe o nome da loja.'); return; }
  if (_lojasCache.length >= 5) { alert('Limite de 5 lojas atingido.'); return; }
  if (_lojasCache.find(function(l){ return l.nome === nome; })) { alert('Loja já cadastrada.'); return; }
  var pid = ls('promotor-id') || '';
  fetch(SUPABASE_URL + '/rest/v1/lojas', {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ promotor_id: pid, nome: nome, rede: rede, cidade: cidade })
  })
  .then(function(r) { return r.ok ? r.json() : null; })
  .then(function(salvo) {
    if (!salvo) { alert('Erro ao salvar loja.'); return; }
    document.getElementById('nova-loja-nome').value = '';
    document.getElementById('nova-loja-rede').value = '';
    document.getElementById('nova-loja-cidade').value = '';
    buscarLojasDoBanco(function() {
      // Se for a primeira loja, ativar automaticamente
      if (_lojasCache.length === 1) {
        lss('promotor-loja', nome);
        lss('promotor-rede', rede);
        lss('promotor-cidade', cidade);
        syncLoja();
      }
      renderLojas();
      alert('✓ Loja adicionada!');
    });
  })
  .catch(function() { alert('Erro de conexão ao salvar loja.'); });
}

function removerLoja(id) {
  if (!confirm('Remover esta loja?')) return;
  fetch(SUPABASE_URL + '/rest/v1/lojas?id=eq.' + id, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  })
  .then(function() {
    buscarLojasDoBanco(function() {
      renderLojas();
      syncLoja();
    });
  })
  .catch(function() { alert('Erro ao remover loja.'); });
}

function renderLojas() {
  var lista = carregarLojas();
  var el = document.getElementById('lojas-lista');
  if (!el) return;
  var ativa = ls('promotor-loja') || '';
  if (!lista.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px 0 4px">Nenhuma loja cadastrada.</div>';
    return;
  }
  el.innerHTML = lista.map(function(l) {
    var isAtiva = l.nome === ativa;
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)">' +
      '<div style="flex:1;cursor:pointer" data-lid="' + l.id + '" onclick="selecionarLoja(this.dataset.lid)">' +
        '<div style="font-size:13px;font-weight:600;color:' + (isAtiva ? 'var(--brand)' : 'var(--text)') + '">' +
          (isAtiva ? '▶ ' : '') + l.nome + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + (l.rede||'') + (l.cidade ? ' · '+l.cidade : '') + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;align-items:center">' +
        (!isAtiva ? '<button data-lid="' + l.id + '" onclick="selecionarLoja(this.dataset.lid)" style="background:var(--brand-light);color:var(--brand);border:1px solid var(--brand);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-weight:600">Ativar</button>' : '<span style="font-size:10px;color:var(--brand);font-weight:600">ATIVA</span>') +
        '<button data-lid="' + l.id + '" onclick="removerLoja(this.dataset.lid)" style="background:var(--red-bg);color:var(--red);border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function selecionarLoja(id) {
  var loja = _lojasCache.find(function(l){ return l.id === id; });
  if (!loja) return;
  // Salvar estado da loja atual antes de trocar
  salvarEstadoLoja();
  lss('promotor-loja', loja.nome);
  lss('promotor-rede', loja.rede || '');
  lss('promotor-cidade', loja.cidade || '');
  // Limpar estado em memória
  estSistema={}; estGondola={}; precoProp={}; precoConc={};
  avarias=[]; oportunidades=[]; expoChecks=0;
  document.querySelectorAll('#sc-exposicao .cb').forEach(function(cb){ cb.classList.remove('on'); });
  var obsExp = document.getElementById('obs-exp'); if (obsExp) obsExp.value='';
  var fprev = document.getElementById('foto-preview');
  if (fprev) { fprev.style.display='none'; fprev.innerHTML=''; }
  var fill = document.getElementById('exp-fill'); if (fill) fill.style.width='0%';
  setTxt('exp-pct','0%'); setTxt('exp-lbl','0 de 8 itens');
  carregarEstadoLoja();
  limparEstoqueParaHoje();
  renderDesempHistorico();
  syncLoja();
  renderLojas();
  renderEstoque();
  renderConcorrentes();
  renderAvarias();
  renderOportunidades();
  atualizarHome();
  calcMeta();
  carregarDataLancamento();
  fecharSeletorLoja();
  alert('✓ Loja alterada para: ' + loja.nome);
}

function abrirSeletorLoja() {
  var lista = carregarLojas();
  var seletor = document.getElementById('seletor-lojas');
  if (!seletor) return;
  if (seletor.style.display !== 'none') { fecharSeletorLoja(); return; }
  if (!lista.length) {
    alert('Cadastre suas lojas em ⚙️ Config primeiro.');
    return;
  }
  var ativa = ls('promotor-loja') || '';
  seletor.innerHTML = lista.map(function(l) {
    var isAtiva = l.nome === ativa;
    return '<div data-lid="' + l.id + '" onclick="selecionarLoja(this.dataset.lid)" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">' +
      '<div>' +
        '<div style="font-size:13px;font-weight:' + (isAtiva?'700':'500') + ';color:' + (isAtiva?'var(--brand)':'var(--text)') + '">' + l.nome + '</div>' +
        '<div style="font-size:11px;color:var(--text3)">' + (l.rede||'') + (l.cidade?' · '+l.cidade:'') + '</div>' +
      '</div>' +
      (isAtiva ? '<span style="font-size:10px;color:var(--brand);font-weight:700">●</span>' : '') +
    '</div>';
  }).join('');
  seletor.style.display = 'block';
}

function fecharSeletorLoja() {
  var seletor = document.getElementById('seletor-lojas');
  if (seletor) seletor.style.display = 'none';
}

// ─── LOJA ────────────────────────────────────────────────────────────────────
function syncLoja() {
  var lista = carregarLojas();
  var l = ls('promotor-loja') || '';
  if (!l && lista.length) { l = lista[0].nome; lss('promotor-loja', l); }
  var display = l || 'Selecionar loja ▾';
  ['loja-header','loja-est','loja-exp','loja-conc','loja-av','loja-desemp','loja-op'].forEach(function(id){setTxt(id,display);});
  var nome = ls('promotor-nome')||'';
  var nomeEl = document.getElementById('home-promotor-nome');
  if (nomeEl) nomeEl.textContent = nome;
  // Mostrar CPF logado no Config
  var cpfEl = document.getElementById('cfg-usuario-logado');
  if (cpfEl) cpfEl.textContent = ls('auth-cpf') || ls('auth-email') || '';
}
function ls(k){return localStorage.getItem(k);}
function lss(k,v){localStorage.setItem(k,v);}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function navTo(name) {
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('.ni').forEach(function(b){b.classList.remove('active');});
  document.getElementById('sc-'+name).classList.add('active');
  document.getElementById('ni-'+name).classList.add('active');
  window.scrollTo(0,0);
  // Ao entrar em Config, sempre recarregar do banco
  if (name === 'config') {
    buscarProdutosDoBanco(function() {
      renderLojas();
      renderCadastroProdutos();
      renderCadastroConcorrentes();
      renderNpLojasCheck();
    });
  }
  if (name === 'estoque') {
    buscarProdutosDoBanco(function() {
      renderEstoque();
    });
  }
}

// ─── RENDER ESTOQUE ───────────────────────────────────────────────────────────
function renderEstoque() {
  var el = document.getElementById('lista-est');
  if (!el) return;
  if (!produtos.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Cadastre seus produtos em ⚙️ Config para registrar o estoque.</div>';
    return;
  }

  // Carregar histórico do localStorage para mostrar saldo anterior
  var historico = JSON.parse(localStorage.getItem('est-historico-' + (ls('promotor-loja')||'')) || '{}');
  var hoje = new Date().toISOString().slice(0,10);

  var html = '';
  produtos.forEach(function(p) {
    var sis  = estSistema[p.id] !== undefined ? estSistema[p.id] : '';
    var gon  = estGondola[p.id] !== undefined ? estGondola[p.id] : '';
    var prp  = precoProp[p.id] || '';

    // Saldo anterior — último lançamento salvo
    var ant = historico[p.id] || null;
    var antTxt = '';
    if (ant && ant.data !== hoje) {
      antTxt = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 10px;margin-bottom:8px;font-size:11px;color:var(--text3)">' +
        '📅 Último lançamento (' + ant.data + '): ' +
        '<span style="color:var(--text2);font-weight:600">Sis: ' + (ant.sis||'—') + ' un</span> · ' +
        '<span style="color:var(--text2);font-weight:600">Gôn: ' + (ant.gon||'—') + ' un</span>' +
        (ant.preco ? ' · <span style="color:var(--brand);font-weight:600">R$ ' + ant.preco + '</span>' : '') +
      '</div>';
    } else if (ant && ant.data === hoje) {
      antTxt = '<div style="background:var(--green-bg);border:1px solid var(--green);border-radius:var(--radius-sm);padding:7px 10px;margin-bottom:8px;font-size:11px;color:var(--green)">' +
        '✓ Já lançado hoje' +
      '</div>';
    }

    // Badge
    var sisNum = sis !== '' ? parseInt(sis) : null;
    var gonNum = gon !== '' ? parseInt(gon) : null;
    var refQtd = (sisNum !== null && sisNum > 0) ? sisNum : gonNum;
    var abaixoMin = refQtd !== null && refQtd < p.minimo;
    var statusCls, statusTxt;
    if (refQtd === null) { statusCls='b-neutral'; statusTxt='Preencher'; }
    else if (abaixoMin)  { statusCls='b-danger';  statusTxt='Crítico'; }
    else                 { statusCls='b-ok';       statusTxt='OK'; }

    var pct = (refQtd !== null && p.minimo > 0) ? Math.min(100, Math.round((refQtd/p.minimo)*100)) : 0;
    var barColor = abaixoMin ? 'var(--red)' : (refQtd === null ? 'var(--border)' : 'var(--green)');

    html += '<div class="ei">' +
      '<div class="ei-head">' +
        '<div><div class="ei-nome">'+p.nome+'</div><div class="ei-sku">'+p.sku+' · Mín: '+p.minimo+' un</div></div>' +
        '<span class="badge '+statusCls+'" id="badge-status-'+p.id+'">'+statusTxt+'</span>' +
      '</div>' +
      antTxt +
      '<div class="ei-cols">' +
        '<div class="ei-col">' +
          '<div class="ei-col-lbl">📊 Sist. empresa</div>' +
          '<input class="fis-input" type="number" inputmode="numeric" placeholder="—" id="sis-'+p.id+'" value="'+sis+'" data-sid="'+ p.id +'" oninput="onSis(this.dataset.sid)">' +
          '<div class="sys-sub" style="margin-top:3px">Ref: '+p.minimo+' (mínimo)</div>' +
          '<div class="pbar" style="margin-top:6px"><div class="pfill" style="width:'+pct+'%;background:'+barColor+'"></div></div>' +
          '<div style="font-size:10px;color:var(--text3);margin-top:2px">'+pct+'% do mínimo</div>' +
        '</div>' +
        '<div class="ei-col">' +
          '<div class="ei-col-lbl">🖐 Ponta gôndola</div>' +
          '<input class="fis-input" type="number" inputmode="numeric" placeholder="0" id="gon-'+p.id+'" value="'+gon+'" data-gid="'+ p.id +'" oninput="onGon(this.dataset.gid)">' +
          '<div class="sys-sub" style="margin-top:3px">unidades contadas</div>' +
        '</div>' +
      '</div>' +
      '<div class="ei-foot">' +
        '<div id="dif-'+p.id+'" class="dif-txt" style="color:var(--text3)">— preencha os campos</div>' +
      '</div>' +
      '<div class="ei-preco">' +
        '<div>' +
          '<div class="ei-preco-lbl">Preço na gôndola</div>' +
          '<div style="font-size:10px;color:var(--text3)">Sugerido: R$ '+p.preco_sugerido.toFixed(2).replace('.',',')+'</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
          '<input class="preco-mini" type="text" inputmode="decimal" placeholder="0,00" id="pp-'+p.id+'" value="'+prp+'" data-ppid="'+ p.id +'" oninput="onPrecoP(this.dataset.ppid)">' +
          '<span class="badge" id="ppb-'+p.id+'" style="font-size:10px">—</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  el.innerHTML = html;
}

var estoqueAlterado = false;
function marcarEstoqueAlterado() {
  if (!estoqueAlterado) { estoqueAlterado = true; var b=document.getElementById('banner-nao-salvo'); if(b)b.style.display='flex'; }
}
function marcarEstoqueSalvo() {
  estoqueAlterado = false; var b=document.getElementById('banner-nao-salvo'); if(b)b.style.display='none';
}
window.addEventListener('beforeunload', function(e) {
  if (estoqueAlterado) { e.preventDefault(); e.returnValue='Dados de estoque nao salvos!'; return e.returnValue; }
});
function onSis(pid) {
  var v = parseInt(document.getElementById('sis-'+pid).value);
  estSistema[pid] = isNaN(v)?undefined:v;
  calcDif(pid); marcarEstoqueAlterado();
}
function onGon(pid) {
  var v = parseInt(document.getElementById('gon-'+pid).value);
  estGondola[pid] = isNaN(v)?undefined:v;
  calcDif(pid); marcarEstoqueAlterado();
}
function calcDif(pid) {
  var el = document.getElementById('dif-'+pid);
  var p  = produtos.find(function(x){ return x.id===pid; });
  var sis = estSistema[pid];
  var gon = estGondola[pid];

  if (sis === undefined && gon === undefined) {
    el.textContent = '— preencha os campos'; el.className = 'dif-txt'; return;
  }

  var sisNum = (sis !== undefined && sis !== '') ? parseInt(sis) : null;
  var gonNum = (gon !== undefined && gon !== '') ? parseInt(gon) : null;

  // Referência para verificar mínimo: sistema se > 0, senão gôndola
  var refQtd = (sisNum !== null && sisNum > 0) ? sisNum : gonNum;
  var minimo  = p ? p.minimo : 0;

  // Mostrar diferença entre gôndola e sistema
  if (sisNum !== null && gonNum !== null) {
    var d = gonNum - sisNum;
    if (d === 0) { el.textContent = '✓ Gôndola igual ao sistema ('+gonNum+' un)'; el.className = 'dif-txt dif-ok'; }
    else if (d > 0) { el.textContent = '▲ +'+d+' un a mais na gôndola vs sistema'; el.className = 'dif-txt dif-warn'; }
    else { el.textContent = '▼ '+Math.abs(d)+' un a menos na gôndola vs sistema'; el.className = 'dif-txt dif-danger'; }
  } else if (sisNum !== null) {
    el.textContent = 'Sistema: '+sisNum+' un (sem contagem física)'; el.className = 'dif-txt';
  } else {
    el.textContent = 'Gôndola: '+gonNum+' un (sem dado do sistema)'; el.className = 'dif-txt';
  }

  // Atualizar badge no cabeçalho do produto
  var badgeEl = document.getElementById('badge-status-'+pid);
  if (badgeEl && refQtd !== null && minimo > 0) {
    if (refQtd < minimo) {
      badgeEl.className = 'badge b-danger'; badgeEl.textContent = 'Crítico';
    } else {
      badgeEl.className = 'badge b-ok'; badgeEl.textContent = 'OK';
    }
  }
  atualizarHome();
}
function onPrecoP(pid) {
  precoProp[pid] = document.getElementById('pp-'+pid).value;
  var raw = precoProp[pid].replace(',','.');
  var v = parseFloat(raw);
  var p = produtos.find(function(x){return x.id===pid;});
  var badge = document.getElementById('ppb-'+pid);
  if(isNaN(v)){badge.className='badge';badge.textContent='—';return;}
  var dif = ((v-p.preco_sugerido)/p.preco_sugerido)*100;
  if(Math.abs(dif)<=3){badge.className='badge b-ok';badge.textContent='OK';}
  else if(v>p.preco_sugerido){badge.className='badge b-danger';badge.textContent='▲ Acima';}
  else{badge.className='badge b-warn';badge.textContent='▼ Abaixo';}
  renderConcorrentes();
}

// ─── RENDER CONCORRENTES ─────────────────────────────────────────────────────
function renderConcorrentes() {
  var el = document.getElementById('lista-conc');
  if (!produtos.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Cadastre seus produtos em ⚙️ Config para ver os concorrentes.</div>';
    return;
  }
  var html = '';
  produtos.forEach(function(p) {
    var meuPreco  = precoProp[p.id] ? parseFloat(precoProp[p.id].replace(',','.')) : null;
    var concVal   = precoConc[p.id] || '';
    var concPreco = concVal ? parseFloat(concVal.replace(',','.')) : null;
    var compHtml = '—'; var compCls = 'b-neutral';
    if (meuPreco && concPreco) {
      var dif = meuPreco - concPreco;
      var pct = ((dif/concPreco)*100).toFixed(1);
      if (Math.abs(dif)<0.01){ compHtml='= Igual'; compCls='b-ok'; }
      else if (dif<0){ compHtml='✓ '+Math.abs(pct)+'% mais barato'; compCls='b-ok'; }
      else { compHtml='▲ '+pct+'% mais caro'; compCls='b-danger'; }
    }
    var meuVal    = meuPreco ? 'R$ '+meuPreco.toFixed(2).replace('.',',') : 'Preencher no Estoque';
    var temSimilar  = p.concorrente && p.concorrente.nome;
    var concEmpresa = temSimilar ? p.concorrente.empresa : '—';
    var concNome    = temSimilar ? p.concorrente.nome : 'Similar não cadastrado';
    var btnLabel    = concVal ? 'R$ '+concVal : 'Tocar para digitar';
    var btnCor      = concVal ? 'var(--brand)' : 'var(--text3)';

    html += '<div class="conc-item">' +
      '<div class="conc-head">' +
        '<div><div class="conc-nome">'+p.nome+'</div></div>' +
        '<span class="badge '+compCls+'" style="font-size:10px">'+compHtml+'</span>' +
      '</div>' +
      '<div class="conc-body">' +
        '<div class="conc-col">' +
          '<div class="conc-col-lbl">Meu preço</div>' +
          '<div class="conc-preco-val">'+meuVal+'</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:2px">Sugerido: R$ '+p.preco_sugerido.toFixed(2).replace('.',',')+'</div>' +
        '</div>' +
        '<div class="conc-col" style="display:flex;flex-direction:column;justify-content:center">' +
          '<div class="conc-col-lbl">'+concEmpresa+' — '+concNome+'</div>' +
          '<button data-pid="' + p.id + '" onclick="abrirInputConc(this.dataset.pid)" style="margin-top:6px;background:var(--surface2);border:2px solid var(--brand);border-radius:var(--radius-sm);padding:12px;width:100%;text-align:left;font-family:monospace;font-size:18px;font-weight:700;color:' + btnCor + ';cursor:pointer">' + btnLabel + '</button>' +
          '<div style="font-size:10px;color:var(--text3);margin-top:4px;text-align:center">toque para editar</div>' +
        '</div>' +
      '</div>' +
      '<div class="conc-foot">' +
        '<div style="font-size:11px;color:var(--text3)">Similar: '+concNome+'</div>' +
        '<span class="badge '+compCls+'" style="font-size:10px">'+compHtml+'</span>' +
      '</div>' +
    '</div>';
  });
  el.innerHTML = html;
  atualizarHomeConc();
}

function abrirInputConc(pid) {
  var atual = precoConc[pid] || '';
  var p = produtos.find(function(x){ return x.id===pid; });
  var nome = p ? p.nome : 'produto';
  var valor = prompt('Preço do concorrente\n' + nome + '\n\nDigite o valor (ex: 29,90):', atual);
  if (valor === null) return; // cancelou
  valor = valor.trim().replace(',','.');
  var num = parseFloat(valor);
  if (valor !== '' && isNaN(num)) { alert('Valor inválido. Use números, ex: 29.90'); return; }
  precoConc[pid] = valor !== '' ? num.toFixed(2).replace('.',',') : '';
  renderConcorrentes();
}

function onConc(pid) {
  precoConc[pid] = document.getElementById('conc-'+pid).value;
  renderConcorrentes();
}

// ─── EXPOSIÇÃO ────────────────────────────────────────────────────────────────
function tgl(item) {
  item.querySelector('.cb').classList.toggle('on');
  var total = document.querySelectorAll('#sc-exposicao .cb').length;
  var on = document.querySelectorAll('#sc-exposicao .cb.on').length;
  expoChecks = on; expoTotal = total;
  var pct = Math.round((on/total)*100);
  var fill = document.getElementById('exp-fill');
  if(fill) fill.style.width = pct+'%';
  setTxt('exp-pct', pct+'%');
  setTxt('exp-lbl', on+' de '+total+' itens marcados');
  atualizarHome();
}

function renderFotosExposicao() {
  var html = '';
  produtos.forEach(function(p) {
    html += '<div style="margin-bottom:10px">' +
      '<div style="font-size:12px;font-weight:500;color:var(--text2);margin-bottom:5px">'+p.nome+'</div>' +
      '<label style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px dashed var(--border);border-radius:var(--radius-sm);padding:10px;cursor:pointer;color:var(--text2);font-size:12px">' +
        '📷 Foto da exposição' +
        '<input type="file" accept="image/*" capture="environment" style="display:none" onchange="prevFoto(this,\'prev-'+p.id+'\')">' +
      '</label>' +
      '<div id="prev-'+p.id+'" style="display:none;margin-top:6px"></div>' +
    '</div>';
  });
  document.getElementById('fotos-lista').innerHTML = html;
}

function prevFoto(input, targetId) {
  if(!input.files||!input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var el = document.getElementById(targetId);
    if(el){el.style.display='block';el.innerHTML='<img src="'+e.target.result+'" style="width:100%;border-radius:var(--radius-sm);max-height:160px;object-fit:cover">';}
  };
  reader.readAsDataURL(input.files[0]);
}

function addFotoExtra() {
  var el = document.getElementById('fotos-lista');
  var div = document.createElement('div');
  div.style.marginBottom='10px';
  div.innerHTML = '<div style="font-size:12px;font-weight:500;color:var(--text2);margin-bottom:5px">Foto extra</div>' +
    '<label style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px dashed var(--border);border-radius:var(--radius-sm);padding:10px;cursor:pointer;color:var(--text2);font-size:12px">' +
      '📷 Foto extra' +
      '<input type="file" accept="image/*" capture="environment" style="display:none" onchange="prevFotoInline(this)">' +
    '</label>' +
    '<div class="foto-prev-inline" style="display:none;margin-top:6px"></div>';
  el.appendChild(div);
  setTimeout(function(){div.querySelector('input').click();},100);
}

function prevFotoInline(input) {
  if(!input.files||!input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var el = input.parentElement.parentElement.querySelector('.foto-prev-inline');
    if(el){el.style.display='block';el.innerHTML='<img src="'+e.target.result+'" style="width:100%;border-radius:var(--radius-sm);max-height:160px;object-fit:cover">';}
  };
  reader.readAsDataURL(input.files[0]);
}

// ─── AVARIAS ──────────────────────────────────────────────────────────────────
function renderSelectAvaria() {
  var sel = document.getElementById('av-produto');
  sel.innerHTML = '<option value="">Selecione o produto</option>';
  produtos.forEach(function(p){
    var opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.nome;
    sel.appendChild(opt);
  });
}

function prevAvaria(input) {
  if(!input.files||!input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var el = document.getElementById('av-prev');
    el.style.display='block';
    el.innerHTML='<img src="'+e.target.result+'" style="width:100%;border-radius:var(--radius-sm);max-height:160px;object-fit:cover">';
  };
  reader.readAsDataURL(input.files[0]);
}

function addAvaria() {
  var pid = document.getElementById('av-produto').value;
  var qty = parseInt(document.getElementById('av-qty').value);
  var tipo = document.getElementById('av-tipo').value;
  var obs = document.getElementById('av-obs').value.trim();
  if(!pid){alert('Selecione o produto.');return;}
  if(!qty||qty<1){alert('Informe a quantidade.');return;}
  if(!tipo){alert('Selecione o tipo de avaria.');return;}
  var p = produtos.find(function(x){return x.id===pid;});
  avarias.push({produto:p.nome, qty:qty, tipo:tipo, obs:obs, hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});
  document.getElementById('av-produto').value='';
  document.getElementById('av-qty').value='';
  document.getElementById('av-tipo').value='';
  document.getElementById('av-obs').value='';
  document.getElementById('av-prev').style.display='none';
  renderAvarias();
  atualizarHome();
}

function renderAvarias() {
  var el = document.getElementById('lista-av');
  if(!avarias.length){el.innerHTML='';return;}
  var html = '<div class="card"><div class="ct">Avarias registradas hoje ('+avarias.length+')</div>';
  avarias.forEach(function(av,i){
    html += '<div class="av-item">' +
      '<div class="av-head">' +
        '<div class="av-nome">'+av.produto+'</div>' +
        '<button class="av-remove" onclick="removeAvaria('+i+')">✕</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:6px">' +
        '<span class="badge b-danger">'+av.qty+' un</span>' +
        '<span class="badge b-warn">'+av.tipo+'</span>' +
        '<span class="badge b-neutral" style="font-size:10px">'+av.hora+'</span>' +
      '</div>' +
      (av.obs?'<div style="font-size:12px;color:var(--text2)">'+av.obs+'</div>':'') +
    '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function removeAvaria(i) {avarias.splice(i,1);renderAvarias();atualizarHome();}

// ─── DESEMPENHO ───────────────────────────────────────────────────────────────
function calcMeta() {
  var real = parseFloat(document.getElementById('fat-real-input').value)||0;
  var meta = parseFloat(document.getElementById('fat-meta-input').value)||0;
  var pct  = meta > 0 ? Math.min(100, Math.round((real / meta) * 100)) : 0;
  var falta = Math.max(0, meta - real);

  // Calcular dias úteis restantes no mês
  var hoje = new Date();
  var ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  var diasRestantes = 0;
  for (var d = hoje.getDate(); d <= ultimoDia; d++) {
    var dia = new Date(hoje.getFullYear(), hoje.getMonth(), d).getDay();
    if (dia !== 0 && dia !== 6) diasRestantes++;
  }
  diasRestantes = Math.max(1, diasRestantes);

  var vendaDiaria = diasRestantes > 0 ? Math.ceil(falta / diasRestantes) : falta;

  // Calcular valor de estoque (qtd gôndola × preço sugerido)
  var totalEstoqueValor = 0;
  var totalUnidades = 0;
  produtos.forEach(function(p) {
    var qtd = estGondola[p.id] !== undefined ? estGondola[p.id] : p.sistema.gondola;
    var preco = p.preco_sugerido || 0;
    totalEstoqueValor += qtd * preco;
    totalUnidades += qtd;
  });

  // Quantos dias de meta o estoque cobre
  var diasCobre = vendaDiaria > 0 ? Math.floor(totalEstoqueValor / vendaDiaria) : 0;

  // Atualizar tela home
  setTxt('home-meta-val', 'R$ ' + meta.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  setTxt('home-real-val', 'R$ ' + real.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  setTxt('home-meta-pct', pct + '%');
  setTxt('home-meta-dia', 'R$ ' + vendaDiaria.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  setTxt('home-meta-falta', 'R$ ' + falta.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  setTxt('home-dias-restantes', diasRestantes + ' dias úteis restantes');

  // Estoque
  setTxt('home-est-valor', 'R$ ' + Math.round(totalEstoqueValor).toLocaleString('pt-BR'));
  setTxt('home-est-unidades', totalUnidades + ' unidades');

  // Cobre a meta?
  var cobreEl = document.getElementById('home-est-cobre');
  var diasEl  = document.getElementById('home-est-dias-cobre');
  if (cobreEl) {
    if (vendaDiaria <= 0) {
      cobreEl.textContent = '—';
      cobreEl.style.color = 'var(--text3)';
      if (diasEl) diasEl.textContent = 'Defina a meta';
    } else if (totalEstoqueValor >= falta) {
      cobreEl.textContent = '✓ Sim';
      cobreEl.style.color = 'var(--green)';
      if (diasEl) diasEl.textContent = 'Estoque suficiente!';
    } else if (diasCobre >= 3) {
      cobreEl.textContent = diasCobre + ' dias';
      cobreEl.style.color = 'var(--amber)';
      if (diasEl) diasEl.textContent = 'Reposição necessária';
    } else {
      cobreEl.textContent = '⚠ ' + diasCobre + ' dia' + (diasCobre === 1 ? '' : 's');
      cobreEl.style.color = 'var(--red)';
      if (diasEl) diasEl.textContent = 'Estoque crítico!';
    }
  }

  var barEl = document.getElementById('home-meta-bar');
  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct >= 100 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : 'var(--brand)';
  }

  // Atualizar tela desempenho
  setTxt('desemp-real', 'R$ ' + real.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  setTxt('desemp-meta', 'R$ ' + meta.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  setTxt('desemp-pct-lbl', pct + '% da meta atingida');
  setTxt('desemp-falta', 'Falta: R$ ' + falta.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  var bar2 = document.getElementById('desemp-bar');
  if (bar2) {
    bar2.style.width = pct + '%';
    bar2.style.background = pct >= 100 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : 'var(--brand)';
  }
  setTxt('home-fat-pct', pct + '%');
  setTxt('home-fat-real', 'R$ ' + real.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  setTxt('home-fat-meta', 'R$ ' + meta.toLocaleString('pt-BR', {minimumFractionDigits:0}));
  var hbar = document.getElementById('home-fat-bar');
  if (hbar) hbar.style.width = pct + '%';
  // Atualizar projeção se tela de desempenho estiver visível
  calcProjecao(real, meta);
  renderDesempHistorico();
}

function renderDesempProdutos() {
  // Função mantida para compatibilidade — não exibe mais dados simulados
}

function renderDesempHistorico() {
  var historico = lsLojaObj('desemp-historico') || [];
  var el = document.getElementById('desemp-historico');
  if (!el) return;
  if (!historico.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px">Nenhuma atualização registrada ainda.</div>';
    return;
  }
  el.innerHTML = historico.slice().reverse().map(function(h) {
    var pct = h.meta > 0 ? Math.round((h.real/h.meta)*100) : 0;
    var cls = pct >= 100 ? 'b-ok' : pct >= 70 ? 'b-warn' : 'b-danger';
    return '<div class="res-row">' +
      '<div><div style="font-size:13px;color:var(--text)">' + h.data + '</div>' +
      '<div style="font-size:11px;color:var(--text3)">Meta: R$ ' + Number(h.meta).toLocaleString('pt-BR') + '</div></div>' +
      '<div style="text-align:right">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text)">R$ ' + Number(h.real).toLocaleString('pt-BR') + '</div>' +
        '<span class="badge ' + cls + '" style="font-size:10px">' + pct + '%</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function calcProjecao(real, meta) {
  // Calcular dias úteis passados e totais no mês
  var hoje = new Date();
  var diasPassados = 0, diasTotais = 0;
  var totalDias = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  for (var d = 1; d <= totalDias; d++) {
    var dia = new Date(hoje.getFullYear(), hoje.getMonth(), d).getDay();
    if (dia !== 0 && dia !== 6) {
      diasTotais++;
      if (d <= hoje.getDate()) diasPassados++;
    }
  }
  diasPassados = Math.max(1, diasPassados);
  var porDia = real / diasPassados;
  var projecao = porDia * diasTotais;
  setTxt('desemp-proj-dia', 'R$ ' + Math.round(porDia).toLocaleString('pt-BR'));
  setTxt('desemp-proj-fim', 'R$ ' + Math.round(projecao).toLocaleString('pt-BR'));
  var diff = projecao - meta;
  var txt = '';
  if (meta <= 0) {
    txt = 'Defina a meta para ver a projeção';
  } else if (diff >= 0) {
    txt = '✓ No ritmo atual, vai superar a meta em R$ ' + Math.round(diff).toLocaleString('pt-BR');
  } else {
    txt = '⚠ No ritmo atual, vai ficar R$ ' + Math.round(Math.abs(diff)).toLocaleString('pt-BR') + ' abaixo da meta';
  }
  setTxt('desemp-proj-txt', txt);
}

// ─── OPORTUNIDADES ────────────────────────────────────────────────────────────
function addOportunidade() {
  var tipo = document.getElementById('op-tipo').value;
  var prod = document.getElementById('op-produto').value.trim();
  var desc = document.getElementById('op-desc').value.trim();
  var prio = document.getElementById('op-prioridade').value;
  if(!tipo){alert('Selecione o tipo.');return;}
  if(!desc){alert('Preencha a descrição.');return;}
  oportunidades.push({tipo:tipo, produto:prod, desc:desc, prio:prio, hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});
  document.getElementById('op-tipo').value='';
  document.getElementById('op-produto').value='';
  document.getElementById('op-desc').value='';
  document.getElementById('op-prioridade').value='media';
  renderOportunidades();
  atualizarHome();
}

function renderOportunidades() {
  var el = document.getElementById('lista-op');
  if(!oportunidades.length){el.innerHTML='';return;}
  var prioCls = {alta:'b-danger',media:'b-warn',baixa:'b-neutral'};
  var prioTxt = {alta:'Alta',media:'Média',baixa:'Baixa'};
  var html = '<div class="card"><div class="ct">Oportunidades registradas ('+oportunidades.length+')</div>';
  oportunidades.forEach(function(op,i){
    html += '<div class="op-item">' +
      '<div class="op-text">' +
        '<div style="display:flex;gap:6px;margin-bottom:4px">' +
          '<span class="badge b-blue" style="font-size:10px">'+op.tipo+'</span>' +
          '<span class="badge '+prioCls[op.prio]+'" style="font-size:10px">'+prioTxt[op.prio]+'</span>' +
        '</div>' +
        (op.produto?'<div style="font-size:11px;font-weight:500;color:var(--text2);margin-bottom:3px">'+op.produto+'</div>':'') +
        '<div>'+op.desc+'</div>' +
        '<div class="op-sub">'+op.hora+'</div>' +
      '</div>' +
      '<button class="op-remove" onclick="removeOp('+i+')">✕</button>' +
    '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function removeOp(i){oportunidades.splice(i,1);renderOportunidades();atualizarHome();}

// ─── ATUALIZAR HOME ────────────────────────────────────────────────────────────
function atualizarHome() {
  // Estoque alertas
  var alerts = 0;
  produtos.forEach(function(p){
    var g = estGondola[p.id]!==undefined?estGondola[p.id]:p.sistema.gondola;
    if(g < p.minimo) alerts++;
  });
  setTxt('home-est-alert', alerts);
  setTxt('home-av', avarias.length);
  var pct = expoTotal>0?Math.round((expoChecks/expoTotal)*100):0;
  setTxt('home-expo-pct', pct+'%');
  var expFill = document.getElementById('home-expo-bar');
  if(expFill) expFill.style.width=pct+'%';
  setTxt('home-expo-val', pct+'%');
  setTxt('home-expo-txt', expoChecks+' de '+expoTotal+' itens do checklist');
  setTxt('home-op', oportunidades.length);

  // Resumo estoque no home
  var estHtml = '';
  produtos.forEach(function(p){
    var g = estGondola[p.id];
    var s = estSistema[p.id];
    if(g===undefined && s===undefined) return;
    var cls = (g!==undefined&&g<p.minimo)?'b-danger':(g!==undefined&&g<p.minimo*1.2)?'b-warn':'b-ok';
    estHtml += '<div class="res-row"><span style="color:var(--text2);font-size:12px">'+p.nome+'</span>' +
      '<span class="badge '+cls+'" style="font-size:10px">'+(g!==undefined?g+' un':'—')+'</span></div>';
  });
  if(estHtml) document.getElementById('home-est-body').innerHTML = estHtml;

  // Avarias home
  var avHtml = '';
  avarias.slice(0,3).forEach(function(av){
    avHtml += '<div class="res-row"><span style="color:var(--text2);font-size:12px">'+av.produto+'</span><span class="badge b-danger" style="font-size:10px">'+av.qty+' un</span></div>';
  });
  if(avHtml) document.getElementById('home-av-body').innerHTML = avHtml;

  // Oportunidades home
  var opHtml = '';
  oportunidades.slice(0,3).forEach(function(op){
    opHtml += '<div class="res-row"><span style="color:var(--text2);font-size:12px">'+op.tipo+'</span><span class="badge b-purple" style="font-size:10px">'+{alta:'Alta',media:'Média',baixa:'Baixa'}[op.prio]+'</span></div>';
  });
  if(opHtml) document.getElementById('home-op-body').innerHTML = opHtml;
  // Recalcular valor de estoque ao atualizar home
  calcMeta();
}

function atualizarHomeConc() {
  var html = '';
  produtos.forEach(function(p){
    var conc = precoConc[p.id];
    if(!conc) return;
    var meu = precoProp[p.id]?parseFloat(precoProp[p.id].replace(',','.')):null;
    var cv = parseFloat(conc.replace(',','.'));
    var cls = 'b-neutral', txt = conc;
    if(meu&&!isNaN(cv)){
      var d = ((meu-cv)/cv*100).toFixed(1);
      cls = meu<=cv?'b-ok':'b-danger';
      txt = meu<=cv?d+'% mais barato':'+'+d+'% mais caro';
    }
    html += '<div class="res-row"><span style="color:var(--text2);font-size:12px">'+p.nome+'</span><span class="badge '+cls+'" style="font-size:10px">'+txt+'</span></div>';
  });
  var el = document.getElementById('home-conc-body');
  if(el && html) el.innerHTML = html;
}

// ─── SALVAR ───────────────────────────────────────────────────────────────────
// ─── HELPER SUPABASE ─────────────────────────────────────────────────────────
function sbPost(tabela, payload) {
  var sbUrl = SUPABASE_URL;
  var sbKey = SUPABASE_KEY;
  // Usar token do usuário logado se disponível, senão usar anon key
  var token = ls('auth-token') || sbKey;
  return fetch(sbUrl + '/rest/v1/' + tabela, {
    method: 'POST',
    headers: {
      'apikey': sbKey,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  });
}

function sbGet(tabela, query) {
  var sbUrl = SUPABASE_URL;
  var sbKey = SUPABASE_KEY;
  var token = ls('auth-token') || sbKey;
  return fetch(sbUrl + '/rest/v1/' + tabela + (query||''), {
    method: 'GET',
    headers: {
      'apikey': sbKey,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
}

function sbConfig() {
  return {
    url: SUPABASE_URL || ls('sb-url'),
    key: SUPABASE_KEY || ls('sb-key'),
    promotor: ls('promotor-nome')||'Promotor',
    loja: ls('promotor-loja')||'Loja'
  };
}

// ─── SALVAR ESTOQUE ───────────────────────────────────────────────────────────
function salvarEstoque() {
  var cfg = sbConfig();

  // Bloquear lançamento para data futura
  var hoje = new Date().toISOString().slice(0,10);
  var dataLanc = lsLoja('data-lancamento') || hoje;
  if (dataLanc > hoje) {
    alert('Não é permitido salvar estoque para datas futuras.\nData selecionada: ' + dataLanc);
    return;
  }

  // Validação: todos os campos obrigatórios
  var faltando = [];
  produtos.forEach(function(p) {
    var semSis = estSistema[p.id] === undefined || estSistema[p.id] === null || String(estSistema[p.id]).trim() === '';
    var semGon = estGondola[p.id] === undefined || estGondola[p.id] === null || String(estGondola[p.id]).trim() === '';
    var campos = [];
    if (semSis) campos.push('sistema');
    if (semGon) campos.push('gôndola');
    if (campos.length > 0) faltando.push(p.nome + ' (' + campos.join(' e ') + ')');
  });
  if (faltando.length > 0) {
    alert('Preencha todos os campos antes de salvar:\n\n' + faltando.map(function(n){ return '• ' + n; }).join('\n'));
    return;
  }

  // Montar registros com produto_id vinculado
  var registros = [];
  produtos.forEach(function(p) {
    var gon   = parseInt(estGondola[p.id]) || 0;
    var sis   = parseInt(estSistema[p.id]) || 0;
    var preco = precoProp[p.id] ? parseFloat(String(precoProp[p.id]).replace(',','.')) : null;
    registros.push({
      promotor:         cfg.promotor || ls('promotor-nome') || '',
      loja:             cfg.loja     || ls('promotor-loja') || '',
      produto_id:       p.id || null,
      produto_nome:     p.nome,
      sku:              p.sku,
      qtd_sistema:      sis,
      qtd_gondola:      gon,
      preco_encontrado: preco,
      preco_sugerido:   p.preco_sugerido || 0
    });
  });

  // Enviar ao banco
  var token = ls('auth-token') || SUPABASE_KEY;
  fetch(SUPABASE_URL + '/rest/v1/estoque', {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify(registros)
  })
  .then(function(r) {
    if (r.ok) {
      // Registrar data do ultimo lancamento REAL no banco
      var hoje = new Date().toISOString().slice(0,10);
      lssLoja('est-ultimo-lancamento', hoje);
      // Gravar historico local
      var histKey = 'est-historico-' + (ls('promotor-loja')||'');
      var historico = JSON.parse(localStorage.getItem(histKey) || '{}');
      produtos.forEach(function(p) {
        historico[p.id] = {
          data:  hoje,
          sis:   estSistema[p.id] !== undefined ? estSistema[p.id] : null,
          gon:   estGondola[p.id] !== undefined ? estGondola[p.id] : null,
          preco: precoProp[p.id]  || null
        };
      });
      localStorage.setItem(histKey, JSON.stringify(historico));
      marcarEstoqueSalvo(); alert('✓ Estoque salvo no banco!');
      atualizarHome();
      renderEstoque();
    } else {
      r.text().then(function(t) {
        alert('Erro ao salvar: ' + t.slice(0, 200));
      });
    }
  })
  .catch(function(e) {
    alert('Erro de conexão: ' + String(e));
  });
}

// ─── SALVAR EXPOSIÇÃO ─────────────────────────────────────────────────────────


// ─── SALVAR CONCORRENTES ──────────────────────────────────────────────────────


// ─── SALVAR DESEMPENHO ────────────────────────────────────────────────────────


// ─── CONFIG ───────────────────────────────────────────────────────────────────


// ─── DATA DE LANÇAMENTO ───────────────────────────────────────────────────────



// ─── EDITAR PRODUTO ───────────────────────────────────────────────────────────
var editandoId = null;



// ─── CADASTRO DE PRODUTOS ─────────────────────────────────────────────────────












// ─── CADASTRO DE CONCORRENTES ─────────────────────────────────────────────────


















// ─── INIT ─────────────────────────────────────────────────────────────────────
// ─── TOGGLE TEMA ─────────────────────────────────────────────────────────────


function initApp() {
  // Restaurar tema
  if (ls('tema') === 'light') {
    document.body.classList.add('light');
    var icon = document.getElementById('theme-icon');
    var lbl  = document.getElementById('theme-lbl');
    if (icon) icon.textContent = '☀️';
    if (lbl)  lbl.textContent  = 'LIGHT';
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = '#FFFFFF';
  }
  // Config
  var cfgMap = { 'promotor-nome':'cfg-nome', 'fat-meta':'cfg-meta', 'fat-real':'cfg-realizado' };
  Object.keys(cfgMap).forEach(function(k){
    var v=ls(k); var el=document.getElementById(cfgMap[k]);
    if(v&&el) el.value=v;
  });
  renderLojas();
  syncLoja();
  // Estoque SEMPRE em branco — nunca carrega do localStorage
  estSistema={}; estGondola={}; precoProp={};
  precoConc  = lsLojaObj('estoque') ? (lsLojaObj('estoque').conc||{}) : {};
  avarias       = lsLojaObj('avarias') || [];
  oportunidades = lsLojaObj('oportunidades') || [];
  expoChecks    = parseInt(lsLoja('expo-checks')||'0');
  // Meta
  var fr = lsLoja('fat-real')||''; var fm = lsLoja('fat-meta')||'';
  var elR=document.getElementById('fat-real-input'); if(elR) elR.value=fr;
  var elM=document.getElementById('fat-meta-input'); if(elM) elM.value=fm;
  var elCR=document.getElementById('cfg-realizado'); if(elCR) elCR.value=fr;
  var elCM=document.getElementById('cfg-meta');      if(elCM) elCM.value=fm;
  calcMeta();
  // Buscar produtos do banco ao iniciar
  buscarProdutosDoBanco(function() {
    renderEstoque();
    renderConcorrentes();
    renderSelectAvaria();
    atualizarHome();
  });
  // Data de hoje no campo
  var hoje = new Date().toISOString().slice(0,10);
  var elData = document.getElementById('home-data-lancamento');
  if (elData) elData.value = hoje;
  // Produtos e renderização
  produtos = getProdutos();
  renderCadastroProdutos();
  renderCadastroConcorrentes();
  renderEstoque();
  renderConcorrentes();
  renderFotosExposicao();
  renderSelectAvaria();
  renderDesempProdutos();
  renderDesempHistorico();
  var fr2=parseFloat(ls('fat-real'))||0; var fm2=parseFloat(ls('fat-meta'))||0;
  if(fr2||fm2) calcProjecao(fr2, fm2);
  atualizarHome();
}



// ─── SALVAR EXPOSIÇÃO ─────────────────────────────────────────────────────────
function salvarExposicao() {
  var cfg = sbConfig();
  var cbs = document.querySelectorAll('#sc-exposicao .cb');
  var payload = {
    promotor: cfg.promotor, loja: cfg.loja,
    ponto_natural:          cbs[0] ? cbs[0].classList.contains('on') : false,
    preco_fisico_ok:        cbs[1] ? cbs[1].classList.contains('on') : false,
    precificacao_visivel:   cbs[2] ? cbs[2].classList.contains('on') : false,
    area_extra_promocao:    cbs[3] ? cbs[3].classList.contains('on') : false,
    material_merchandising: cbs[4] ? cbs[4].classList.contains('on') : false,
    cross_merchandising:    cbs[5] ? cbs[5].classList.contains('on') : false,
    produtos_sem_avaria:    cbs[6] ? cbs[6].classList.contains('on') : false,
    planograma_ok:          cbs[7] ? cbs[7].classList.contains('on') : false,
    observacoes: document.getElementById('obs-exp') ? document.getElementById('obs-exp').value : ''
  };
  if (cfg.url && cfg.key) {
    sbPost('exposicao', payload)
      .then(function(r){ alert(r.ok ? '✓ Exposição salva no banco! ' + expoChecks + '/' + expoTotal + ' itens.' : '✓ Salvo localmente.'); })
      .catch(function(){ alert('✓ Salvo localmente.'); });
  } else {
    alert('✓ Exposição salva! ' + expoChecks + '/' + expoTotal + ' itens.\n\nConfigure Supabase em ⚙️ Config.');
  }
  atualizarHome();
}

// ─── SALVAR CONCORRENTES ──────────────────────────────────────────────────────
function salvarConcorrentes() {
  var cfg = sbConfig();
  var registros = [];
  produtos.forEach(function(p) {
    var conc = precoConc[p.id];
    if (!conc) return;
    var meu = precoProp[p.id] ? parseFloat(precoProp[p.id].replace(',','.')) : null;
    registros.push({
      promotor: cfg.promotor, loja: cfg.loja,
      produto_id: p.id, produto_nome: p.nome,
      meu_preco: meu,
      preco_concorrente: parseFloat(conc.replace(',','.')),
      empresa_concorrente: p.concorrente ? p.concorrente.empresa : '',
      produto_similar: p.concorrente ? p.concorrente.nome : ''
    });
  });
    // BLOQUEAR se qualquer produto não tiver sistema E gôndola preenchidos
  var faltando = [];
  produtos.forEach(function(p) {
    var semSis = estSistema[p.id] === undefined || estSistema[p.id] === null || String(estSistema[p.id]).trim() === '';
    var semGon = estGondola[p.id] === undefined || estGondola[p.id] === null || String(estGondola[p.id]).trim() === '';
    if (semSis || semGon) faltando.push(p.nome + (semSis ? ' (sistema)' : '') + (semGon ? ' (gôndola)' : ''));
  });
  if (faltando.length > 0) {
    alert('Preencha todos os campos antes de salvar:\n\n' + faltando.map(function(n){ return '• ' + n; }).join('\n'));
    return;
  }
  if (!registros.length) {
    alert('Nenhum dado para salvar.');
    return;
  }
  if (cfg.url && cfg.key) {
    sbPost('precos_concorrentes', registros)
      .then(function(r){ alert(r.ok ? '✓ Concorrentes salvos no banco!' : '✓ Salvo localmente.'); })
      .catch(function(){ alert('✓ Salvo localmente.'); });
  } else {
    alert('✓ Preços registrados!\n\nConfigure o Supabase em ⚙️ Config.');
  }
  atualizarHomeConc();
}

// ─── SALVAR DESEMPENHO ────────────────────────────────────────────────────────
function salvarDesempenho() {
  var cfg = sbConfig();
  var real = parseFloat(document.getElementById('fat-real-input').value) || 0;
  var meta = parseFloat(document.getElementById('fat-meta-input').value) || 0;
  if (!meta) { alert('Informe a meta do mês antes de salvar.'); return; }
  lss('fat-real', real); lssLoja('fat-real', real);
  lss('fat-meta', meta); lssLoja('fat-meta', meta);

  // Gravar no histórico local
  var historico = lsLojaObj('desemp-historico') || [];
  var hoje = new Date();
  var dataStr = hoje.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'});
  // Atualizar entrada do dia ou adicionar nova
  var idx = historico.findIndex(function(h){ return h.data === dataStr; });
  if (idx >= 0) { historico[idx] = {data: dataStr, real: real, meta: meta}; }
  else { historico.push({data: dataStr, real: real, meta: meta}); }
  lssLojaObj('desemp-historico', historico);

  if (cfg.url && cfg.key) {
    sbPost('desempenho', {
      promotor: cfg.promotor, loja: cfg.loja,
      mes_referencia: hoje.toISOString().slice(0,7),
      meta_mensal: meta, realizado: real
    })
    .then(function(r){ alert(r.ok ? '✓ Desempenho salvo no banco!' : '✓ Salvo localmente.'); })
    .catch(function(){ alert('✓ Salvo localmente.'); });
  } else {
    alert('✓ Desempenho salvo!');
  }
  calcMeta();
  renderDesempHistorico();
  calcProjecao(real, meta);
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────


// ─── DATA DE LANÇAMENTO ───────────────────────────────────────────────────────

function processarDadosHistorico(dados, val) {
  estSistema = {}; estGondola = {}; precoProp = {};
  dados.forEach(function(row) {
    var p = produtos.find(function(x){ return x.sku === row.sku; });
    if (!p) return;
    if (row.qtd_sistema    !== null && row.qtd_sistema    !== undefined) estSistema[p.id] = row.qtd_sistema;
    if (row.qtd_gondola    !== null && row.qtd_gondola    !== undefined) estGondola[p.id] = row.qtd_gondola;
    if (row.preco_encontrado !== null && row.preco_encontrado !== undefined) {
      precoProp[p.id] = String(row.preco_encontrado).replace('.',',');
    }
  });
  renderEstoque();
  // Preencher inputs após render
  setTimeout(function() {
    produtos.forEach(function(p) {
      var sisEl = document.getElementById('sis-' + p.id);
      var gonEl = document.getElementById('gon-' + p.id);
      var ppEl  = document.getElementById('pp-'  + p.id);
      if (sisEl && estSistema[p.id] !== undefined) sisEl.value = estSistema[p.id];
      if (gonEl && estGondola[p.id] !== undefined) gonEl.value = estGondola[p.id];
      if (ppEl  && precoProp[p.id])                ppEl.value  = precoProp[p.id];
    });
  }, 100);
  alert('✓ ' + dados.length + ' produto(s) carregado(s) do dia ' + val);
}

function salvarDataLancamento(val) {
  var hoje = new Date().toISOString().slice(0,10);
  var el   = document.getElementById('home-data-lancamento');

  // Bloquear data futura ANTES de fazer qualquer coisa
  if (val > hoje) {
    alert('Não é permitido lançar para datas futuras.\nSelecione até ' + hoje + '.');
    if (el) { el.value = hoje; el.max = hoje; }
    // Não limpar campos — manter o que estava
    return;
  }

  lssLoja('data-lancamento', val);

  // Limpar campos em memória
  estSistema = {}; estGondola = {}; precoProp = {};

  // Buscar no banco o que foi lançado nessa data
  var loja  = ls('promotor-loja') || '';
  var token = ls('auth-token') || SUPABASE_KEY;

  fetch(SUPABASE_URL + '/rest/v1/estoque?select=sku,qtd_sistema,qtd_gondola,preco_encontrado&loja=eq.' + encodeURIComponent(loja) + '&data_registro=gte.' + val + 'T00:00:00.000Z&data_registro=lte.' + val + 'T23:59:59.999Z&order=data_registro.desc', {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token }
  })
  .then(function(r) { return r.json(); })
  .then(function(dados) {
    if (dados && Array.isArray(dados) && dados.length > 0) {
      dados.forEach(function(row) {
        var p = produtos.find(function(x){ return x.sku === row.sku; });
        if (!p) return;
        if (row.qtd_sistema     != null) estSistema[p.id] = row.qtd_sistema;
        if (row.qtd_gondola     != null) estGondola[p.id] = row.qtd_gondola;
        if (row.preco_encontrado != null) precoProp[p.id]  = String(row.preco_encontrado).replace('.',',');
      });
    }
    renderEstoque();
    setTimeout(function() {
      produtos.forEach(function(p) {
        var s  = document.getElementById('sis-'+p.id);
        var g  = document.getElementById('gon-'+p.id);
        var pp = document.getElementById('pp-'+p.id);
        if (s)  s.value  = estSistema[p.id] !== undefined ? estSistema[p.id] : '';
        if (g)  g.value  = estGondola[p.id] !== undefined ? estGondola[p.id] : '';
        if (pp) pp.value = precoProp[p.id]   || '';
      });
    }, 150);
    navTo('estoque');
  })
  .catch(function(e) {
    renderEstoque();
    navTo('estoque');
  });
}
function carregarDataLancamento() {
  var el = document.getElementById('home-data-lancamento');
  if (!el) return;
  var hoje = new Date().toISOString().slice(0,10);
  el.value = hoje;
  el.max   = hoje; // Bloquear datas futuras no calendário
  lssLoja('data-lancamento', hoje);
}

// ─── EDITAR PRODUTO ───────────────────────────────────────────────────────────
var editandoId = null;
function editarProduto(id) {
  var p = carregarProdutos().find(function(x){ return x.id===id; });
  if (!p) return;
  editandoId = id;
  document.getElementById('np-nome').value   = p.nome;
  document.getElementById('np-sku').value    = p.sku;
  document.getElementById('np-minimo').value = p.minimo;
  document.getElementById('np-preco').value  = p.preco_sugerido ? p.preco_sugerido.toFixed(2).replace('.',',') : '';
  var elF = document.getElementById('np-fornecedor');
  if (elF) elF.value = p.fornecedor || '';
  var btn = document.querySelector('button[onclick="addProduto()"]');
  if (btn) { btn.textContent = '✓ Salvar alteração'; btn.style.background = 'var(--blue)'; }
  document.getElementById('np-nome').scrollIntoView({behavior:'smooth'});
  setTimeout(function() {
    // Marcar lojas vinculadas ao produto na edição
  if (p.lojas && p.lojas.length) {
    setTimeout(function() {
      document.querySelectorAll('#np-lojas-check div[data-loja]').forEach(function(d) {
        if (p.lojas.indexOf(d.dataset.loja) !== -1) toggleLojaOpt(d);
      });
    }, 200);
  }
  }, 400);
}
function cancelarEdicaoP() {
  editandoId = null;
  ['np-nome','np-sku','np-minimo','np-preco'].forEach(function(id){ document.getElementById(id).value=''; });
  var elF = document.getElementById('np-fornecedor'); if (elF) elF.value='';
  var btn = document.querySelector('button[onclick="addProduto()"]');
  if (btn) { btn.textContent = '+ Adicionar produto'; btn.style.background = 'var(--brand)'; }
}

// ─── CADASTRO DE PRODUTOS ─────────────────────────────────────────────────────
function addProduto() {
  var nome  = document.getElementById('np-nome').value.trim();
  var sku   = document.getElementById('np-sku').value.trim();
  var min   = parseInt(document.getElementById('np-minimo').value);
  var preco = parseFloat(document.getElementById('np-preco').value.replace(',','.'));
  if (!nome) { alert('Informe o nome do produto.'); return; }
  if (!sku)  { alert('Informe o SKU/código.'); return; }
  if (isNaN(min)||min<1) { alert('Informe o estoque mínimo.'); return; }
  // Coletar lojas selecionadas (novas divs clicáveis)
  var lojasDivs = document.querySelectorAll('#np-lojas-check div[data-sel="1"]');
  var lojasSel = [];
  lojasDivs.forEach(function(d){ if(d.dataset.loja) lojasSel.push(d.dataset.loja); });
  // Lojas são opcionais — produto aparece em todas as lojas se nenhuma selecionada
  var lista = carregarProdutos();
  var fornecedor = document.getElementById('np-fornecedor') ? document.getElementById('np-fornecedor').value.trim() : '';
  // Modo edição — atualiza produto no banco SEM verificar duplicata
  if (editandoId) {
    var elF2 = document.getElementById('np-fornecedor');
    var forn2 = elF2 ? elF2.value.trim() : '';
    // Coletar lojas selecionadas na edição
    var lojasDivs2 = document.querySelectorAll('#np-lojas-check div[data-sel="1"]');
    var lojasSel2 = [];
    lojasDivs2.forEach(function(d){ if(d.dataset.loja) lojasSel2.push(d.dataset.loja); });
    fetch(SUPABASE_URL + '/rest/v1/produtos?id=eq.' + editandoId, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome,
        sku: sku,
        minimo: min,
        preco_sugerido: isNaN(preco) ? 0 : preco,
        fornecedor: forn2,
        lojas: lojasSel2
      })
    })
    .then(function(r) {
      if (r.ok) {
        alert('✓ Produto alterado!');
        cancelarEdicaoP();
        buscarProdutosDoBanco(function() {
          renderCadastroProdutos();
          renderEstoque();
          renderSelectAvaria();
        });
      } else {
        r.text().then(function(t){ alert('Erro ao alterar: ' + t.slice(0,100)); });
      }
    })
    .catch(function() { alert('Erro de conexão.'); });
    return;
  }
  var promotorId = ls('promotor-id') || '';
  var novoProduto = {
    id: gerarUUID(),
    nome: nome, sku: sku, minimo: min,
    preco_sugerido: isNaN(preco)?0:preco,
    fornecedor: fornecedor,
    lojas: lojasSel,
    promotor_id: promotorId
  };

  // Salvar direto no banco — sem verificar duplicata em cache
  fetch(SUPABASE_URL + '/rest/v1/produtos', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      id: novoProduto.id,
      nome: novoProduto.nome,
      sku: novoProduto.sku,
      minimo: novoProduto.minimo,
      preco_sugerido: novoProduto.preco_sugerido,
      fornecedor: novoProduto.fornecedor,
      lojas: novoProduto.lojas,
      promotor_id: promotorId
    })
  })
  .then(function(r) {
    if (r.ok) {
      ['np-nome','np-sku','np-minimo','np-preco'].forEach(function(id){
        var e = document.getElementById(id); if(e) e.value='';
      });
      var elForn = document.getElementById('np-fornecedor'); if(elForn) elForn.value='';
      document.querySelectorAll('#np-lojas-check div[data-sel="1"]').forEach(function(d){ toggleLojaOpt(d); });
      alert('✓ Produto "' + novoProduto.nome + '" cadastrado!');
      buscarProdutosDoBanco(function() {
        renderCadastroProdutos();
        renderEstoque();
        renderSelectAvaria();
      });
    } else {
      r.text().then(function(t){
        // Erro 23505 = chave duplicada no banco
        if (t.indexOf('23505') !== -1) {
          alert('SKU ' + sku + ' ja esta cadastrado. Use o botao Editar para alterar.');
        } else {
          alert('Erro ao salvar: ' + t.slice(0,120));
        }
      });
    }
  })
  .catch(function(e) {
    alert('Erro de conexao ao salvar produto: ' + e);
  });
}

function removeProduto(id) {
  if (!confirm('Remover este produto?')) return;
  fetch(SUPABASE_URL + '/rest/v1/produtos?id=eq.' + id, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  })
  .then(function(r) {
    if (r.ok) {
      buscarProdutosDoBanco(function() {
        renderCadastroProdutos();
        renderEstoque();
        renderSelectAvaria();
      });
    } else {
      alert('Erro ao remover produto.');
    }
  })
  .catch(function() { alert('Erro de conexao.'); });
}

function renderCadastroProdutos() {
  var lista = _produtosCache; // Config mostra todos os produtos, não filtra por loja
  var el = document.getElementById('lista-produtos-cfg');
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Nenhum produto cadastrado.</div>';
    renderNpLojasCheck();
    return;
  }
  el.innerHTML = lista.map(function(p) {
    var lojas = p.lojas && p.lojas.length ? p.lojas.join(', ') : '<span style="color:var(--text3)">Todas as lojas</span>';
    return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div style="flex:1">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text)">' + p.nome + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + p.sku + (p.fornecedor?' · '+p.fornecedor:'') + ' · Mín: ' + p.minimo + ' · R$ ' + p.preco_sugerido.toFixed(2).replace('.',',') + '</div>' +
          '<div style="font-size:11px;margin-top:3px">🏪 ' + lojas + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0">' +'<button data-id="' + p.id + '" onclick="editarProduto(this.dataset.id)" style="background:var(--brand-light);color:var(--brand);border:1px solid var(--brand);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer">Editar</button>' +'<button data-id="' + p.id + '" onclick="removeProduto(this.dataset.id)" style="background:var(--red-bg);color:var(--red);border:none;border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer">Remover</button>' +'</div>' +
      '</div>' +
    '</div>';
  }).join('');
  // Atualizar select do concorrente — mostra TODOS os produtos (sem filtro de loja)
  var sel = document.getElementById('nc-meu-produto');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione o produto</option>' +
      _produtosCache.map(function(p){ return '<option value="'+p.id+'">'+p.nome+'</option>'; }).join('');
  }
  renderNpLojasCheck();
}

function renderNpLojasCheck() {
  var lojas = carregarLojas();
  var el = document.getElementById('np-lojas-check');
  if (!el) return;
  if (!lojas.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);font-style:italic">Cadastre lojas em "Minhas lojas" para selecionar</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Toque para selecionar uma ou mais lojas:</div>' +
    lojas.map(function(l, idx) {
      return '<div id="loja-opt-' + idx + '" data-loja="' + l.nome + '" data-sel="0" ' +
        'onclick="toggleLojaOpt(this)" ' +
        'style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px 14px;' +
        'background:var(--bg);border-radius:var(--radius-sm);border:2px solid var(--border);' +
        'margin-bottom:8px;transition:border-color 0.15s,background 0.15s;-webkit-tap-highlight-color:transparent">' +
        '<div id="loja-box-' + idx + '" style="width:24px;height:24px;border-radius:6px;border:2px solid var(--border);' +
        'background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:700;color:#000"></div>' +
        '<div>' +
          '<div style="font-size:14px;font-weight:600;color:var(--text)">' + l.nome + '</div>' +
          '<div style="font-size:11px;color:var(--text3)">' + (l.rede||'Outra') + (l.cidade?' · '+l.cidade:'') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
}

function toggleLojaOpt(el) {
  var sel = el.getAttribute('data-sel') === '1';
  var idx = el.id.replace('loja-opt-','');
  var box = document.getElementById('loja-box-' + idx);
  if (!sel) {
    el.setAttribute('data-sel','1');
    el.style.borderColor = 'var(--brand)';
    el.style.background  = 'var(--brand-light)';
    if (box) { box.style.background='var(--brand)'; box.style.borderColor='var(--brand)'; box.textContent='✓'; }
  } else {
    el.setAttribute('data-sel','0');
    el.style.borderColor = 'var(--border)';
    el.style.background  = 'var(--bg)';
    if (box) { box.style.background='var(--surface2)'; box.style.borderColor='var(--border)'; box.textContent=''; }
  }
}

function toggleLojaCheck(label) { toggleLojaOpt(label); }

// ─── CADASTRO DE CONCORRENTES ─────────────────────────────────────────────────
function addConcorrente() {
  var pid     = document.getElementById('nc-meu-produto').value;
  var empresa = document.getElementById('nc-empresa').value.trim();
  var similar = (document.getElementById('nc-similar') || {}).value || '';
  similar = similar.trim();
  if (!pid)     { alert('Selecione o produto proprio.'); return; }
  if (!empresa) { alert('Informe a empresa concorrente.'); return; }
  if (!similar) { alert('Informe o produto similar.'); return; }

  var promotorId = ls('promotor-id') || '';
  fetch(SUPABASE_URL + '/rest/v1/concorrentes', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      id: gerarUUID(),
      produto_id: pid,
      empresa: empresa,
      produto_similar: similar,
      promotor_id: promotorId
    })
  })
  .then(function(r) {
    if (r.ok) {
      document.getElementById('nc-meu-produto').value = '';
      document.getElementById('nc-empresa').value = '';
      document.getElementById('nc-similar').value = '';
      alert('✓ Similar cadastrado!');
      buscarProdutosDoBanco(function() {
        renderCadastroConcorrentes();
        renderConcorrentes();
      });
    } else {
      r.text().then(function(t){ alert('Erro ao salvar similar: ' + t.slice(0,100)); });
    }
  })
  .catch(function() {
    alert('Erro de conexao ao salvar similar.');
  });
}

function removeConcorrente(id) {
  if (!confirm('Remover este similar?')) return;
  fetch(SUPABASE_URL + '/rest/v1/concorrentes?id=eq.' + id, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  })
  .then(function(r) {
    if (r.ok) {
      buscarProdutosDoBanco(function() {
        renderCadastroConcorrentes();
        renderConcorrentes();
      });
    } else {
      alert('Erro ao remover similar.');
    }
  })
  .catch(function() { alert('Erro de conexao.'); });
}

function renderCadastroConcorrentes() {
  var lista = carregarConcorrentes();
  var prods = carregarProdutos();
  var el = document.getElementById('lista-conc-cfg');
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Nenhum similar cadastrado.</div>';
    return;
  }
  el.innerHTML = lista.map(function(c) {
    var p = prods.find(function(x){ return x.id===c.produto_id; });
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)">' +
      '<div>' +
        '<div style="font-size:12px;font-weight:500;color:var(--brand)">'+(p?p.nome:'—')+'</div>' +
        '<div style="font-size:12px;color:var(--text);margin-top:2px">↔ '+(c.produto_similar||c.similar||'—')+'</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:1px">'+c.empresa+'</div>' +
      '</div>' +
      '<button data-id="'+c.id+'" onclick="removeConcorrente(this.dataset.id)" style="background:var(--red-bg);color:var(--red);border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">Remover</button>' +
    '</div>';
  }).join('');
}

function sincronizarProdutos() {
  var sbUrl = SUPABASE_URL;
  var sbKey = SUPABASE_KEY;
  var token = ls('auth-token') || sbKey;
  var lista = carregarProdutos();
  if (!lista.length) { alert('Nenhum produto cadastrado.'); return; }

  var payload = lista.map(function(p) {
    return { id: p.id, nome: p.nome, sku: p.sku, minimo: p.minimo, preco_sugerido: p.preco_sugerido };
  });

  var promotorId = ls('promotor-id') || '';
  var payload = lista.map(function(p) {
    return { id: p.id, nome: p.nome, sku: p.sku, minimo: p.minimo, preco_sugerido: p.preco_sugerido, fornecedor: p.fornecedor || '', promotor_id: promotorId };
  });
  fetch(sbUrl + '/rest/v1/produtos', {
    method: 'POST',
    headers: { 'apikey': sbKey, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  }).then(function(r) {
    if (r.ok) {
      var concs = carregarConcorrentes();
      if (concs.length) {
        var concPayload = concs.map(function(c) {
          return { id: c.id, produto_id: c.produto_id, empresa: c.empresa, produto_similar: c.produto_similar || c.similar || '', promotor_id: promotorId };
        });
        return fetch(sbUrl + '/rest/v1/concorrentes', {
          method: 'POST',
          headers: { 'apikey': sbKey, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(concPayload)
        }).then(function(r2) {
          alert(r2.ok ? '✓ ' + lista.length + ' produto(s) e ' + concs.length + ' similar(es) sincronizados!' : '✓ Produtos salvos. Erro nos similares.');
        });
      }
      alert('✓ ' + lista.length + ' produto(s) sincronizado(s)!');
    } else {
      r.text().then(function(t){ alert('Erro: ' + t.slice(0,150)); });
    }
  }).catch(function(e){ alert('Erro de conexão: ' + e); });
}

function recarregarProdutos() {
  buscarProdutosDoBanco(function() {
    renderEstoque();
    renderConcorrentes();
    renderSelectAvaria();
    renderDesempProdutos();
    renderDesempHistorico();
    var fr2=parseFloat(ls('fat-real'))||0; var fm2=parseFloat(ls('fat-meta'))||0;
    if(fr2||fm2) calcProjecao(fr2, fm2);
    atualizarHome();
  });
}


function previewMeta() {
  var meta = parseFloat(document.getElementById('cfg-meta').value) || 0;
  var real = parseFloat(document.getElementById('cfg-realizado').value) || 0;
  var preview = document.getElementById('cfg-meta-preview');
  if (!preview) return;
  if (!meta) { preview.style.display = 'none'; return; }
  preview.style.display = 'block';

  var falta = Math.max(0, meta - real);
  var pct   = Math.min(100, Math.round((real / meta) * 100));

  // Dias úteis restantes
  var hoje = new Date();
  var ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  var diasRestantes = 0;
  for (var d = hoje.getDate(); d <= ultimoDia; d++) {
    var diaSemana = new Date(hoje.getFullYear(), hoje.getMonth(), d).getDay();
    if (diaSemana !== 0 && diaSemana !== 6) diasRestantes++;
  }
  diasRestantes = Math.max(1, diasRestantes);
  var diario = Math.ceil(falta / diasRestantes);

  var diaEl = document.getElementById('cfg-meta-dia');
  var pctEl = document.getElementById('cfg-meta-pct');
  var barEl = document.getElementById('cfg-meta-bar');
  if (diaEl) diaEl.textContent = 'R$ ' + diario.toLocaleString('pt-BR');
  if (pctEl) {
    pctEl.textContent = pct + '%';
    pctEl.style.color = pct >= 100 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : 'var(--red)';
  }
  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct >= 100 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : 'var(--brand)';
  }
}
function salvarPerfil(){
  lss('promotor-nome',document.getElementById('cfg-nome').value.trim());
  // loja agora é gerenciada pelo sistema de múltiplas lojas
  var meta = document.getElementById('cfg-meta').value.trim();
  var real = document.getElementById('cfg-realizado').value.trim();
  if (meta) {
    lss('fat-meta', meta); lssLoja('fat-meta', meta);
    // Sincronizar com campo da tela desempenho
    var elMeta = document.getElementById('fat-meta-input');
    if (elMeta) elMeta.value = meta;
  }
  if (real) {
    lss('fat-real', real); lssLoja('fat-real', real);
    var elReal = document.getElementById('fat-real-input');
    if (elReal) elReal.value = real;
  }
  syncLoja();
  calcMeta();
  alert('✓ Perfil e meta salvos!');
}

function salvarSupabase(){
  var url = document.getElementById('cfg-sb-url').value.trim();
  var key = document.getElementById('cfg-sb-key').value.trim();
  if (!url || !key) { alert('Preencha a URL e a chave.'); return; }
  // Garantir que a URL não tem barra no final
  url = url.replace(/\/+$/, '');
  lss('sb-url', url);
  lss('sb-key', key);
  alert('✓ Supabase salvo! Toque em "Testar conexão agora" para verificar.');
}

function testarConexaoSupabase() {
  var url = ls('sb-url');
  var key = ls('sb-key');
  var res = document.getElementById('sb-teste-resultado');
  res.style.display = 'block';
  res.style.background = 'var(--surface2)';
  res.style.color = 'var(--text2)';
  res.textContent = '⏳ Testando conexão...';

  if (!url || !key) {
    res.style.background = 'var(--red-bg)';
    res.style.color = 'var(--red)';
    res.textContent = '✕ URL ou chave não configurados. Preencha e salve primeiro.';
    return;
  }

  // Testar fazendo uma leitura simples na tabela produtos
  fetch(url + '/rest/v1/produtos?limit=1', {
    method: 'GET',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    }
  })
  .then(function(r) {
    if (r.ok) {
      res.style.background = 'var(--green-bg)';
      res.style.color = 'var(--green)';
      res.textContent = '✓ Conexão com Supabase funcionando! Os dados serão salvos no banco.';
    } else {
      r.text().then(function(t) {
        res.style.background = 'var(--red-bg)';
        res.style.color = 'var(--red)';
        if (r.status === 401) {
          res.textContent = '✕ Chave inválida (erro 401). Use a chave eyJ... da aba "Legacy anon" no Supabase.';
        } else if (r.status === 404) {
          res.textContent = '✕ URL incorreta (erro 404). Verifique a URL do projeto no Supabase → Settings → General.';
        } else {
          res.textContent = '✕ Erro ' + r.status + ': ' + t.slice(0, 150);
        }
      });
    }
  })
  .catch(function(e) {
    res.style.background = 'var(--red-bg)';
    res.style.color = 'var(--red)';
    res.textContent = '✕ Falha de rede: ' + e + '. Verifique sua internet.';
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// ─── TOGGLE TEMA ─────────────────────────────────────────────────────────────
function toggleTema() {
  var isLight = document.body.classList.toggle('light');
  lss('tema', isLight ? 'light' : 'dark');
  var icon = document.getElementById('theme-icon');
  var lbl  = document.getElementById('theme-lbl');
  if (icon) icon.textContent = isLight ? '☀️' : '🌙';
  if (lbl)  lbl.textContent  = isLight ? 'LIGHT' : 'DARK';
  // Atualizar meta theme-color
  var meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = isLight ? '#FFFFFF' : '#14213D';
}
