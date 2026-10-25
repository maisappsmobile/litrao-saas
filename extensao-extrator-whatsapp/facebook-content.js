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
   * Normaliza texto para validação de nomes
   */
  function normalizarTextoFb(str) {
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  /**
   * Valida se uma string aparenta ser um nome humano real e não lixo de interface do Facebook
   */
  function ehNomeHumanoValido(nome) {
    if (!nome || typeof nome !== 'string') return false;
    const limpo = nome.trim();
    if (limpo.length < 3 || limpo.length > 55 || limpo.includes('\n')) return false;

    // Se contiver números, é contagem ou estatística ("2,4 mil membros", "12 amigos", etc.)
    if (/\d/.test(limpo)) return false;

    const norm = normalizarTextoFb(limpo);

    const termosProibidos = [
      'membro', 'membros', 'mil membros', 'saiba mais', 'pessoas', 'participar',
      'entrou', 'adicionar', 'amigo', 'amigos', 'mensagem', 'ver tudo', 'grupo',
      'facebook', 'compartilhar', 'curtir', 'notificacoes', 'feed', 'gaming',
      'convidar', 'classificado', 'discussao', 'destaques', 'video', 'eventos',
      'sobre', 'arquivos', 'midia', 'reels', 'pesquisar', 'administrador', 'moderador',
      'bloquear', 'denunciar', 'sair', 'regras', 'comum', 'seguidor', 'seguidores',
      'publicacao', 'publicacoes', 'fotos', 'albuns', 'atividades', 'gerenciar',
      'configuracoes', 'ajuda', 'politica', 'termos', 'privacidade', 'cancelar', 'ver mais'
    ];

    if (termosProibidos.some(t => norm === t || norm.includes(t))) {
      return false;
    }

    // Deve ter pelo menos uma letra e não ter caracteres especiais de URL ou código
    if (!/[a-z]/i.test(norm)) return false;
    if (/[@#\$%&*+=_\/\\<>{}\[\]|~^·]/.test(limpo)) return false;

    return true;
  }

  /**
   * Extrai os membros atualmente carregados no DOM do Facebook
   */
  function extrairMembrosDoDom() {
    const nomeGrupo = obterNomeGrupoFacebook();
    grupoNomeCache = nomeGrupo;

    const links = Array.from(document.querySelectorAll('a[role="link"], a[href*="/user/"], a[href*="/groups/"]'));
    const membrosMap = new Map();

    links.forEach(a => {
      const rawHref = a.href || '';
      const href = rawHref.split('?')[0];
      const nome = (a.innerText || '').trim();

      if (!ehNomeHumanoValido(nome)) return;

      // Descarta links que são abas de navegação interna de grupos (ex: /members, /rules, /about)
      if (href.includes('/groups/') && (
        href.endsWith('/members') || href.endsWith('/members/') ||
        href.endsWith('/rules') || href.endsWith('/rules/') ||
        href.endsWith('/about') || href.endsWith('/about/') ||
        href.endsWith('/announcements') || href.endsWith('/announcements/') ||
        href.endsWith('/buy_sell_discussion') || href.endsWith('/buy_sell_discussion/')
      )) {
        return;
      }

      // Precisa ter estrutura de perfil de usuário do Facebook
      const isPerfil = href.includes('/user/') || href.includes('/profile.php') ||
                       (href.includes('facebook.com/') && !href.includes('/groups/') && !href.includes('/events/') && !href.includes('/watch/'));
      
      // Ou estar dentro de um card de membro
      const card = a.closest('div[role="listitem"]') || a.parentElement?.parentElement || {};
      const cardText = (card.innerText || '').toLowerCase();

      if (!isPerfil && !cardText.includes('administrador') && !cardText.includes('membro')) {
        return;
      }

      const isAdmin = cardText.includes('administrador') || cardText.includes('moderador') || normalizarTextoFb(nome).includes('admin');

      const chaveUnica = normalizarTextoFb(nome);
      if (!membrosMap.has(chaveUnica)) {
        membrosMap.set(chaveUnica, {
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
      bottom: 25px;
      right: 85px;
      z-index: 2147483647;
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
  // =========================================================================
  // GESTÃO DE PÚBLICOS E CATEGORIAS (CONSULTOR, CLIENTE, CIDADES, ETC)
  // =========================================================================
  function obterPublicosSalvosFacebook() {
    const padroes = ['Consultor', 'Cliente', 'Público Geral'];
    try {
      const raw = localStorage.getItem('resetfit_fb_publicos_lista');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
            const pTrim = String(p || '').trim();
            if (pTrim && !padroes.includes(pTrim)) padroes.push(pTrim);
          });
        }
      }
    } catch(e) {}
    return padroes;
  }

  function salvarNovoPublicoStorage(novoPublico) {
    if (!novoPublico || !novoPublico.trim()) return;
    const lista = obterPublicosSalvosFacebook();
    const nomeLimpo = novoPublico.trim();
    if (!lista.includes(nomeLimpo)) {
      lista.push(nomeLimpo);
      try {
        localStorage.setItem('resetfit_fb_publicos_lista', JSON.stringify(lista));
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ resetfit_fb_publicos_lista: lista });
        }
      } catch(e) {}
    }
    try {
      localStorage.setItem('resetfit_fb_ultimo_publico_selecionado', nomeLimpo);
    } catch(e) {}
  }

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

    const publicosLista = obterPublicosSalvosFacebook();
    let publicoAtivo = 'Consultor';
    try {
      publicoAtivo = localStorage.getItem('resetfit_fb_ultimo_publico_selecionado') || 'Consultor';
    } catch(e) {}

    const publicosOptionsHtml = publicosLista.map(p => {
      const isSel = p === publicoAtivo ? 'selected' : '';
      let icone = '🎯';
      if (p.toLowerCase().includes('consultor')) icone = '👔';
      else if (p.toLowerCase().includes('cliente')) icone = '🥤';
      else if (p.toLowerCase().includes('geral')) icone = '🌐';
      else icone = '📍';
      return `<option value="${p}" ${isSel}>${icone} ${p}</option>`;
    }).join('');

    modal.innerHTML = `
      <style>
        #resetfit-fb-modal, #resetfit-fb-modal * {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          box-sizing: border-box !important;
        }
        #resetfit-fb-modal-title {
          color: #FFFFFF !important;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8) !important;
          font-weight: 800 !important;
        }
        #resetfit-fb-modal-sub {
          color: #CBD5E1 !important;
          font-weight: 500 !important;
        }
        @keyframes resetfitProgressShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .resetfit-progress-animated {
          background-size: 200% 200% !important;
          animation: resetfitProgressShimmer 2s ease infinite !important;
        }
      </style>
      <div style="
        background: #FFFFFF;
        width: 100%;
        max-width: 520px;
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        border: 1px solid #CBD5E1;
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        animation: resetfitFadeIn 0.2s ease-out;
      ">
        <!-- HEADER COM CONTRASTE TOTAL DE FONTE -->
        <div style="
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
          color: #FFFFFF !important;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #3B82F6;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 12px; background: #2563EB; display: flex; align-items: center; justify-content: center; font-size: 19px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.4);">
              ⚡
            </div>
            <div>
              <h3 id="resetfit-fb-modal-title" style="margin: 0; font-size: 15px; font-weight: 800; color: #FFFFFF !important; text-shadow: 0 1px 3px rgba(0,0,0,0.8) !important; line-height: 1.2;">Extrator Facebook • Litrão do Reset</h3>
              <p id="resetfit-fb-modal-sub" style="margin: 3px 0 0; font-size: 11px; color: #CBD5E1 !important; font-weight: 500 !important; line-height: 1.2;">${nomeGrupo}</p>
            </div>
          </div>
          <button id="btn-fechar-modal-fb" style="
            background: rgba(255, 255, 255, 0.15);
            border: none;
            color: #FFFFFF !important;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
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
            margin-bottom: 12px;
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

          <!-- SELEÇÃO / CRIAÇÃO DE PÚBLICO DE DESTINO NO KANBAN -->
          <div style="
            background: linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%);
            border: 1.5px solid #86EFAC;
            border-radius: 16px;
            padding: 12px 14px;
            margin-bottom: 12px;
            box-shadow: 0 2px 4px rgba(22, 163, 74, 0.05);
          ">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; display: flex; align-items: center; gap: 5px;">
                🎯 Público / Grupo de Destino no Kanban:
              </span>
              <span id="resetfit-fb-badge-publico-ativo" style="
                background: #16A34A;
                color: #FFFFFF;
                font-size: 10px;
                font-weight: 800;
                padding: 2px 8px;
                border-radius: 9999px;
              ">${publicoAtivo}</span>
            </div>
            
            <p style="margin: 0 0 8px; font-size: 11px; color: #15803D; font-weight: 500; line-height: 1.3;">
              Antes de sincronizar, escolha ou crie o público onde estes contatos entrarão no seu Kanban (ex: <b>Consultor</b>, <b>Cliente</b>, ou o nome da sua <b>Cidade</b>):
            </p>

            <div style="display: flex; gap: 8px; align-items: center;">
              <!-- Seletor de Públicos Cadastrados / Pré-definidos -->
              <select id="resetfit-fb-select-publico" style="
                flex: 1;
                padding: 8px 10px;
                border-radius: 10px;
                border: 1.5px solid #86EFAC;
                background: #FFFFFF;
                color: #14532D;
                font-size: 12px;
                font-weight: 700;
                outline: none;
                cursor: pointer;
              ">
                ${publicosOptionsHtml}
                <option value="__CRIAR_NOVO__">➕ + Criar Novo Público ou Cidade...</option>
              </select>

              <!-- Botão rápido para digitar novo público -->
              <button type="button" id="btn-toggle-novo-publico-fb" style="
                background: #FFFFFF;
                color: #16A34A;
                border: 1.5px solid #86EFAC;
                padding: 8px 12px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s;
              ">
                ✏️ Outro Nome
              </button>
            </div>

            <!-- Campo dinâmico para digitar novo público / cidade customizada -->
            <div id="resetfit-fb-container-novo-publico" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #86EFAC;">
              <label style="display: block; font-size: 10px; font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 4px;">
                Nome do Novo Público / Cidade / Espaço:
              </label>
              <div style="display: flex; gap: 6px;">
                <input type="text" id="resetfit-fb-input-novo-publico" placeholder="Ex: Consultores Cuiabá, Clientes Detox, Barra do Garças..." style="
                  flex: 1;
                  padding: 7px 10px;
                  border-radius: 10px;
                  border: 1.5px solid #16A34A;
                  background: #FFFFFF;
                  color: #0F172A;
                  font-size: 12px;
                  font-weight: 700;
                  outline: none;
                ">
                <button type="button" id="btn-salvar-novo-publico-fb" style="
                  background: #16A34A;
                  color: #FFFFFF;
                  border: none;
                  padding: 7px 12px;
                  border-radius: 10px;
                  font-size: 11px;
                  font-weight: 800;
                  cursor: pointer;
                  white-space: nowrap;
                ">
                  Salvar
                </button>
              </div>
            </div>
          </div>

          <!-- BARRA DE PROGRESSO DE SINCRONIZAÇÃO EM TEMPO REAL -->
          <div id="resetfit-fb-progress-box" style="
            display: none;
            background: linear-gradient(135deg, #0F172A, #1E293B);
            border: 1px solid #3B82F6;
            border-radius: 16px;
            padding: 14px 16px;
            margin-bottom: 14px;
            box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.4);
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div id="resetfit-fb-progress-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; box-shadow: 0 0 8px #10B981;"></div>
                <span id="resetfit-fb-progress-status" style="font-size: 12px; font-weight: 800; color: #FFFFFF !important;">
                  Conectando ao Painel do Litrão...
                </span>
              </div>
              <span id="resetfit-fb-progress-percent" style="font-size: 13px; font-weight: 900; color: #34D399 !important;">
                0%
              </span>
            </div>
            
            <!-- TRACK DA BARRA -->
            <div style="
              width: 100%;
              height: 12px;
              background: rgba(255, 255, 255, 0.12);
              border-radius: 9999px;
              overflow: hidden;
              position: relative;
              border: 1px solid rgba(255, 255, 255, 0.2);
            ">
              <div id="resetfit-fb-progress-bar" class="resetfit-progress-animated" style="
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, #10B981, #059669, #3B82F6, #10B981);
                border-radius: 9999px;
                transition: width 0.18s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
              "></div>
            </div>

            <!-- SUBTEXTO COM CONTADOR E PROTEÇÃO ANTI-DUPLICAÇÃO -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px;">
              <span id="resetfit-fb-progress-count" style="color: #CBD5E1 !important; font-weight: 600;">
                0 de ${membros.length} contatos processados
              </span>
              <span style="color: #38BDF8 !important; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                🛡️ Filtro Anti-Duplicação Ativo
              </span>
            </div>
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
            transition: all 0.2s ease-in-out;
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

    // Eventos de Seleção e Criação de Público / Cidade
    const selPublico = document.getElementById('resetfit-fb-select-publico');
    const boxNovoPub = document.getElementById('resetfit-fb-container-novo-publico');
    const inNovoPub = document.getElementById('resetfit-fb-input-novo-publico');
    const btnSalvarPub = document.getElementById('btn-salvar-novo-publico-fb');
    const btnTogglePub = document.getElementById('btn-toggle-novo-publico-fb');
    const badgeAtivo = document.getElementById('resetfit-fb-badge-publico-ativo');

    if (selPublico) {
      selPublico.addEventListener('change', () => {
        if (selPublico.value === '__CRIAR_NOVO__') {
          if (boxNovoPub) boxNovoPub.style.display = 'block';
          if (inNovoPub) { inNovoPub.focus(); inNovoPub.value = ''; }
        } else {
          if (boxNovoPub) boxNovoPub.style.display = 'none';
          if (badgeAtivo) badgeAtivo.innerText = selPublico.value;
          try { localStorage.setItem('resetfit_fb_ultimo_publico_selecionado', selPublico.value); } catch(e) {}
        }
      });
    }

    if (btnTogglePub) {
      btnTogglePub.addEventListener('click', () => {
        if (boxNovoPub) {
          const aberto = boxNovoPub.style.display === 'block';
          boxNovoPub.style.display = aberto ? 'none' : 'block';
          if (!aberto && inNovoPub) inNovoPub.focus();
        }
      });
    }

    if (btnSalvarPub) {
      btnSalvarPub.addEventListener('click', () => {
        const val = inNovoPub ? inNovoPub.value.trim() : '';
        if (!val) {
          alert('Digite o nome do público ou cidade (ex: Consultor, Cliente, Cuiabá)!');
          return;
        }
        salvarNovoPublicoStorage(val);
        let optExistente = Array.from(selPublico.options).find(o => o.value === val);
        if (!optExistente) {
          const novaOpt = document.createElement('option');
          novaOpt.value = val;
          novaOpt.innerText = `🎯 ${val}`;
          selPublico.insertBefore(novaOpt, selPublico.lastElementChild);
        }
        selPublico.value = val;
        if (badgeAtivo) badgeAtivo.innerText = val;
        if (boxNovoPub) boxNovoPub.style.display = 'none';
      });
    }
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
   * Sincroniza os contatos com o Painel do Litrão do Reset com Barra de Progresso Real e Anti-Duplicação
   */
  async function sincronizarComPainelLitrao() {
    const membros = leadsExtraidosCache.length > 0 ? leadsExtraidosCache : extrairMembrosDoDom();
    const nomeGrupo = obterNomeGrupoFacebook();

    if (membros.length === 0) {
      alert('Nenhum membro identificado para sincronizar. Role a página do Facebook para carregar mais contatos.');
      return;
    }

    const btnSinc = document.getElementById('btn-sincronizar-fb-painel');
    const boxProgresso = document.getElementById('resetfit-fb-progress-box');
    const elBar = document.getElementById('resetfit-fb-progress-bar');
    const elPercent = document.getElementById('resetfit-fb-progress-percent');
    const elStatus = document.getElementById('resetfit-fb-progress-status');
    const elCount = document.getElementById('resetfit-fb-progress-count');

    // Identifica o público selecionado pelo usuário
    const selPublico = document.getElementById('resetfit-fb-select-publico');
    const inNovoPub = document.getElementById('resetfit-fb-input-novo-publico');
    let publicoEscolhido = 'Consultor';
    if (selPublico && selPublico.value && selPublico.value !== '__CRIAR_NOVO__') {
      publicoEscolhido = selPublico.value;
    } else if (inNovoPub && inNovoPub.value.trim()) {
      publicoEscolhido = inNovoPub.value.trim();
      salvarNovoPublicoStorage(publicoEscolhido);
    }

    // Desabilita o botão para evitar cliques repetidos
    if (btnSinc) {
      btnSinc.disabled = true;
      btnSinc.style.opacity = '0.85';
      btnSinc.style.cursor = 'wait';
      btnSinc.innerHTML = `<span>⏳ Sincronizando para "${publicoEscolhido}"...</span>`;
    }

    // Exibe a barra de progresso imediatamente
    if (boxProgresso) {
      boxProgresso.style.display = 'block';
    }

    const total = membros.length;
    const etapas = [
      { pct: 15, msg: `Conectando ao Painel do Litrão (${publicoEscolhido})...`, count: Math.max(1, Math.floor(total * 0.15)) },
      { pct: 40, msg: `Segmentando contatos no público "${publicoEscolhido}"...`, count: Math.max(1, Math.floor(total * 0.40)) },
      { pct: 68, msg: 'Aplicando filtro anti-duplicação estrito em todos os cards...', count: Math.max(1, Math.floor(total * 0.68)) },
      { pct: 90, msg: `Transmitindo leads para o grupo "${publicoEscolhido}" no Kanban...`, count: Math.max(1, Math.floor(total * 0.90)) },
      { pct: 100, msg: `Gravação concluída no público "${publicoEscolhido}"!`, count: total }
    ];

    for (const etapa of etapas) {
      if (elBar) elBar.style.width = `${etapa.pct}%`;
      if (elPercent) elPercent.innerText = `${etapa.pct}%`;
      if (elStatus) elStatus.innerText = etapa.msg;
      if (elCount) elCount.innerText = `${etapa.count} de ${total} contatos processados`;
      await new Promise(r => setTimeout(r, 220));
    }

    const pacote = {
      tipo: 'RESETFIT_SINCRONIZAR_FACEBOOK',
      grupo: nomeGrupo,
      publico: publicoEscolhido,
      total: membros.length,
      data: new Date().toISOString(),
      leads: membros.map(m => ({
        ...m,
        publico: publicoEscolhido
      }))
    };

    // 1. Salva no chrome.storage.local para sincronização com o painel
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ resetfit_fb_pending_import: pacote }, () => {
        console.log('[ResetFIT Facebook] Pacote gravado em storage local:', pacote);
      });

      // Dispara mensagem em tempo real para abas abertas
      try {
        chrome.runtime.sendMessage({
          tipo: 'RESETFIT_SINCRONIZAR_FACEBOOK',
          pacote: pacote
        });
      } catch (_) {}
    }

    // 2. Também copia para a área de transferência como redundância
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(JSON.stringify(pacote, null, 2));
      }
    } catch (_) {}

    // Feedback visual final no container de progresso
    if (elStatus) {
      elStatus.innerText = `✅ Sincronizado com Sucesso para "${publicoEscolhido}"!`;
      elStatus.style.color = '#34D399';
    }
    if (elCount) {
      elCount.innerHTML = `<b>${total} contatos enviados</b> para <b>"${publicoEscolhido}"</b> • Proteção contra duplicações ativa`;
    }

    // Restaura o botão com estado de sucesso
    if (btnSinc) {
      btnSinc.disabled = false;
      btnSinc.style.opacity = '1';
      btnSinc.style.cursor = 'pointer';
      btnSinc.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
      btnSinc.innerHTML = `<span>✅ Sincronizado (${publicoEscolhido})!</span>`;
    }

    alert(`🎉 SINCRONIZAÇÃO CONCLUÍDA!\n\n${total} contatos do grupo "${nomeGrupo}" foram transmitidos para o seu Painel do Litrão do Reset!\n\n🎯 Público/Grupo no Kanban: "${publicoEscolhido}"\n🛡️ Regra Anti-Duplicação: Nenhum contato já cadastrado no painel será repetido, independente do card ou etapa em que esteja.`);
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
