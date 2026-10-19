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

// Extrai informações do cabeçalho da conversa aberta
function obterInfoGrupoAtual() {
  const header = document.querySelector('header');
  if (!header) return null;

  let nomeGrupo = '';
  const tituloEl = header.querySelector('div[role="button"] span[title]') || 
                   header.querySelector('span[dir="auto"]') || 
                   header.querySelector('div[dir="auto"]');
  if (tituloEl) {
    nomeGrupo = tituloEl.getAttribute('title') || tituloEl.innerText || '';
  }

  let subtitulo = '';
  const subEl = header.querySelector('span[title*=","]') || 
                header.querySelector('div[class*="copyable-text"]') ||
                header.querySelector('span[class*="matched-text"]');
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

  // 1. Procura se já existe um modal central aberto (div[role="dialog"]) - EXATAMENTE O DO PRINT 1
  let dialog = document.querySelector('div[role="dialog"]');

  // Se não houver modal central aberto, abre o painel lateral clicando no header
  if (!dialog) {
    const header = document.querySelector('header');
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

  if (request.action === 'enviar_texto_chat') {
    const texto = request.texto || '';
    const inputBox = document.querySelector('div[contenteditable="true"][role="textbox"]') || 
                     document.querySelector('div[data-testid="conversation-compose-box-input"]') ||
                     document.querySelector('footer div[contenteditable="true"]');
    if (inputBox) {
      inputBox.focus();
      document.execCommand('insertText', false, texto);
      inputBox.dispatchEvent(new Event('input', { bubbles: true }));
      
      setTimeout(() => {
        const btnSend = document.querySelector('button[data-testid="compose-btn-send"]') || 
                        document.querySelector('span[data-icon="send"]')?.closest('button');
        if (btnSend) {
          btnSend.click();
        }
      }, 300);
      sendResponse({ sucesso: true });
    } else {
      sendResponse({ sucesso: false, erro: 'Abra uma conversa para enviar a mensagem.' });
    }
    return true;
  }
});
