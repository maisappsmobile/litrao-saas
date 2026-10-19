/**
 * Litrão do Reset - Extrator de Contatos WhatsApp Web (Content Script)
 * Executado diretamente na página web.whatsapp.com
 */

console.log("[Litrão Reset Extrator] Content script carregado no WhatsApp Web.");

// Helper para normalizar telefones para o padrão internacional limpo
function normalizarTelefone(raw) {
  if (!raw) return '';
  // Remove espaços, traços, parênteses
  let num = raw.replace(/[^\d+]/g, '');
  if (num.startsWith('+')) {
    num = num.substring(1);
  }
  // Se for número brasileiro sem código do país
  if (num.length === 10 || num.length === 11) {
    num = '55' + num;
  }
  return num;
}

// Extrai informações do cabeçalho da conversa aberta
function obterInfoGrupoAtual() {
  const header = document.querySelector('header');
  if (!header) return null;

  // Título da conversa/grupo
  let nomeGrupo = '';
  const tituloEl = header.querySelector('div[role="button"] span[title]') || 
                   header.querySelector('span[dir="auto"]') || 
                   header.querySelector('div[dir="auto"]');
  if (tituloEl) {
    nomeGrupo = tituloEl.getAttribute('title') || tituloEl.innerText || '';
  }

  // Subtítulo (geralmente contém a lista de membros abreviada ou contagem)
  let subtitulo = '';
  const subEl = header.querySelector('span[title*=","]') || 
                header.querySelector('div[class*="copyable-text"]') ||
                header.querySelector('span[class*="matched-text"]');
  if (subEl) {
    subtitulo = subEl.getAttribute('title') || subEl.innerText || '';
  }

  return {
    nomeGrupo: nomeGrupo.trim(),
    subtitulo: subtitulo.trim(),
    isGrupo: !!(subtitulo && (subtitulo.includes(',') || subtitulo.toLowerCase().includes('participante') || subtitulo.toLowerCase().includes('membro')))
  };
}

// Extração Rápida a partir do subtítulo do cabeçalho
function extrairContatosDoSubtitulo(subtitulo, nomeGrupo) {
  if (!subtitulo) return [];
  const partes = subtitulo.split(',').map(s => s.trim());
  const contatos = [];
  const agora = new Date().toISOString();

  partes.forEach(p => {
    if (p.toLowerCase() === 'você' || p.toLowerCase() === 'you') return;
    const apenasDigitos = p.replace(/\D/g, '');
    const isNumero = apenasDigitos.length >= 8;

    const telLimpo = isNumero ? normalizarTelefone(p) : '';
    const nomeExibicao = isNumero ? `Lead WhatsApp (${apenasDigitos.slice(-4)})` : p;

    contatos.push({
      id: 'lead_' + (telLimpo || Math.random().toString(36).substr(2, 9)),
      nome: nomeExibicao,
      telefone: telLimpo || p,
      grupoOrigem: nomeGrupo || 'Grupo WhatsApp',
      extraidoEm: agora,
      isAdmin: false,
      status: 'novo'
    });
  });

  return contatos;
}

// Extração Completa com Scroll no Painel Lateral de Participantes
async function extrairParticipantesPainelLateral(nomeGrupo, onProgress) {
  const header = document.querySelector('header');
  if (!header) return [];

  // Se o painel lateral de informações do grupo não estiver aberto, clica no cabeçalho
  let drawer = document.querySelector('div[data-testid="chat-info-drawer"]') || 
               document.querySelector('section[class*="drawer"]') ||
               document.querySelector('div[class*="chat-info"]');

  if (!drawer) {
    const btnHeader = header.querySelector('div[role="button"]') || header;
    btnHeader.click();
    await new Promise(r => setTimeout(r, 1200));
    drawer = document.querySelector('div[data-testid="chat-info-drawer"]') || 
             document.querySelector('section') || 
             document.body;
  }

  const mapaContatos = new Map();
  const agora = new Date().toISOString();

  // Procura elementos de participantes
  let tentativasScroll = 0;
  const maxTentativas = 25;

  // Localiza a lista rolável de participantes
  let containerLista = drawer.querySelector('div[role="region"]') || 
                       drawer.querySelector('div[class*="overflow-y"]') || 
                       drawer;

  while (tentativasScroll < maxTentativas) {
    tentativasScroll++;
    
    // Procura todos os blocos de contatos na lista
    const itens = drawer.querySelectorAll('div[role="listitem"], div[class*="list-item"], div[data-testid="cell-frame-container"]');
    
    itens.forEach(item => {
      try {
        const textoCompleto = item.innerText || '';
        const linhas = textoCompleto.split('\n').map(l => l.trim()).filter(Boolean);
        if (linhas.length === 0) return;

        let telEncontrado = '';
        let nomeEncontrado = '';
        let isAdmin = textoCompleto.toLowerCase().includes('admin');

        linhas.forEach(linha => {
          if (linha.toLowerCase() === 'você' || linha.toLowerCase() === 'admin do grupo') return;
          const digitos = linha.replace(/\D/g, '');
          if (digitos.length >= 8 && (linha.startsWith('+') || digitos.length >= 10)) {
            telEncontrado = normalizarTelefone(linha);
          } else if (!nomeEncontrado && linha.length > 2) {
            nomeEncontrado = linha;
          }
        });

        if (telEncontrado || nomeEncontrado) {
          const chave = telEncontrado || nomeEncontrado;
          if (!mapaContatos.has(chave)) {
            mapaContatos.set(chave, {
              id: 'lead_' + (telEncontrado || Math.random().toString(36).substr(2, 9)),
              nome: nomeEncontrado || (telEncontrado ? `Contato +${telEncontrado}` : 'Participante'),
              telefone: telEncontrado,
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

    // Scroll para baixo no container de membros
    const elScroll = drawer.querySelector('div[tabindex="-1"][class*="overflow"]') || containerLista;
    if (elScroll && elScroll.scrollTop !== undefined) {
      elScroll.scrollTop += 600;
    }
    window.scrollBy(0, 300);

    await new Promise(r => setTimeout(r, 400));
  }

  return Array.from(mapaContatos.values());
}

// Ouvinte de Mensagens do Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'verificar_status') {
    const info = obterInfoGrupoAtual();
    sendResponse({ sucesso: true, info });
    return true;
  }

  if (request.action === 'extrair_contatos') {
    const info = obterInfoGrupoAtual();
    const nomeGrupo = (info && info.nomeGrupo) ? info.nomeGrupo : 'Grupo do WhatsApp';

    // Executa extração completa
    extrairParticipantesPainelLateral(nomeGrupo, (qtd) => {
      try {
        chrome.runtime.sendMessage({ action: 'progresso_extracao', contagem: qtd });
      } catch (_) {}
    }).then(contatos => {
      // Se não encontrou pelo painel lateral, tenta pelo subtítulo
      if (contatos.length === 0 && info && info.subtitulo) {
        contatos = extrairContatosDoSubtitulo(info.subtitulo, nomeGrupo);
      }

      sendResponse({
        sucesso: true,
        nomeGrupo: nomeGrupo,
        total: contatos.length,
        contatos: contatos
      });
    }).catch(err => {
      sendResponse({ sucesso: false, erro: err.message });
    });

    return true; // Mantém a porta assíncrona aberta
  }
});
