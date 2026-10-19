/**
 * Litrão do Reset - Extrator de Contatos WhatsApp Web (Content Script)
 * Versão 2.0 Silicon Valley - Suporte a Modal Central e Scroll Virtual Completo
 */

console.log("[Litrão Reset Extrator v2.0] Content script carregado no WhatsApp Web.");

// Normaliza telefones para o padrão internacional limpo (+55...)
function normalizarTelefone(raw) {
  if (!raw) return '';
  let num = raw.replace(/[^\d+]/g, '');
  if (num.startsWith('+')) {
    num = num.substring(1);
  }
  if (num.length === 10 || num.length === 11) {
    num = '55' + num;
  }
  return num;
}

// Obtém o cabeçalho específico da conversa ativa (#main header)
function obterHeaderConversaAtiva() {
  return document.querySelector('#main header') || 
         document.querySelector('header[data-testid="conversation-header"]') ||
         document.querySelector('#main [role="region"] header') ||
         document.querySelectorAll('header')[1] ||
         document.querySelector('header');
}

// Extrai informações do cabeçalho da conversa aberta
function obterInfoGrupoAtual() {
  const header = obterHeaderConversaAtiva();
  if (!header) return null;

  let nomeGrupo = '';
  const tituloEl = header.querySelector('div[role="button"] span[title]') || 
                   header.querySelector('span[dir="auto"]') || 
                   header.querySelector('div[dir="auto"]') ||
                   header.querySelector('h2');
  if (tituloEl) {
    nomeGrupo = tituloEl.getAttribute('title') || tituloEl.innerText || '';
  }

  let subtitulo = '';
  const subEl = header.querySelector('span[title*=","]') || 
                header.querySelector('span[class*="matched-text"]') ||
                header.querySelector('div[class*="copyable-text"]') ||
                header.querySelector('span[title]');
  if (subEl) {
    subtitulo = subEl.getAttribute('title') || subEl.innerText || '';
  }

  return {
    nomeGrupo: nomeGrupo.trim(),
    subtitulo: subtitulo.trim()
  };
}

// Lista todas as conversas/grupos da barra lateral esquerda (PRINT 4)
function listarTodasConversas() {
  const lista = [];
  const nomesVistos = new Set();

  const paneSide = document.querySelector('#pane-side') || 
                   document.querySelector('div[aria-label="Lista de conversas"]') ||
                   document.querySelector('div[role="grid"]');

  if (!paneSide) return [];

  const itens = paneSide.querySelectorAll('div[data-testid="cell-frame-container"], div[role="row"], div[role="listitem"]');

  itens.forEach(item => {
    try {
      const spanTitulo = item.querySelector('span[title]') || item.querySelector('span[dir="auto"]');
      if (spanTitulo) {
        const titulo = (spanTitulo.getAttribute('title') || spanTitulo.innerText || '').trim();
        if (titulo && !nomesVistos.has(titulo) && titulo.length > 1) {
          nomesVistos.add(titulo);
          lista.push({
            nome: titulo,
            isGrupo: !!item.querySelector('span[data-icon="default-group"]') || !titulo.match(/^\+?\d[\d\s-]{6,}$/)
          });
        }
      }
    } catch (_) {}
  });

  return lista;
}

// Clica em uma conversa pelo nome na barra lateral
async function abrirConversaPeloNome(nome) {
  const paneSide = document.querySelector('#pane-side') || 
                   document.querySelector('div[aria-label="Lista de conversas"]') ||
                   document.querySelector('div[role="grid"]');
  if (!paneSide) return false;

  const itens = paneSide.querySelectorAll('div[data-testid="cell-frame-container"], div[role="row"], div[role="listitem"]');
  for (const item of itens) {
    const spanTitulo = item.querySelector('span[title]') || item.querySelector('span[dir="auto"]');
    if (spanTitulo) {
      const titulo = (spanTitulo.getAttribute('title') || spanTitulo.innerText || '').trim();
      if (titulo.toLowerCase() === nome.toLowerCase()) {
        const btn = item.querySelector('div[role="button"]') || item;
        btn.click();
        await new Promise(r => setTimeout(r, 1000));
        return true;
      }
    }
  }
  return false;
}

// Extrai contatos com Scroll no Modal Central (Print 1) ou no Drawer Lateral
async function extrairTodosOsParticipantes(nomeGrupo, onProgress) {
  const agora = new Date().toISOString();
  const mapaContatos = new Map();
  const infoAtual = obterInfoGrupoAtual();

  if (!nomeGrupo || nomeGrupo === '__ATUAL__') {
    nomeGrupo = (infoAtual && infoAtual.nomeGrupo) ? infoAtual.nomeGrupo : 'Grupo WhatsApp';
  }

  // Captura imediata preventiva a partir do subtitulo do cabecalho (#main header)
  if (infoAtual && infoAtual.subtitulo) {
    const partes = infoAtual.subtitulo.split(',').map(s => s.trim());
    partes.forEach(p => {
      if (p.toLowerCase() === 'você' || p.toLowerCase() === 'you') return;
      const digitos = p.replace(/\D/g, '');
      if (digitos.length >= 8) {
        const telLimpo = normalizarTelefone(p);
        mapaContatos.set(telLimpo, {
          id: 'lead_' + telLimpo,
          nome: `Contato +${telLimpo}`,
          telefone: `+${telLimpo}`,
          grupo: nomeGrupo,
          grupoOrigem: nomeGrupo,
          extraidoEm: agora,
          isAdmin: false,
          status: 'novo'
        });
      }
    });
  }

  // 1. Procura se já existe um modal central aberto (div[role="dialog"]) - EXATAMENTE O DO PRINT 1
  let dialog = document.querySelector('div[role="dialog"]');

  // Se não houver modal central aberto, abre o painel lateral clicando no header
  if (!dialog) {
    const header = obterHeaderConversaAtiva();
    if (header) {
      const btnHeader = header.querySelector('div[role="button"]') || header;
      btnHeader.click();
      await new Promise(r => setTimeout(r, 1200));

      // Verifica se após abrir o drawer tem o botão "Ver todos os membros" ou a contagem
      const drawer = document.querySelector('div[data-testid="chat-info-drawer"]') || 
                     document.querySelector('section[class*="drawer"]');
      if (drawer) {
        // Tenta encontrar o botão que abre todos os membros no modal central
        const btnVerTodos = Array.from(drawer.querySelectorAll('div[role="button"], span')).find(el => {
          const txt = (el.innerText || '').toLowerCase();
          return txt.includes('ver todos') || txt.includes('outros participantes') || txt.includes('mais membros');
        });
        if (btnVerTodos) {
          btnVerTodos.click();
          await new Promise(r => setTimeout(r, 1000));
          dialog = document.querySelector('div[role="dialog"]');
        }
      }
    }
  }

  // Define o container onde a lista de membros está
  let containerPrincipal = dialog || 
                           document.querySelector('div[data-testid="chat-info-drawer"]') || 
                           document.querySelector('section') || 
                           document.body;

  // Localiza o elemento específico que tem a barra de rolagem (overflow-y)
  let scrollContainer = null;
  const possiveisScrolls = containerPrincipal.querySelectorAll('div');
  for (const div of possiveisScrolls) {
    const style = window.getComputedStyle(div);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight + 40) {
      scrollContainer = div;
      break;
    }
  }

  if (!scrollContainer && dialog) {
    scrollContainer = dialog.querySelector('div[tabindex="-1"]') || dialog;
  }

  // Loop de Scroll Virtual com alta sensibilidade
  let repeticoesSemNovos = 0;
  let ultimoTotal = 0;
  const maxTentativas = 60; // Permite rolar grupos grandes de até 500+ membros

  for (let step = 0; step < maxTentativas; step++) {
    // Busca todos os itens de contato renderizados no momento
    const itens = containerPrincipal.querySelectorAll('div[role="listitem"], div[class*="list-item"], div[data-testid="cell-frame-container"]');

    itens.forEach(item => {
      try {
        const textoCompleto = item.innerText || '';
        const linhas = textoCompleto.split('\n').map(l => l.trim()).filter(Boolean);
        if (linhas.length === 0) return;

        let telEncontrado = '';
        let nomeEncontrado = '';
        let isAdmin = textoCompleto.toLowerCase().includes('admin');

        // Varre as linhas procurando telefone e nome
        linhas.forEach(linha => {
          if (linha.toLowerCase() === 'você' || linha.toLowerCase() === 'admin do grupo') return;
          const digitos = linha.replace(/\D/g, '');
          if (digitos.length >= 8 && (linha.startsWith('+') || digitos.length >= 10)) {
            telEncontrado = normalizarTelefone(linha);
          } else if (!nomeEncontrado && !linha.toLowerCase().includes('estou usando') && !linha.toLowerCase().includes('olá!') && linha.length > 2) {
            nomeEncontrado = linha.replace(/^~/, '').trim();
          }
        });

        if (telEncontrado || nomeEncontrado) {
          const chave = telEncontrado || nomeEncontrado;
          if (!mapaContatos.has(chave)) {
            mapaContatos.set(chave, {
              id: 'lead_' + (telEncontrado || Math.random().toString(36).substr(2, 9)),
              nome: nomeEncontrado || (telEncontrado ? `Contato +${telEncontrado}` : 'Participante'),
              telefone: telEncontrado ? `+${telEncontrado}` : '',
              grupo: nomeGrupo || 'Grupo WhatsApp',
              grupoOrigem: nomeGrupo || 'Grupo WhatsApp',
              extraidoEm: agora,
              isAdmin: isAdmin,
              status: 'novo'
            });
          }
        }
      } catch (_) {}
    });

    if (onProgress) {
      onProgress(mapaContatos.size);
    }

    // Verifica se encontrou novos membros neste passo
    if (mapaContatos.size === ultimoTotal) {
      repeticoesSemNovos++;
      if (repeticoesSemNovos >= 4) {
        // Chegou ao fim do scroll
        break;
      }
    } else {
      repeticoesSemNovos = 0;
      ultimoTotal = mapaContatos.size;
    }

    // Executa a rolagem suave
    if (scrollContainer && scrollContainer.scrollTop !== undefined) {
      scrollContainer.scrollTop += 380;
    } else {
      window.scrollBy(0, 300);
    }

    await new Promise(r => setTimeout(r, 320));
  }

  // Rola de volta para o topo do container
  if (scrollContainer && scrollContainer.scrollTop !== undefined) {
    scrollContainer.scrollTop = 0;
  }

  const listaFinal = Array.from(mapaContatos.values());

  // Se por alguma razão o modal não pegou nenhum, tenta o subtítulo do cabeçalho como fallback
  if (listaFinal.length === 0) {
    const info = obterInfoGrupoAtual();
    if (info && info.subtitulo) {
      const partes = info.subtitulo.split(',').map(s => s.trim());
      partes.forEach(p => {
        if (p.toLowerCase() === 'você' || p.toLowerCase() === 'you') return;
        const digitos = p.replace(/\D/g, '');
        if (digitos.length >= 8) {
          const telLimpo = normalizarTelefone(p);
          listaFinal.push({
            id: 'lead_' + telLimpo,
            nome: `Contato +${telLimpo}`,
            telefone: `+${telLimpo}`,
            grupo: nomeGrupo || 'Grupo WhatsApp',
            grupoOrigem: nomeGrupo || 'Grupo WhatsApp',
            extraidoEm: agora,
            isAdmin: false,
            status: 'novo'
          });
        }
      });
    }
  }

  return listaFinal;
}

// Ouvinte de Mensagens do Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'abrir_drawer_lateral') {
    alternarSidebarLateral(true);
    sendResponse({ sucesso: true });
    return true;
  }

  if (request.action === 'verificar_status') {
    const info = obterInfoGrupoAtual();
    sendResponse({ sucesso: true, info });
    return true;
  }

  if (request.action === 'listar_conversas') {
    const conversas = listarTodasConversas();
    const infoAtual = obterInfoGrupoAtual();
    sendResponse({ sucesso: true, conversas, infoAtual });
    return true;
  }

  if (request.action === 'abrir_conversa') {
    abrirConversaPeloNome(request.nome).then(sucesso => {
      sendResponse({ sucesso });
    });
    return true;
  }

  if (request.action === 'extrair_contatos') {
    let nomeGrupo = request.nomeGrupo;
    if (!nomeGrupo || nomeGrupo === '__ATUAL__') {
      const info = obterInfoGrupoAtual();
      nomeGrupo = (info && info.nomeGrupo) ? info.nomeGrupo : 'Grupo do WhatsApp';
    }

    extrairTodosOsParticipantes(nomeGrupo, (qtd) => {
      try {
        chrome.runtime.sendMessage({ action: 'progresso_extracao', contagem: qtd });
      } catch (_) {}
    }).then(contatos => {
      sendResponse({
        sucesso: true,
        nomeGrupo: nomeGrupo,
        total: contatos.length,
        contatos: contatos,
        leads: contatos,
        membros: contatos
      });
    }).catch(err => {
      sendResponse({ sucesso: false, erro: err.message });
    });
    return true;
  }

  if (request.action === 'enviar_texto_chat') {
    enviarMensagemNoChat(request.texto || '').then(() => {
      sendResponse({ sucesso: true });
    }).catch(err => {
      sendResponse({ sucesso: false, erro: err.message });
    });
    return true;
  }

  if (request.action === 'executar_sequencia_1clique') {
    executarSequencia1Clique(request.sequencia).then((resultado) => {
      sendResponse({ sucesso: true, resultado });
    }).catch(err => {
      sendResponse({ sucesso: false, erro: err.message });
    });
    return true;
  }
});

// ==========================================
// NOTIFICAÇÕES VISUAIS SILICON VALLEY (TOAST)
// ==========================================
function mostrarToastWhatsApp(msg, tipo = 'info', duracao = 4000) {
  let toastContainer = document.getElementById('litrao-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'litrao-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 99999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const borderCor = tipo === 'success' ? '#10B981' : (tipo === 'error' ? '#EF4444' : '#0284C7');
  const icone = tipo === 'success' ? '✅' : (tipo === 'error' ? '⚠️' : '⚡');
  
  toast.style.cssText = `
    background: #0F172A;
    color: #F8FAFC;
    border-left: 4px solid ${borderCor};
    border-radius: 8px;
    padding: 12px 18px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.6);
    font-size: 13px;
    line-height: 1.4;
    max-width: 380px;
    pointer-events: auto;
    transition: all 0.3s ease;
    border: 1px solid #334155;
  `;
  toast.innerHTML = `<div style="display:flex;align-items:flex-start;gap:8px;"><span>${icone}</span><div>${msg}</div></div>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 400);
  }, duracao);
}

// Localiza o campo de digitação do WhatsApp Web de forma resiliente
function encontrarInputBoxWhatsApp() {
  return document.querySelector('#main footer div[contenteditable="true"]') ||
         document.querySelector('div[contenteditable="true"][role="textbox"]') || 
         document.querySelector('div[data-testid="conversation-compose-box-input"]') ||
         document.querySelector('footer div[contenteditable="true"]') ||
         document.querySelector('div[title="Digite uma mensagem"]') ||
         document.querySelector('div[contenteditable="true"]');
}

// Envia uma única mensagem no chat ativo
async function enviarMensagemNoChat(texto) {
  const inputBox = encontrarInputBoxWhatsApp();
  if (!inputBox) {
    throw new Error('Nenhuma conversa aberta encontrada. Abra o chat do contato no WhatsApp Web.');
  }

  inputBox.focus();
  await new Promise(r => setTimeout(r, 120));

  // Limpa e insere texto
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  document.execCommand('insertText', false, texto);

  // Dispara eventos para o React / Draft.js / Lexical do WhatsApp
  inputBox.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: texto, inputType: 'insertText' }));
  inputBox.dispatchEvent(new Event('input', { bubbles: true }));
  inputBox.dispatchEvent(new Event('change', { bubbles: true }));

  await new Promise(r => setTimeout(r, 250));

  // Tenta localizar o botão de envio
  const btnSend = document.querySelector('#main footer button[data-testid="compose-btn-send"]') || 
                  document.querySelector('button[data-testid="compose-btn-send"]') || 
                  document.querySelector('span[data-icon="send"]')?.closest('button') ||
                  document.querySelector('button[aria-label="Enviar"]') ||
                  document.querySelector('button[data-tab="11"]');

  if (btnSend) {
    btnSend.click();
  } else {
    // Fallback: Dispara evento da tecla Enter
    inputBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    inputBox.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  }

  await new Promise(r => setTimeout(r, 300));
  return true;
}

// ==========================================
// MOTOR DE DISPARO SEQUENCIAL COM 1 CLIQUE
// ==========================================
let sequenciaEmExecucao = false;

async function executarSequencia1Clique(sequencia) {
  if (sequenciaEmExecucao) {
    mostrarToastWhatsApp('Já existe uma sequência sendo enviada no momento. Aguarde o término!', 'error');
    throw new Error('Sequência já em andamento.');
  }

  if (!sequencia || !sequencia.passos || sequencia.passos.length === 0) {
    throw new Error('Sequência vazia ou inválida.');
  }

  sequenciaEmExecucao = true;

  try {
    // Detecta o nome do contato aberto
    const info = obterInfoGrupoAtual();
    let nomeContato = 'Amigo(a)';
    if (info && info.nomeGrupo) {
      const raw = info.nomeGrupo.trim();
      if (!raw.match(/^\+?\d/)) {
        nomeContato = raw.split(' ')[0] || raw;
      }
    }

    mostrarToastWhatsApp(`⚡ <b>1-Clique: ${sequencia.titulo}</b><br>Iniciando funil para <b>${nomeContato}</b> (${sequencia.passos.length} passos)...`, 'info', 3000);

    for (let i = 0; i < sequencia.passos.length; i++) {
      const passo = sequencia.passos[i];

      // Substitui variáveis dinâmicas
      let textoPronto = (passo.texto || '')
        .replace(/{nome}/gi, nomeContato)
        .replace(/{primeiro_nome}/gi, nomeContato)
        .replace(/{chave_pix}/gi, 'pix@litraodoreset.com.br');

      mostrarToastWhatsApp(`📤 <b>Passo ${i + 1}/${sequencia.passos.length}:</b><br>${textoPronto.substring(0, 50)}...`, 'info', 2500);

      await enviarMensagemNoChat(textoPronto);

      // Delay humanizado entre passos se não for o último
      if (i < sequencia.passos.length - 1 && passo.delay > 0) {
        mostrarToastWhatsApp(`⏳ Aguardando ${passo.delay}s (digitando naturalmente)...`, 'info', passo.delay * 1000);
        await new Promise(r => setTimeout(r, passo.delay * 1000));
      }
    }

    mostrarToastWhatsApp(`🎉 <b>Sequência enviada com sucesso!</b><br>Todos os passos entregues para <b>${nomeContato}</b>!`, 'success', 5000);
    return { sucesso: true, passos: sequencia.passos.length, contato: nomeContato };
  } finally {
    sequenciaEmExecucao = false;
  }
}

// ==========================================
// BARRA FLUTUANTE 1-CLIQUE NO WHATSAPP WEB
// ==========================================
const SEQUENCIAS_FLUTUANTES = [
  {
    id: 'seq_1',
    icone: '🥤',
    nome: 'Apresentação',
    titulo: '🥤 Apresentação Completa Litrão (3 Passos)',
    passos: [
      { texto: 'Olá {nome}, tudo bem? Passando para te contar sobre o método do Litrão do Reset!', delay: 3 },
      { texto: 'Nossa receita turbinada de 1 Litro leva Chá Verde, Fibras e Energia limpa. Ajuda a desinchar, queimar retenção e dá muita disposição!', delay: 4 },
      { texto: 'Você prefere que eu te mande os sabores ou quer passar no nosso Espaço para provar uma dose gratuita hoje?', delay: 0 }
    ]
  },
  {
    id: 'seq_2',
    icone: '🧪',
    nome: 'Degustação EVS',
    titulo: '🧪 Convite Degustação Grátis EVS (3 Passos)',
    passos: [
      { texto: 'Oi {nome}, tudo bem por aí?', delay: 3 },
      { texto: 'Estamos selecionando algumas pessoas para provar gratuitamente o Litrão do Reset aqui no nosso Espaço Vida Saudável!', delay: 4 },
      { texto: 'Qual horário fica melhor pra você passar aqui, no almoço ou no final da tarde?', delay: 0 }
    ]
  },
  {
    id: 'seq_3',
    icone: '💰',
    nome: 'Fechamento Pix',
    titulo: '💰 Fechamento de Venda & Pagamento Pix (2 Passos)',
    passos: [
      { texto: 'Maravilha, {nome}! Seu pedido do Kit do Litrão do Reset está registrado!', delay: 3 },
      { texto: 'Você pode realizar o Pix para a nossa chave: {chave_pix}\nAssim que fizer, me manda o comprovante que já preparo o seu kit bem geladinho!', delay: 0 }
    ]
  },
  {
    id: 'seq_4',
    icone: '⏳',
    nome: 'Reativação',
    titulo: '⏳ Reativação de Contatos Sumidos (2 Passos)',
    passos: [
      { texto: 'Oi {nome}, como você está? Lembrei de você hoje!', delay: 3 },
      { texto: 'Chegou uma receita nova do Litrão super refrescante para essa semana! Como andam suas metas de hidratação?', delay: 0 }
    ]
  }
];

function injetarBarraFlutuanteLitrao() {
  if (document.getElementById('litrao-quickbar-container')) return;

  const footer = document.querySelector('#main footer');
  if (!footer) return;

  const bar = document.createElement('div');
  bar.id = 'litrao-quickbar-container';
  bar.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: #0F172A;
    border-top: 1px solid #1E293B;
    border-bottom: 1px solid #1E293B;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11px;
    color: #94A3B8;
    overflow-x: auto;
    white-space: nowrap;
    z-index: 100;
  `;

  let botoesHtml = `<span style="font-weight: 700; color: #38BDF8; display: flex; align-items: center; gap: 4px;">⚡ Litrão 1-Clique:</span>`;

  SEQUENCIAS_FLUTUANTES.forEach((seq, idx) => {
    botoesHtml += `
      <button type="button" data-litrao-quick="${idx}" style="
        background: #1E293B;
        color: #F8FAFC;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.2s;
      " onmouseover="this.style.background='#0284C7'; this.style.borderColor='#38BDF8'" onmouseout="this.style.background='#1E293B'; this.style.borderColor='#334155'">
        <span>${seq.icone}</span> ${seq.nome}
      </button>
    `;
  });

  bar.innerHTML = botoesHtml;

  // Insere acima do footer do chat
  footer.parentNode.insertBefore(bar, footer);

  // Associa eventos de 1 clique
  bar.querySelectorAll('[data-litrao-quick]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(btn.dataset.litraoQuick);
      const seq = SEQUENCIAS_FLUTUANTES[idx];
      if (seq) {
        try {
          await executarSequencia1Clique(seq);
        } catch (err) {
          console.error(err);
        }
      }
    });
  });
}

// Monitora navegação no chat para injetar a barra automaticamente
setInterval(() => {
  try {
    injetarBarraFlutuanteLitrao();
  } catch (_) {}
}, 2000);


// ==========================================
// PAINEL LATERAL ACOPLADO NO WHATSAPP WEB
// ==========================================
let sidebarDockAberta = false;

function alternarSidebarLateral(forcarAberto = null) {
  const dock = document.getElementById('litrao-lateral-dock');
  const btnAbertura = document.getElementById('litrao-lateral-tab-btn');
  if (!dock) return;

  sidebarDockAberta = (forcarAberto !== null) ? forcarAberto : !sidebarDockAberta;
  dock.style.right = sidebarDockAberta ? '0' : '-480px';
  if (btnAbertura) {
    btnAbertura.style.display = sidebarDockAberta ? 'none' : 'flex';
  }
}

function injetarSidebarLateral() {
  if (document.getElementById('litrao-lateral-dock')) return;

  // 1. Botao Flutuante de Abertura na borda direita
  const btnAbertura = document.createElement('div');
  btnAbertura.id = 'litrao-lateral-tab-btn';
  btnAbertura.innerHTML = `<span>⚡</span><span>LITRÃO SUITE</span>`;
  btnAbertura.style.cssText = `
    position: fixed;
    right: 0;
    top: 38%;
    transform: translateY(-50%);
    z-index: 999999;
    background: linear-gradient(135deg, #10B981, #059669);
    color: #FFFFFF;
    font-weight: 800;
    font-size: 11px;
    padding: 12px 6px;
    border-radius: 8px 0 0 8px;
    cursor: pointer;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    box-shadow: -4px 0 16px rgba(0,0,0,0.4);
    letter-spacing: 1px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    user-select: none;
    transition: transform 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  btnAbertura.title = "Clique para abrir o Litrão WhatsApp Suite na Lateral da Tela";

  btnAbertura.onmouseover = () => { btnAbertura.style.transform = 'translateY(-50%) scale(1.05)'; };
  btnAbertura.onmouseout = () => { btnAbertura.style.transform = 'translateY(-50%) scale(1)'; };

  // 2. Container da Sidebar Lateral Acoplada
  const dock = document.createElement('div');
  dock.id = 'litrao-lateral-dock';
  dock.style.cssText = `
    position: fixed;
    right: -480px;
    top: 0;
    width: 440px;
    height: 100vh;
    z-index: 1000000;
    background: #090D16;
    box-shadow: -10px 0 35px rgba(0,0,0,0.7);
    transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    border-left: 1px solid #1E293B;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  dock.innerHTML = `
    <div style="background: #0D1424; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1E293B;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #10B981; color: white; font-weight: 900; font-size: 10px; padding: 2px 6px; border-radius: 4px;">ZAP PRO</span>
        <span style="color: #F8FAFC; font-weight: 800; font-size: 12px;">Litrão Suite Lateral</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button id="litrao-dock-btn-telacheia" style="background: #1E293B; color: #94A3B8; border: 1px solid #334155; border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer; font-weight: bold;" title="Abrir em Tela Cheia">⛶ Tela Cheia</button>
        <button id="litrao-dock-btn-fechar" style="background: #334155; color: #FFF; border: none; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; font-weight: bold;" title="Fechar Lateral">✕</button>
      </div>
    </div>
    <iframe id="litrao-dock-iframe" src="${chrome.runtime.getURL('popup.html')}" style="width: 100%; height: calc(100% - 45px); border: none; background: #090D16;"></iframe>
  `;

  document.body.appendChild(btnAbertura);
  document.body.appendChild(dock);

  btnAbertura.addEventListener('click', () => alternarSidebarLateral(true));
  dock.querySelector('#litrao-dock-btn-fechar').addEventListener('click', () => alternarSidebarLateral(false));
  dock.querySelector('#litrao-dock-btn-telacheia').addEventListener('click', () => {
    window.open(chrome.runtime.getURL('popup.html'), '_blank');
  });
}

// Injetar a Sidebar Lateral no WhatsApp Web
setInterval(() => {
  try {
    injetarSidebarLateral();
  } catch (_) {}
}, 2000);
