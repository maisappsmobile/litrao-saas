/**
 * ResetFIT - Automação WhatsApp Pro (Content Script)
 * Versão 2.5.1 - Extrator Inteligente, Mídias, Mensagens Rápidas e Disparador Anti-Bloqueio
 */

if (window.__RESETFIT_LOADED__) {
  console.log("[ResetFIT Pro] Content script já carregado nesta aba.");
} else {
  window.__RESETFIT_LOADED__ = true;
  console.log("[ResetFIT Pro v2.5.1] Content script carregado no WhatsApp Web.");

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

// Extrai informações do cabeçalho da conversa aberta (Título real e Subtítulo)
function obterInfoGrupoAtual() {
  const header = obterHeaderConversaAtiva();
  if (!header) return null;

  let nomeGrupo = '';
  let subtitulo = '';

  const infoBtn = header.querySelector('div[role="button"]') || header;

  // Varre todos os elementos com texto dentro da área de informações do cabeçalho
  const elementosTexto = Array.from(infoBtn.querySelectorAll('span[dir="auto"], span, div[dir="auto"], h2'))
    .map(el => ({
      texto: (el.innerText || '').trim(),
      titulo: (el.getAttribute('title') || '').trim()
    }))
    .filter(item => item.texto.length > 0 || item.titulo.length > 0);

  // 1. Identifica o subtítulo: contém vírgula com números de telefone ou termos de status
  for (const item of elementosTexto) {
    const val = item.titulo || item.texto;
    if (val.includes(',') || val.includes('+55') || (/\d{4}/.test(val) && val.includes('-'))) {
      subtitulo = val;
      break;
    }
  }

  // 2. Identifica o nome do grupo: NÃO pode ser a lista de contatos/subtítulo
  for (const item of elementosTexto) {
    const val = item.texto || item.titulo;
    if (val && val !== subtitulo && !val.includes(',') && !val.startsWith('+') && val.length >= 2) {
      nomeGrupo = val;
      break;
    }
  }

  // Se o nome não foi encontrado sem vírgula, busca o primeiro span[dir="auto"] que não seja o subtítulo
  if (!nomeGrupo) {
    const dirSpans = infoBtn.querySelectorAll('span[dir="auto"]');
    for (const s of dirSpans) {
      const t = (s.innerText || s.getAttribute('title') || '').trim();
      if (t && t !== subtitulo) {
        nomeGrupo = t;
        break;
      }
    }
  }

  // Fallback de segurança: se nomeGrupo ainda contiver vírgula com telefone, procura no drawer lateral ou na lista de chats
  if (nomeGrupo && (nomeGrupo.includes(',') || /\+\d{2}/.test(nomeGrupo))) {
    if (!subtitulo) subtitulo = nomeGrupo;
    const drawerTitulo = document.querySelector('div[data-testid="chat-info-drawer"] span[title]') ||
                         document.querySelector('div[data-testid="chat-info-drawer"] span[dir="auto"]');
    if (drawerTitulo) {
      nomeGrupo = (drawerTitulo.getAttribute('title') || drawerTitulo.innerText || '').trim();
    } else {
      // Pega a primeira linha de texto puro do botão de cabeçalho
      const primeiraLinha = (infoBtn.innerText || '').split('\n')[0].trim();
      if (primeiraLinha && !primeiraLinha.includes(',')) {
        nomeGrupo = primeiraLinha;
      } else {
        nomeGrupo = 'Grupo WhatsApp';
      }
    }
  }

  return {
    nomeGrupo: (nomeGrupo && nomeGrupo !== subtitulo) ? nomeGrupo.trim() : 'Grupo WhatsApp',
    subtitulo: subtitulo.trim()
  };
}

// Detecta com alta precisão se uma conversa é Grupo ou Contato Individual
function verificarEhGrupo(item, titulo) {
  if (!item) return false;

  // 1. Ícones explícitos do WhatsApp Web que indicam grupo ou comunidade
  if (item.querySelector('span[data-icon="default-group"]') ||
      item.querySelector('span[data-icon="community-outline"]') ||
      item.querySelector('span[data-icon="announcement"]') ||
      item.querySelector('span[data-icon="newsletter"]')) {
    return true;
  }

  // 2. Ícone explícito de usuário individual do WhatsApp Web
  if (item.querySelector('span[data-icon="default-user"]') ||
      item.querySelector('span[data-icon="default-user-dark"]')) {
    return false;
  }

  // 3. Verifica o texto completo da célula da conversa
  const textoCell = (item.innerText || item.textContent || '');

  // No WhatsApp Web, quando uma mensagem em grupo é enviada por outra pessoa, o texto começa com til e nome (~Autor:)
  // Ex: "~Fumaça Taxista: Foto", "~Valdivino Dorna: https:..."
  if (/~[^\n:]{2,30}:/.test(textoCell)) {
    return true;
  }

  // Mensagens típicas de atividade do sistema em grupos
  if (/(adicionou|removeu|saiu do grupo|entrou usando|mudou o nome|mudou a imagem|criou o grupo)/i.test(textoCell)) {
    return true;
  }

  // 4. Termos inconfundíveis em nomes de grupos/comunidades
  const titLow = (titulo || '').toLowerCase();
  const termosGrupo = [
    'grupo', 'equipe', 'team', 'vendas', 'compras', 'comunidade', 'comercial',
    'classificados', 'feira', 'leilao', 'leilão', 'bazar', 'loja', 'oficial',
    'suporte', 'consultores', 'divulga', 'anuncios', 'anúncios', 'trocas', 'turma',
    'embaixadores', 'vip', 'clube', 'boas vindas', 'boutique', 'construtora', 'mecanica', 'mecânica',
    'moda', 'imobiliaria', 'imobiliária', 'garimpo', 'distribuidora', 'academia', 'atacado', 'varejo',
    'supermercado', 'drogaria', 'foco', 'publicidade'
  ];
  if (termosGrupo.some(t => titLow.includes(t))) {
    return true;
  }

  // 5. Títulos com múltiplos emojis ou marcadores de formatação comuns em grupos
  if (/\[.+\]|\(.+\)|[\u{1F300}-\u{1F6FF}]{2,}/u.test(titulo)) {
    return true;
  }

  // 6. Se o título for um número de telefone puro (+55...), é contato individual
  if (/^\+?\d[\d\s-]{6,}$/.test(titulo)) {
    return false;
  }

  // 7. Se não teve nenhum indicador de grupo acima, classifica como Contato Individual (ex: "Fagner Brassaroto", "Lucia Braga")
  return false;
}

// Lista todas as conversas/grupos da barra lateral esquerda de forma categorizada
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
          const isGrupo = verificarEhGrupo(item, titulo);
          lista.push({
            nome: titulo,
            isGrupo: isGrupo
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
// Localiza o Drawer lateral direito (Dados do Grupo)
function obterDrawerGrupoAberto() {
  const d = document.querySelector('div[data-testid="chat-info-drawer"]') ||
            document.querySelector('div[data-testid="drawer-right"]') ||
            document.querySelector('div[data-testid="drawer-middle"]');
  if (d) return d;

  const possiveis = document.querySelectorAll('div[role="region"], section, div[tabindex="-1"]');
  for (const p of possiveis) {
    if (p.id === 'pane-side' || p.closest('#pane-side') || p.closest('#main footer')) continue;
    const txt = (p.innerText || '').toLowerCase();
    if (txt.includes('dados do grupo') || txt.includes('informações do grupo') || (txt.includes('participante') && (txt.includes('membro') || txt.includes('admin') || txt.includes('sair')))) {
      return p;
    }
  }
  return null;
}

// Abre os Dados do Grupo de forma garantida no WhatsApp Web
async function abrirDadosDoGrupoWhatsApp() {
  if (document.querySelector('div[role="dialog"]')) return true;
  if (obterDrawerGrupoAberto()) return true;

  const header = obterHeaderConversaAtiva();
  if (!header) return false;

  mostrarToastWhatsApp('🔍 Abrindo Dados do Grupo no WhatsApp...', 'info', 2000);

  // 1. Tenta clicar diretamente no título do grupo (bloco central do cabeçalho)
  // Ignora o avatar e botões de ação (Adicionar à lista, vídeo, chamada)
  const areaTitulo = header.querySelector('div[data-testid="conversation-info-header"]') ||
                     header.querySelector('span[title]')?.closest('div[role="button"]') ||
                     header.querySelector('span[title]')?.parentElement ||
                     header.querySelector('div[dir="auto"]') ||
                     (header.children.length >= 2 ? header.children[1] : null);

  if (areaTitulo) {
    areaTitulo.click();
    await new Promise(r => setTimeout(r, 1200));
  }

  // 2. Se o drawer ainda não abriu, usa o menu de 3 pontinhos do cabeçalho
  if (!obterDrawerGrupoAberto() && !document.querySelector('div[role="dialog"]')) {
    const btnMenu = header.querySelector('button[aria-label*="Mais opções" i]') ||
                    header.querySelector('div[role="button"][title*="Mais opções" i]') ||
                    header.querySelector('span[data-icon="menu"]')?.closest('button, div[role="button"]') ||
                    header.querySelector('span[data-icon="more-options"]')?.closest('button, div[role="button"]');

    if (btnMenu) {
      btnMenu.click();
      await new Promise(r => setTimeout(r, 400));

      const menuItens = Array.from(document.querySelectorAll('div[role="application"] div[role="button"], div[role="menu"] div[role="button"], ul[role="menu"] li, div[tabindex="-1"] div[role="button"]'));
      const itemDados = menuItens.find(el => {
        const t = (el.innerText || '').toLowerCase();
        return t.includes('dados do grupo') || t.includes('info. do grupo') || t.includes('informações do grupo') || t.includes('group info');
      });

      if (itemDados) {
        itemDados.click();
        await new Promise(r => setTimeout(r, 1200));
      }
    }
  }

  return !!(document.querySelector('div[role="dialog"]') || obterDrawerGrupoAberto());
}

// Simula eventos de mouse completos para disparar cliques do React/WhatsApp
function simularClique(elemento) {
  if (!elemento) return;
  try {
    const opts = { bubbles: true, cancelable: true, view: window };
    elemento.dispatchEvent(new MouseEvent('mousedown', opts));
    elemento.dispatchEvent(new MouseEvent('mouseup', opts));
    elemento.dispatchEvent(new MouseEvent('click', opts));
    if (typeof elemento.click === 'function') elemento.click();
  } catch (_) {}
}

// Força a rolagem para baixo em todos os containers reais do WhatsApp Web
function rolarTudoParaBaixo(container, delta = 550) {
  if (!container) return;

  // 1. O container clássico do WhatsApp Web (div[tabindex="-1"] no drawer/dialog)
  const tabBox = container.querySelector('div[tabindex="-1"]');
  if (tabBox) {
    try {
      tabBox.scrollTop += delta;
      tabBox.dispatchEvent(new Event('scroll', { bubbles: true }));
      tabBox.dispatchEvent(new WheelEvent('wheel', { deltaY: delta, bubbles: true }));
    } catch (_) {}
  }

  // 2. Rola qualquer outro elemento dentro do container com scrollHeight > clientHeight
  const todos = container.querySelectorAll('*');
  for (const el of todos) {
    if (el.scrollHeight > el.clientHeight + 15) {
      try {
        el.scrollTop += delta;
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: delta, bubbles: true }));
      } catch (_) {}
    }
  }

  // 3. scrollIntoView no último elemento visível para acionar a virtualização
  const itens = container.querySelectorAll('div[role="listitem"], div[role="button"], div[data-testid="cell-frame-container"]');
  if (itens.length > 0) {
    try {
      itens[itens.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch (_) {}
  }
}

// Coleta participantes visíveis no DOM com filtros inteligentes
function coletarMembrosVisiveis(container, nomeGrupo = '') {
  const encontrados = [];
  const visitados = new Set();
  const nomeGrupoLow = (nomeGrupo || '').toLowerCase().trim();

  // Termos de botões e itens institucionais que nunca são pessoas
  const termosSistema = [
    'adicionar membro', 'adicionar participantes', 'convidar para o grupo via link',
    'convidar via link', 'pesquisar membros', 'pesquisar participantes', 'dados do grupo',
    'mídia, links e docs', 'mensagens temporárias', 'criptografia', 'configurações do grupo',
    'sair do grupo', 'denunciar grupo', 'adicionar descrição', 'silenciar notificações',
    'visibilidade de mídia', 'mensagens favoritas', 'criar comunidade', 'desativada',
    'adicionar etiqueta'
  ];

  const seletores = [
    'div[role="listitem"]',
    'div[data-testid="cell-frame-container"]',
    'div[role="button"]',
    'div[tabindex="-1"]',
    'div[tabindex="0"]'
  ];

  const elementos = Array.from(container.querySelectorAll(seletores.join(', ')));

  for (const el of elementos) {
    const txt = (el.innerText || '').trim();
    if (!txt) continue;

    const txtLow = txt.toLowerCase();

    // Ignora títulos, descrições e botões de ação
    if (nomeGrupoLow && (txtLow === nomeGrupoLow || txtLow.startsWith(nomeGrupoLow))) continue;
    if (txtLow === 'adicionar' || txtLow === 'pesquisar') continue;
    if (termosSistema.some(ts => txtLow === ts || txtLow.startsWith(ts))) continue;

    // Ignora recipientes que tenham múltiplas fotos de perfil
    const qtdImgs = el.querySelectorAll('img').length;
    if (qtdImgs > 1) continue;

    const ehVoce = txtLow.startsWith('você') || txtLow.includes('adicionar etiqueta');
    const isAdmin = txtLow.includes('admin');

    let telefone = '';
    let nome = '';

    // 1. Procura número em atributo title
    const comTitle = el.querySelectorAll('[title]');
    for (const t of comTitle) {
      const val = (t.getAttribute('title') || '').trim();
      const dig = val.replace(/\D/g, '');
      if (dig.length >= 8 && (val.startsWith('+') || dig.length >= 10)) {
        telefone = normalizarTelefone(val);
        break;
      }
    }

    // 2. Procura nas linhas de texto do elemento
    const linhas = txt.split('\n').map(l => l.trim()).filter(Boolean);
    for (const l of linhas) {
      if (l.toLowerCase().includes('admin')) continue;
      if (l.toLowerCase().includes('adicionar etiqueta')) continue;
      if (l.toLowerCase() === 'você' || l.toLowerCase() === 'you') continue;

      const dig = l.replace(/\D/g, '');
      if (!telefone && dig.length >= 8 && (l.startsWith('+') || dig.length >= 10)) {
        telefone = normalizarTelefone(l);
      } else if (!nome && !l.startsWith('~') && l.length >= 2 && !l.toLowerCase().includes('olá!') && !l.toLowerCase().includes('estou usando')) {
        nome = l;
      } else if (!nome && l.startsWith('~')) {
        nome = l.replace(/^~/, '').trim();
      }
    }

    if (ehVoce && !nome) nome = 'Você';

    if (telefone || (nome && nome.length >= 2)) {
      const chave = telefone || ('contato_' + nome);
      if (!visitados.has(chave)) {
        visitados.add(chave);
        encontrados.push({
          id: 'lead_' + (telefone || Math.random().toString(36).substr(2, 9)),
          nome: nome || (telefone ? `Contato +${telefone}` : 'Participante'),
          telefone: telefone ? `+${telefone}` : '',
          grupo: nomeGrupo,
          grupoOrigem: nomeGrupo,
          isAdmin: isAdmin,
          status: 'novo'
        });
      }
    }
  }

  return encontrados;
}

// Extrai contatos do subtítulo do cabeçalho (#main header)
function extrairContatosDoHeader(nomeGrupo) {
  const contatos = [];
  const header = document.querySelector('#main header');
  if (!header) return contatos;

  const spans = header.querySelectorAll('span[title], div[title], span[dir="auto"]');
  spans.forEach(s => {
    const txt = (s.getAttribute('title') || s.innerText || '').trim();
    if (txt.includes(',') || txt.includes('+55')) {
      const partes = txt.split(',').map(p => p.trim()).filter(Boolean);
      partes.forEach(p => {
        if (p.toLowerCase() === 'você' || p.toLowerCase() === 'you') return;
        const dig = p.replace(/\D/g, '');
        if (dig.length >= 8) {
          const tel = normalizarTelefone(p);
          contatos.push({
            id: 'lead_' + tel,
            nome: `Contato +${tel}`,
            telefone: `+${tel}`,
            grupo: nomeGrupo,
            grupoOrigem: nomeGrupo,
            isAdmin: false,
            status: 'novo'
          });
        } else if (p.length >= 2 && !p.toLowerCase().includes('online') && !p.toLowerCase().includes('visto por último')) {
          contatos.push({
            id: 'lead_' + Math.random().toString(36).substr(2, 9),
            nome: p,
            telefone: '',
            grupo: nomeGrupo,
            grupoOrigem: nomeGrupo,
            isAdmin: false,
            status: 'novo'
          });
        }
      });
    }
  });

  return contatos;
}

// Extrai contatos com Scroll Universal no WhatsApp Web
async function extrairTodosOsParticipantes(nomeGrupo, onProgress) {
  const agora = new Date().toISOString();
  const mapaContatos = new Map();
  const infoAtual = obterInfoGrupoAtual();

  if (!nomeGrupo || nomeGrupo === '__ATUAL__') {
    nomeGrupo = (infoAtual && infoAtual.nomeGrupo) ? infoAtual.nomeGrupo : 'Grupo WhatsApp';
  }

  // 1. Garante que os Dados do Grupo estão abertos na tela
  await abrirDadosDoGrupoWhatsApp();
  await new Promise(r => setTimeout(r, 600));

  // 2. Localiza o drawer ou modal aberto
  let dialog = document.querySelector('div[role="dialog"]');
  let drawer = obterDrawerGrupoAberto();

  // 3. Tenta clicar no botão "Pesquisar" de membros para isolar a lista
  if (!dialog && drawer) {
    const botoes = Array.from(drawer.querySelectorAll('button, div[role="button"], span'));
    for (const b of botoes) {
      const txt = (b.innerText || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if ((txt === 'pesquisar' || aria === 'pesquisar') && !b.closest('header')) {
        const btnClicavel = b.closest('button, div[role="button"]') || b;
        simularClique(btnClicavel);
        await new Promise(r => setTimeout(r, 700));
        dialog = document.querySelector('div[role="dialog"]');
        drawer = obterDrawerGrupoAberto();
        break;
      }
    }
  }

  let containerPrincipal = dialog || drawer;

  // 4. Identifica a quantidade esperada de membros (ex: 51 membros)
  let totalEsperado = 0;
  const textoGeral = (containerPrincipal?.innerText || '') + ' ' + (document.body.innerText || '');
  const matchMembros = textoGeral.match(/(\d+)\s*(membros|participantes)/i);
  if (matchMembros) {
    totalEsperado = parseInt(matchMembros[1], 10);
  }

  mostrarToastWhatsApp(`⚡ Extraindo participantes com scroll automático...${totalEsperado ? ` (Meta: ${totalEsperado} membros)` : ''}`, 'info', 3000);

  // 5. Loop de Scroll Virtual Universal
  let repeticoesSemNovos = 0;
  let ultimoTotal = 0;
  const maxPassos = 80;

  for (let step = 0; step < maxPassos; step++) {
    const containerAtual = document.querySelector('div[role="dialog"]') || obterDrawerGrupoAberto() || document.body;
    const membrosVisiveis = coletarMembrosVisiveis(containerAtual, nomeGrupo);

    membrosVisiveis.forEach(m => {
      const chave = m.telefone || ('contato_' + m.nome);
      if (!mapaContatos.has(chave)) {
        m.extraidoEm = agora;
        mapaContatos.set(chave, m);
      }
    });

    if (onProgress) {
      onProgress(mapaContatos.size);
    }

    // Se já coletou todos os membros esperados do grupo, encerra com sucesso!
    if (totalEsperado > 0 && mapaContatos.size >= totalEsperado) {
      break;
    }

    // Tenta clicar em "Ver todos" se existir
    const btnVerTodos = Array.from(containerAtual.querySelectorAll('button, div[role="button"], span')).find(el => {
      const t = (el.innerText || '').trim().toLowerCase();
      return t.startsWith('ver todos') || t.includes('outros membros') || t.includes('mais membros') || t.includes('a mais') || /ver mais/i.test(t);
    });
    if (btnVerTodos) {
      const clicavel = btnVerTodos.closest('button, div[role="button"]') || btnVerTodos;
      simularClique(clicavel);
      await new Promise(r => setTimeout(r, 600));
    }

    // Critério de parada: se não surgem novos membros
    if (mapaContatos.size === ultimoTotal) {
      repeticoesSemNovos++;
      // Nunca encerra precocemente se ainda não encontrou ninguém e não tentou ao menos 50 passos
      if (repeticoesSemNovos >= 15 && (mapaContatos.size > 0 || step > 50)) {
        break;
      }
    } else {
      repeticoesSemNovos = 0;
      ultimoTotal = mapaContatos.size;
    }

    // Rola todos os containers do drawer para baixo
    rolarTudoParaBaixo(containerAtual, 550);

    await new Promise(r => setTimeout(r, 350));
  }

  // 6. Complementa com participantes identificados no cabeçalho (#main header)
  const contatosHeader = extrairContatosDoHeader(nomeGrupo);
  contatosHeader.forEach(c => {
    const chave = c.telefone || ('contato_' + c.nome);
    if (!mapaContatos.has(chave)) {
      c.extraidoEm = agora;
      mapaContatos.set(chave, c);
    }
  });

  const listaFinal = Array.from(mapaContatos.values());
  const comTel = listaFinal.filter(c => c.telefone && c.telefone.length >= 8);
  mostrarToastWhatsApp(`🎉 <b>${listaFinal.length} participantes extraídos!</b> (${comTel.length} com WhatsApp)`, 'success', 4500);

  return listaFinal;
}

// Ouvinte de Mensagens do Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'disparar_mensagem_para_telefone') {
    dispararMensagemParaNumero(request.telefone, request.texto, request.midia)
      .then(resultado => sendResponse({ sucesso: true, resultado }))
      .catch(err => sendResponse({ sucesso: false, erro: err.message }));
    return true;
  }

  if (request.action === 'enviar_midia_chat') {
    enviarMidiaNoChat(request.midia.base64, request.midia.mimeType, request.legenda || '', request.midia.nome)
      .then(resultado => sendResponse({ sucesso: true, resultado }))
      .catch(err => sendResponse({ sucesso: false, erro: err.message }));
    return true;
  }

  if (request.action === 'abrir_drawer_lateral') {
    alternarSidebarLateral(true);
    sendResponse({ sucesso: true });
    return false;
  }

  if (request.action === 'verificar_status') {
    const info = obterInfoGrupoAtual();
    sendResponse({ sucesso: true, info });
    return false;
  }

  if (request.action === 'listar_conversas') {
    const conversas = listarTodasConversas();
    const infoAtual = obterInfoGrupoAtual();
    sendResponse({ sucesso: true, conversas, infoAtual });
    return false;
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
// NOTIFICAÇÕES VISUAIS INTELIGENTES (TOAST)
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

// Converte DataURL Base64 para objeto File nativo
function base64ParaArquivo(base64Data, nomeArquivo, mimeType) {
  let mime = mimeType || 'image/jpeg';
  let b64 = base64Data;
  if (base64Data && base64Data.includes(',')) {
    const partes = base64Data.split(',');
    const matchMime = partes[0].match(/:(.*?);/);
    if (matchMime) mime = matchMime[1];
    b64 = partes[1];
  }
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new File([bytes], nomeArquivo || 'midia_litrao', { type: mime });
}

// Envia uma imagem ou vídeo no chat ativo com legenda opcional
async function enviarMidiaNoChat(base64Data, mimeType, legenda = '', nomeArquivo = 'midia') {
  if (!base64Data) {
    throw new Error('Nenhum dado de mídia fornecido para envio.');
  }

  const file = base64ParaArquivo(base64Data, nomeArquivo, mimeType);

  // 1. Garante que uma conversa está aberta
  const inputBox = encontrarInputBoxWhatsApp();
  if (!inputBox) {
    throw new Error('Nenhuma conversa aberta no WhatsApp Web. Abra um chat primeiro.');
  }

  const isVideo = file.type.includes('video') || (nomeArquivo && nomeArquivo.match(/\.(mp4|mov|webm)$/i));
  mostrarToastWhatsApp(`📎 <b>Anexando ${isVideo ? 'vídeo' : 'foto'}...</b>`, 'info', 2000);

  // 2. Tenta encontrar o input de arquivo diretamente no DOM
  let inputArquivo = null;
  const inputsIniciais = Array.from(document.querySelectorAll('input[type="file"]'));
  inputArquivo = inputsIniciais.find(i => i.accept && (i.accept.includes('image') || i.accept.includes('video')));

  // Se não encontrar o input pronto, clica no botão de Anexo (+)
  if (!inputArquivo) {
    const btnAnexo = document.querySelector('#main footer span[data-icon="plus"]')?.closest('button') ||
                     document.querySelector('#main footer span[data-icon="clip"]')?.closest('button') ||
                     document.querySelector('#main footer button[title*="Anexar"]') ||
                     document.querySelector('#main footer button[aria-label*="Anexar"]') ||
                     document.querySelector('#main footer button[aria-label*="Attach"]');

    if (btnAnexo) {
      btnAnexo.click();
      await new Promise(r => setTimeout(r, 400));
    }

    // Busca novamente após abrir o menu de anexo
    const inputsAposMenu = Array.from(document.querySelectorAll('input[type="file"]'));
    inputArquivo = inputsAposMenu.find(i => i.accept && (i.accept.includes('image') || i.accept.includes('video'))) || inputsAposMenu[0];
  }

  let abriuModal = false;

  // 3. Aplica o arquivo no input via DataTransfer
  if (inputArquivo) {
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputArquivo.files = dt.files;
      inputArquivo.dispatchEvent(new Event('input', { bubbles: true }));
      inputArquivo.dispatchEvent(new Event('change', { bubbles: true }));
      abriuModal = true;
    } catch (e) {
      console.warn('[Litrão] Falha ao injetar no input de arquivo:', e);
    }
  }

  // 4. Fallback: Se o input não funcionou ou modal não abriu, usa ClipboardEvent (Paste)
  if (!abriuModal) {
    try {
      inputBox.focus();
      const dtPaste = new DataTransfer();
      dtPaste.items.add(file);
      const pasteEvt = new ClipboardEvent('paste', {
        clipboardData: dtPaste,
        bubbles: true,
        cancelable: true
      });
      inputBox.dispatchEvent(pasteEvt);
    } catch (e) {
      console.warn('[Litrão] Falha no fallback de colagem:', e);
    }
  }

  // 5. Aguarda o modal de preview da mídia abrir (até 7 segundos)
  let modalAberto = false;
  let btnEnviarMidia = null;

  for (let tentativa = 0; tentativa < 28; tentativa++) {
    await new Promise(r => setTimeout(r, 250));

    btnEnviarMidia = document.querySelector('div[role="dialog"] span[data-icon="send"]')?.closest('button') ||
                     document.querySelector('div[role="dialog"] span[data-icon="send"]')?.closest('div[role="button"]') ||
                     document.querySelector('span[data-icon="send"]')?.closest('div[role="button"]') ||
                     document.querySelector('span[data-icon="send"]')?.closest('button') ||
                     document.querySelector('button[data-testid="send"]') ||
                     document.querySelector('div[aria-label="Enviar"][role="button"]');

    const isPreview = document.querySelector('div[role="dialog"]') ||
                      document.querySelector('div[data-testid="media-editor-controls"]') ||
                      document.querySelector('div[data-testid="media-caption-input-container"]');

    if (btnEnviarMidia && isPreview) {
      modalAberto = true;
      break;
    }
  }

  if (!modalAberto && !btnEnviarMidia) {
    throw new Error('Não foi possível abrir o preview de mídia no WhatsApp Web.');
  }

  await new Promise(r => setTimeout(r, 400));

  // 6. Insere a legenda se houver
  if (legenda && legenda.trim().length > 0) {
    const inputLegenda = document.querySelector('div[role="dialog"] div[contenteditable="true"]') ||
                         document.querySelector('div[data-testid="media-caption-input-container"] div[contenteditable="true"]') ||
                         document.querySelector('div[data-testid="media-caption-input"]') ||
                         document.querySelector('div[aria-label*="legenda" i]') ||
                         document.querySelector('div[title*="legenda" i]') ||
                         document.querySelector('div[contenteditable="true"][data-tab="10"]');

    if (inputLegenda) {
      inputLegenda.focus();
      await new Promise(r => setTimeout(r, 120));
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, legenda);

      inputLegenda.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: legenda, inputType: 'insertText' }));
      inputLegenda.dispatchEvent(new Event('input', { bubbles: true }));
      inputLegenda.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 250));
    }
  }

  // 7. Clica no botão de enviar do modal
  btnEnviarMidia = document.querySelector('div[role="dialog"] span[data-icon="send"]')?.closest('button') ||
                   document.querySelector('div[role="dialog"] span[data-icon="send"]')?.closest('div[role="button"]') ||
                   document.querySelector('span[data-icon="send"]')?.closest('div[role="button"]') ||
                   document.querySelector('span[data-icon="send"]')?.closest('button') ||
                   document.querySelector('button[data-testid="send"]') ||
                   document.querySelector('div[aria-label="Enviar"][role="button"]');

  if (btnEnviarMidia) {
    btnEnviarMidia.click();
  } else {
    // Fallback: Pressiona Enter
    const activeEl = document.activeElement;
    if (activeEl) {
      activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      activeEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }
  }

  // 8. Aguarda o modal de envio fechar
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    const aindaAberto = document.querySelector('div[role="dialog"] span[data-icon="send"]');
    if (!aindaAberto) break;
  }

  await new Promise(r => setTimeout(r, 500));
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

      const tipoPasso = passo.midia ? (passo.midia.tipo === 'video' ? '🎥 Vídeo' : '📷 Foto') : '💬 Texto';
      mostrarToastWhatsApp(`📤 <b>Passo ${i + 1}/${sequencia.passos.length} (${tipoPasso}):</b><br>${textoPronto.substring(0, 50)}...`, 'info', 2500);

      if (passo.midia && passo.midia.base64) {
        await enviarMidiaNoChat(passo.midia.base64, passo.midia.mimeType, textoPronto, passo.midia.nome);
      } else {
        await enviarMensagemNoChat(textoPronto);
      }

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
    titulo: '🥤 Apresentação Completa ResetFIT (3 Passos)',
    passos: [
      { texto: 'Olá {nome}, tudo bem? Passando para te contar sobre o método ResetFIT!', delay: 3 },
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
      { texto: 'Estamos selecionando algumas pessoas para provar gratuitamente o ResetFIT aqui no nosso Espaço Vida Saudável!', delay: 4 },
      { texto: 'Qual horário fica melhor pra você passar aqui, no almoço ou no final da tarde?', delay: 0 }
    ]
  },
  {
    id: 'seq_3',
    icone: '💰',
    nome: 'Fechamento Pix',
    titulo: '💰 Fechamento de Venda & Pagamento Pix (2 Passos)',
    passos: [
      { texto: 'Maravilha, {nome}! Seu pedido do Kit ResetFIT está registrado!', delay: 3 },
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
      { texto: 'Chegou uma receita nova do ResetFIT super refrescante para essa semana! Como andam suas metas de hidratação?', delay: 0 }
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

  let botoesHtml = `<span style="font-weight: 700; color: #10B981; display: flex; align-items: center; gap: 4px;">⚡ ResetFIT 1-Clique:</span>`;

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
  btnAbertura.innerHTML = `<span>⚡</span><span>RESETFIT</span>`;
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
  btnAbertura.title = "Clique para abrir o ResetFIT na Lateral da Tela";

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
        <span style="background: #10B981; color: white; font-weight: 900; font-size: 10px; padding: 2px 6px; border-radius: 4px;">RESETFIT</span>
        <span style="color: #F8FAFC; font-weight: 800; font-size: 12px;">ResetFIT Lateral</span>
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


// ==========================================
// MOTOR DE ENVIO INDIVIDUAL POR TELEFONE (DISPARADOR EM MASSA)
// ==========================================
async function abrirChatPorTelefone(telLimpo) {
  // 1. Tenta encontrar a conversa se já estiver aberta na barra lateral
  const itensConversa = document.querySelectorAll('#pane-side div[role="listitem"], #pane-side div[data-testid="cell-frame-container"]');
  for (const item of itensConversa) {
    const span = item.querySelector('span[title]');
    if (span) {
      const t = span.getAttribute('title') || '';
      if (t.replace(/\D/g, '').endsWith(telLimpo.slice(-8))) {
        item.click();
        await new Promise(r => setTimeout(r, 1200));
        return true;
      }
    }
  }

  // 2. Abre via link interno do WhatsApp Web
  let a = document.getElementById('litrao-nav-anchor');
  if (!a) {
    a = document.createElement('a');
    a.id = 'litrao-nav-anchor';
    a.style.display = 'none';
    document.body.appendChild(a);
  }
  a.href = `https://web.whatsapp.com/send?phone=${telLimpo}`;
  a.click();

  // Aguarda o chat carregar (procura a caixa de mensagem por até 12 segundos)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 500));
    // Detecta se apareceu alerta de número inválido
    const dialogInvalido = document.querySelector('div[data-testid="popup-contents"], div[role="dialog"]');
    if (dialogInvalido && (dialogInvalido.innerText.includes('inválido') || dialogInvalido.innerText.includes('invalid') || dialogInvalido.innerText.includes('não está no WhatsApp'))) {
      const btnOk = dialogInvalido.querySelector('button');
      if (btnOk) btnOk.click();
      throw new Error('O número não está cadastrado no WhatsApp.');
    }
    const inputBox = encontrarInputBoxWhatsApp();
    if (inputBox) {
      await new Promise(r => setTimeout(r, 600));
      return true;
    }
  }
  throw new Error('Tempo limite esgotado ao abrir conversa com +' + telLimpo);
}

async function dispararMensagemParaNumero(telefone, texto, midia = null) {
  const telLimpo = normalizarTelefone(telefone);
  if (!telLimpo || telLimpo.length < 8) {
    throw new Error('Número de telefone inválido: ' + telefone);
  }

  const descTipo = midia ? (midia.tipo === 'video' ? '🎥 vídeo' : '📷 foto') : '💬 texto';
  mostrarToastWhatsApp(`📤 <b>Iniciando envio (${descTipo}) para:</b> +${telLimpo}`, 'info', 2500);

  await abrirChatPorTelefone(telLimpo);

  if (midia && midia.base64) {
    await enviarMidiaNoChat(midia.base64, midia.mimeType, texto, midia.nome);
  } else {
    await enviarMensagemNoChat(texto);
  }

  mostrarToastWhatsApp(`✅ <b>Entrega com sucesso para:</b> +${telLimpo}!`, 'success', 3000);
  return { sucesso: true, telefone: telLimpo };
}

} // Fim da proteção de carga idempotente window.__RESETFIT_LOADED__
