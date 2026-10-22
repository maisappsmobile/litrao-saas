/**
 * ResetFIT - Módulo de Extração Automática de Grupos do Facebook
 * Injetado em páginas do Facebook para permitir extração com 1 clique para usuários leigos em TI.
 */

(function () {
  'use strict';

  if (window.__RESETFIT_FACEBOOK_INJECTED__) return;
  window.__RESETFIT_FACEBOOK_INJECTED__ = true;

  console.log('[ResetFIT Facebook] Módulo de extração carregado com sucesso!');

  let leadsExtraidosCache = [];
  let grupoNomeCache = 'Grupo do Facebook';

  /**
   * Detecta o nome do grupo atual a partir do cabeçalho ou título da página
   */
  function obterNomeGrupoFacebook() {
    // 1. Tenta pegar do h1 principal do grupo
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText && h1.innerText.trim().length > 2) {
      return h1.innerText.trim();
    }

    // 2. Tenta pegar do título da página
    let title = document.title || '';
    title = title.replace(/\s*\|\s*Facebook\s*$/i, '').trim();
    if (title && title.length > 2) {
      return title;
    }

    return 'Grupo Herbalife Facebook';
  }

  /**
   * Extrai os membros atualmente carregados no DOM do Facebook
   */
  function extrairMembrosDoDom() {
    const nomeGrupo = obterNomeGrupoFacebook();
    grupoNomeCache = nomeGrupo;

    const links = Array.from(document.querySelectorAll('a[role="link"], a[href*="/user/"], a[href*="/groups/"]'));
    const membrosMap = new Map();
    const termosIgnorar = [
      'adicionar', 'mensagem', 'ver tudo', 'amigo', 'grupo', 'facebook',
      'compartilhar', 'curtir', 'notificações', 'feed', 'gaming', 'convidar',
      'classificado', 'discussão', 'destaques', 'vídeo', 'eventos', 'sobre',
      'arquivos', 'mídia', 'reels', 'pesquisar', 'participar', 'entrou', 'membro desde'
    ];

    links.forEach(a => {
      const href = (a.href || '').split('?')[0];
      const nome = (a.innerText || '').trim();

      if (!href || nome.length < 3 || nome.length > 50 || nome.includes('\n')) return;
      const low = nome.toLowerCase();
      if (termosIgnorar.some(t => low.includes(t))) return;

      // Precisa ter estrutura de perfil de usuário do Facebook
      const isPerfil = href.includes('/user/') || href.includes('/profile.php') ||
                       (href.includes('facebook.com/') && !href.includes('/groups/') && !href.includes('/events/') && !href.includes('/watch/'));
      
      // Ou estar dentro de um card de membro
      const card = a.closest('div[role="listitem"]') || a.parentElement?.parentElement || {};
      const cardText = (card.innerText || '').toLowerCase();

      if (!isPerfil && !cardText.includes('administrador') && !cardText.includes('membro')) {
        return;
      }

      const isAdmin = cardText.includes('administrador') || cardText.includes('moderador') || low.includes('admin');

      if (!membrosMap.has(nome)) {
        membrosMap.set(nome, {
          nome: nome,
          perfilUrl: isPerfil ? href : `https://www.facebook.com/search/people/?q=${encodeURIComponent(nome)}`,
          cargo: isAdmin ? 'admin' : 'membro',
          grupoOrigem: nomeGrupo
        });
      }
    });

    leadsExtraidosCache = Array.from(membrosMap.values());
    return leadsExtraidosCache;
  }

  /**
   * Executa rolagem automática suave para baixo para carregar mais membros
   */
  async function rolarParaCarregarMais(vezes = 3) {
    for (let i = 0; i < vezes; i++) {
      window.scrollTo(0, document.body.scrollHeight || document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 800));
    }
  }

  /**
   * Cria e exibe a barra/botão flutuante na tela do Facebook
   */
  function injetarBotaoFlutuanteFacebook() {
    if (document.getElementById('resetfit-fb-floating-container')) return;

    // Só exibe se estiver em uma página de grupo
    if (!window.location.href.includes('/groups/')) return;

    const container = document.createElement('div');
    container.id = 'resetfit-fb-floating-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    container.innerHTML = `
      <button id="btn-resetfit-fb-extrair" type="button" style="
        background: linear-gradient(135deg, #1D4ED8 0%, #4338CA 50%, #6D28D9 100%);
        color: #FFFFFF;
        border: 2px solid rgba(255, 255, 255, 0.3);
        padding: 12px 18px;
        border-radius: 9999px;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 10px 25px -3px rgba(29, 78, 216, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.2s ease-in-out;
      ">
        <span style="font-size: 16px;">⚡</span>
        <span>Extrair Membros (Litrão do Reset)</span>
      </button>
    `;

    document.body.appendChild(container);

    const btn = document.getElementById('btn-resetfit-fb-extrair');
    if (btn) {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
      });
      btn.addEventListener('click', () => {
        abrirModalExtracaoFacebook();
      });
    }
  }

  /**
   * Abre o modal flutuante de extração na tela do Facebook
   */
  function abrirModalExtracaoFacebook() {
    let modal = document.getElementById('resetfit-fb-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'resetfit-fb-modal';
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      `;
      document.body.appendChild(modal);
    }

    const membros = extrairMembrosDoDom();
    const nomeGrupo = obterNomeGrupoFacebook();
    const adminsCount = membros.filter(m => m.cargo === 'admin').length;

    modal.innerHTML = `
      <div style="
        background: #FFFFFF;
        width: 100%;
        max-width: 520px;
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
        overflow: hidden;
        border: 1px solid #E2E8F0;
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        animation: resetfitFadeIn 0.2s ease-out;
      ">
        <!-- HEADER -->
        <div style="
          background: linear-gradient(135deg, #1E293B, #0F172A);
          color: white;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #3B82F6;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #2563EB; display: flex; align-items: center; justify-content: center; font-size: 18px;">
              ⚡
            </div>
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 800;">Extrator Facebook • Litrão do Reset</h3>
              <p style="margin: 2px 0 0; font-size: 11px; color: #94A3B8;">${nomeGrupo}</p>
            </div>
          </div>
          <button id="btn-fechar-modal-fb" style="
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">✕</button>
        </div>

        <!-- CORPO -->
        <div style="padding: 18px 20px; overflow-y: auto; flex: 1;">
          <!-- CARD DE MÉTRICAS -->
          <div style="
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 16px;
            padding: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
          ">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Membros Identificados</div>
              <div id="fb-contador-modal" style="font-size: 24px; font-weight: 900; color: #0F172A; margin-top: 2px;">
                ${membros.length} <span style="font-size: 12px; font-weight: 600; color: #64748B;">contatos (${adminsCount} Admins)</span>
              </div>
            </div>
            <button id="btn-rolar-mais-fb" style="
              background: #EEF2FF;
              color: #4338CA;
              border: 1px solid #C7D2FE;
              padding: 8px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
            ">🔄 Rolar e Buscar Mais</button>
          </div>

          <!-- AVISO SE TIVER POUCOS MEMBROS -->
          ${membros.length < 5 ? `
            <div style="background: #FEF3C7; border: 1px solid #FDE68A; color: #92400E; padding: 10px 14px; border-radius: 12px; font-size: 11px; margin-bottom: 12px; line-height: 1.4;">
              💡 <b>Dica:</b> Você está na aba <b>"Pessoas"</b> do grupo? Se não estiver, clique em <b>"Pessoas"</b> na tela do Facebook para que todos os membros apareçam!
            </div>
          ` : ''}

          <!-- LISTA PRÉVIA DOS CONTATOS -->
          <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px;">
            Contatos Prontos para Sincronizar:
          </div>
          <div id="fb-lista-membros-preview" style="max-height: 180px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 14px; padding: 6px; background: #FFFFFF;">
            ${renderizarListaPreviewMembros(membros)}
          </div>
        </div>

        <!-- FOOTER COM BOTÕES DE AÇÃO -->
        <div style="
          padding: 14px 20px;
          background: #F8FAFC;
          border-top: 1px solid #E2E8F0;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        ">
          <button id="btn-sincronizar-fb-painel" style="
            flex: 1;
            background: linear-gradient(135deg, #16A34A 0%, #059669 100%);
            color: #FFFFFF;
            border: none;
            padding: 12px 18px;
            border-radius: 14px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          ">
            <span>🚀 Sincronizar com o Painel do Litrão</span>
          </button>
          <button id="btn-copiar-fb-json" style="
            background: #FFFFFF;
            color: #1E293B;
            border: 1px solid #CBD5E1;
            padding: 12px 14px;
            border-radius: 14px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          ">📋 Copiar</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Eventos dos botões do modal
    document.getElementById('btn-fechar-modal-fb')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    document.getElementById('btn-rolar-mais-fb')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-rolar-mais-fb');
      if (btn) btn.innerText = '⏳ Rolando página...';
      await rolarParaCarregarMais(4);
      const novos = extrairMembrosDoDom();
      const adm = novos.filter(m => m.cargo === 'admin').length;
      const elCont = document.getElementById('fb-contador-modal');
      if (elCont) elCont.innerHTML = `${novos.length} <span style="font-size: 12px; font-weight: 600; color: #64748B;">contatos (${adm} Admins)</span>`;
      const elList = document.getElementById('fb-lista-membros-preview');
      if (elList) elList.innerHTML = renderizarListaPreviewMembros(novos);
      if (btn) btn.innerText = '🔄 Rolar e Buscar Mais';
    });

    document.getElementById('btn-sincronizar-fb-painel')?.addEventListener('click', () => {
      sincronizarComPainelLitrao();
    });

    document.getElementById('btn-copiar-fb-json')?.addEventListener('click', () => {
      copiarDadosParaClipboard();
    });
  }

  function renderizarListaPreviewMembros(membros) {
    if (!membros || membros.length === 0) {
      return '<div style="padding: 14px; text-align: center; color: #94A3B8; font-size: 11px;">Nenhum membro detectado ainda. Clique em "Rolar e Buscar Mais"!</div>';
    }

    return membros.map(m => `
      <div style="
        padding: 6px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #F1F5F9;
        font-size: 11px;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #2563EB;
            color: #FFFFFF;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
          ">
            ${m.nome.charAt(0).toUpperCase()}
          </div>
          <span style="font-weight: 700; color: #1E293B;">${m.nome}</span>
        </div>
        <div>
          ${m.cargo === 'admin'
            ? '<span style="background: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 6px; font-size: 9px; font-weight: 800;">👑 Admin</span>'
            : '<span style="background: #F1F5F9; color: #475569; padding: 2px 6px; border-radius: 6px; font-size: 9px; font-weight: 600;">Membro</span>'
          }
        </div>
      </div>
    `).join('');
  }

  /**
   * Sincroniza os contatos com o Painel do Litrão do Reset
   */
  function sincronizarComPainelLitrao() {
    const membros = leadsExtraidosCache.length > 0 ? leadsExtraidosCache : extrairMembrosDoDom();
    const nomeGrupo = obterNomeGrupoFacebook();

    if (membros.length === 0) {
      alert('Nenhum membro identificado para sincronizar.');
      return;
    }

    const pacote = {
      tipo: 'RESETFIT_SINCRONIZAR_FACEBOOK',
      grupo: nomeGrupo,
      total: membros.length,
      data: new Date().toISOString(),
      leads: membros
    };

    // 1. Salva no chrome.storage.local para sincronização com o painel
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ resetfit_fb_pending_import: pacote }, () => {
        console.log('[ResetFIT Facebook] Pacote gravado em storage local.');
      });

      // Dispara mensagem em tempo real para abas abertas
      try {
        chrome.runtime.sendMessage({
          tipo: 'RESETFIT_SINCRONIZAR_FACEBOOK',
          pacote: pacote
        });
      } catch (_) {}
    }

    // 2. Também copia para a área de transferência como backup
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(JSON.stringify(membros, null, 2));
      }
    } catch (_) {}

    // Feedback visual de sucesso no botão
    const btn = document.getElementById('btn-sincronizar-fb-painel');
    if (btn) {
      btn.style.background = '#047857';
      btn.innerHTML = '<span>✅ Sincronizado com Sucesso!</span>';
    }

    alert(`🎉 SUCESSO!\n\n${membros.length} membros do grupo "${nomeGrupo}" foram enviados para o seu Painel do Litrão do Reset!\n\nAgora basta abrir a aba do Litrão do Reset.`);
  }

  function copiarDadosParaClipboard() {
    const membros = leadsExtraidosCache.length > 0 ? leadsExtraidosCache : extrairMembrosDoDom();
    if (membros.length === 0) {
      alert('Nenhum membro para copiar.');
      return;
    }

    const json = JSON.stringify(membros, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(() => {
        alert(`✅ ${membros.length} membros copiados para a área de transferência!`);
      });
    } else {
      prompt('Copie os dados:', json);
    }
  }

  // Observa mudanças de URL no Facebook (SPA)
  let ultimaUrl = location.href;
  setInterval(() => {
    if (location.href !== ultimaUrl) {
      ultimaUrl = location.href;
      injetarBotaoFlutuanteFacebook();
    }
  }, 1000);

  // Inicialização
  injetarBotaoFlutuanteFacebook();
  setTimeout(injetarBotaoFlutuanteFacebook, 2000);
})();
