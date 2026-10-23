/**
 * ResetFIT - Automação WhatsApp Pro (Popup Controller v2.5.1)
 * Inclui: Extrator Completo, Mensagens Rápidas, Sequências, Mídias, Disparo em Massa, Respostas e Backup
 */

// Mensagens Rápidas Padrão Validadas para o ResetFIT
const MENSAGENS_PADRAO = [
  {
    id: 'msg_1',
    titulo: '🥤 Convite ResetFIT',
    texto: 'Olá {nome}, tudo bem? Passando para te apresentar o método ResetFIT! Nossa garrafa turbinada de 1 Litro que ajuda a desinchar, eliminar retenção e dá energia limpa o dia todo. Quer experimentar essa semana?'
  },
  {
    id: 'msg_2',
    titulo: '🧪 Degustação Grátis no Espaço (EVS)',
    texto: 'Oi {nome}! Gostaria de te convidar para passar no nosso Espaço Vida Saudável e degustar gratuitamente uma dose do ResetFIT! Qual dia fica melhor pra você, hoje ou amanhã?'
  },
  {
    id: 'msg_3',
    titulo: '📋 Link de Bioimpedância / Avaliação',
    texto: 'Olá {nome}! Preparei um formulário rápido de avaliação corporal gratuita para calcularmos seu metabolismo e sua meta de hidratação. Posso te enviar o link?'
  },
  {
    id: 'msg_4',
    titulo: '💰 Tabela de Preços & Pacote Semanal',
    texto: 'Oi {nome}! O nosso Kit Semanal do ResetFIT inclui 5 garrafas completas (mix de Chá Verde, Fibras e Energia). O valor da dose individual é R$ 25,00 ou o pacote semanal completo por apenas R$ 115,00! Como prefere receber?'
  },
  {
    id: 'msg_5',
    titulo: '💳 Dados para Pagamento Pix',
    texto: 'Perfeito, {nome}! Segue a nossa chave Pix para confirmação do seu pedido: {chave_pix}. Assim que fizer, me envia o comprovante que já preparo o seu kit bem geladinho!'
  }
];

let contatosExtraidos = [];
let nomeGrupoAtual = '';

document.addEventListener('DOMContentLoaded', async () => {
  if (window.self !== window.top) {
    document.body.classList.add('in-iframe');
  }
  // Controle de Abas
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Identifica a aba do WhatsApp Web (compativel com Popup, Painel Lateral e Tela Cheia)
  let tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
  let tab = tabs && tabs[0];
  if (!tab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url && activeTab.url.includes('web.whatsapp.com')) {
      tab = activeTab;
    }
  }
  const isZap = !!tab;

  // Garantir injecao do content script caso a pagina ainda nao tenha sido recarregada
  async function garantirContentScript(targetTabId) {
    if (!targetTabId) return false;
    try {
      const resp = await new Promise(resolve => {
        chrome.tabs.sendMessage(targetTabId, { action: 'verificar_status' }, res => {
          if (chrome.runtime.lastError || !res) resolve(null);
          else resolve(res);
        });
      });
      if (resp && resp.sucesso) return true;
    } catch (_) {}

    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 400));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Acoes dos Botoes de Modo (Lateral e Tela Cheia)
  const btnModoLateral = document.getElementById('btn-modo-lateral');
  const btnModoTelaCheia = document.getElementById('btn-modo-telacheia');

  if (btnModoTelaCheia) {
    btnModoTelaCheia.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });
  }

  if (btnModoLateral) {
    btnModoLateral.addEventListener('click', async () => {
      try {
        if (chrome.sidePanel && chrome.sidePanel.open) {
          const win = await chrome.windows.getCurrent();
          await chrome.sidePanel.open({ windowId: win.id });
          window.close();
        } else if (tab) {
          chrome.tabs.sendMessage(tab.id, { action: 'abrir_drawer_lateral' }, () => {
            if (chrome.runtime.lastError) { /* consome erro */ }
          });
          window.close();
        }
      } catch (_) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { action: 'abrir_drawer_lateral' }, () => {
            if (chrome.runtime.lastError) { /* consome erro */ }
          });
          window.close();
        }
      }
    });
  }

  const dotStatus = document.getElementById('dot-status');
  const txtStatus = document.getElementById('txt-status');
  const isFb = tab && tab.url && tab.url.includes('facebook.com');

  if (isFb) {
    dotStatus.style.background = '#38BDF8';
    dotStatus.style.boxShadow = '0 0 8px #38BDF8';
    txtStatus.innerText = 'Facebook Conectado';
    txtStatus.style.color = '#38BDF8';
  } else if (!isZap) {
    dotStatus.style.background = '#EF4444';
    dotStatus.style.boxShadow = 'none';
    txtStatus.innerText = 'Abra o WhatsApp ou Facebook';
    txtStatus.style.color = '#EF4444';
  }

  // ==========================================
  // 1. MÓDULO EXTRATOR DE GRUPOS (PRINT 4)
  // ==========================================
  const selectGrupos = document.getElementById('select-grupos-whatsapp');
  const btnRecarregarGrupos = document.getElementById('btn-recarregar-grupos');
  const btnFiltroTodos = document.getElementById('btn-filtro-todos');
  const btnFiltroGrupos = document.getElementById('btn-filtro-grupos');
  const btnFiltroContatos = document.getElementById('btn-filtro-contatos');
  const btnExtrair = document.getElementById('btn-extrair');
  const progressoExtracao = document.getElementById('progresso-extracao');
  const progressoFill = document.getElementById('progresso-fill');
  const progressoTxt = document.getElementById('progresso-txt');
  const resultBoxExtrator = document.getElementById('result-box-extrator');
  const totalExtraidos = document.getElementById('total-extraidos');
  const totalComTel = document.getElementById('total-com-tel');
  const btnSincronizarCrm = document.getElementById('btn-sincronizar-crm');
  const btnBaixarJson = document.getElementById('btn-baixar-json');
  const btnBaixarCsv = document.getElementById('btn-baixar-csv');

  let cacheConversas = [];
  let cacheGrupoAberto = '';
  let filtroConversasAtual = 'todos'; // 'todos' | 'grupos' | 'contatos'

  function atualizarBotoesFiltro() {
    if (!btnFiltroTodos || !btnFiltroGrupos || !btnFiltroContatos) return;
    const btns = [
      { el: btnFiltroTodos, tipo: 'todos' },
      { el: btnFiltroGrupos, tipo: 'grupos' },
      { el: btnFiltroContatos, tipo: 'contatos' }
    ];
    btns.forEach(b => {
      if (b.tipo === filtroConversasAtual) {
        b.el.style.background = '#10B981';
        b.el.style.color = '#FFFFFF';
        b.el.style.fontWeight = 'bold';
        b.el.style.borderColor = '#10B981';
      } else {
        b.el.style.background = '#1E293B';
        b.el.style.color = '#94A3B8';
        b.el.style.fontWeight = 'normal';
        b.el.style.borderColor = '#334155';
      }
    });
  }

  function renderizarSelectConversas() {
    selectGrupos.innerHTML = '';

    // Opção 1: Conversa / Grupo atualmente aberta na tela
    const optAtual = document.createElement('option');
    optAtual.value = '__ATUAL__';
    optAtual.textContent = cacheGrupoAberto ? `⚡ Aberto agora: ${cacheGrupoAberto}` : '⚡ Conversa aberta na tela';
    selectGrupos.appendChild(optAtual);

    const grupos = cacheConversas.filter(c => c.isGrupo && c.nome !== cacheGrupoAberto);
    const contatos = cacheConversas.filter(c => !c.isGrupo && c.nome !== cacheGrupoAberto);

    // Adiciona Grupos
    if ((filtroConversasAtual === 'todos' || filtroConversasAtual === 'grupos') && grupos.length > 0) {
      const optgroupGrupos = document.createElement('optgroup');
      optgroupGrupos.label = `👥 Grupos do WhatsApp (${grupos.length})`;
      grupos.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nome;
        opt.textContent = `👥 ${c.nome}`;
        optgroupGrupos.appendChild(opt);
      });
      selectGrupos.appendChild(optgroupGrupos);
    }

    // Adiciona Contatos Individuais
    if ((filtroConversasAtual === 'todos' || filtroConversasAtual === 'contatos') && contatos.length > 0) {
      const optgroupContatos = document.createElement('optgroup');
      optgroupContatos.label = `👤 Contatos Individuais (${contatos.length})`;
      contatos.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nome;
        opt.textContent = `👤 ${c.nome}`;
        optgroupContatos.appendChild(opt);
      });
      selectGrupos.appendChild(optgroupContatos);
    }
  }

  function carregarGrupos() {
    if (!isZap) return;
    chrome.tabs.sendMessage(tab.id, { action: 'listar_conversas' }, (res) => {
      if (chrome.runtime.lastError) {
        // Consome erro para o Chrome não registrar como erro não tratado
        const _e = chrome.runtime.lastError.message;
        return;
      }
      if (!res || !res.sucesso) return;
      cacheConversas = res.conversas || [];
      cacheGrupoAberto = (res.infoAtual && res.infoAtual.nomeGrupo) ? res.infoAtual.nomeGrupo : '';
      nomeGrupoAtual = cacheGrupoAberto || 'Grupo Selecionado';
      renderizarSelectConversas();
      atualizarBotoesFiltro();
    });
  }

  if (btnFiltroTodos) {
    btnFiltroTodos.addEventListener('click', () => {
      filtroConversasAtual = 'todos';
      atualizarBotoesFiltro();
      renderizarSelectConversas();
    });
  }

  if (btnFiltroGrupos) {
    btnFiltroGrupos.addEventListener('click', () => {
      filtroConversasAtual = 'grupos';
      atualizarBotoesFiltro();
      renderizarSelectConversas();
    });
  }

  if (btnFiltroContatos) {
    btnFiltroContatos.addEventListener('click', () => {
      filtroConversasAtual = 'contatos';
      atualizarBotoesFiltro();
      renderizarSelectConversas();
    });
  }

  let ehExtracaoFacebook = false;

  if (isZap) {
    carregarGrupos();
  } else if (isFb) {
    let nomeLimpo = (tab.title || 'Grupo Facebook').replace(/\s*\|\s*Facebook\s*$/i, '').trim();
    nomeGrupoAtual = nomeLimpo;
    if (selectGrupos) {
      selectGrupos.innerHTML = `<option value="${nomeLimpo}" selected>📘 Facebook: ${nomeLimpo}</option>`;
    }
  }

  btnRecarregarGrupos.addEventListener('click', () => {
    if (isZap) carregarGrupos();
    else if (isFb) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
        if (t) {
          let nomeLimpo = (t.title || 'Grupo Facebook').replace(/\s*\|\s*Facebook\s*$/i, '').trim();
          nomeGrupoAtual = nomeLimpo;
          if (selectGrupos) selectGrupos.innerHTML = `<option value="${nomeLimpo}" selected>📘 Facebook: ${nomeLimpo}</option>`;
        }
      });
    }
  });

  selectGrupos.addEventListener('change', () => {
    const val = selectGrupos.value;
    if (val && val !== '__ATUAL__' && isZap) {
      chrome.tabs.sendMessage(tab.id, { action: 'abrir_conversa', nome: val }, () => {
        if (chrome.runtime.lastError) {
          const _e = chrome.runtime.lastError.message;
          return;
        }
        nomeGrupoAtual = val;
      });
    }
  });

  async function executarExtracaoFacebookDireta() {
    ehExtracaoFacebook = true;
    btnExtrair.disabled = true;
    btnExtrair.innerText = '⏳ Rolando página do Facebook...';
    progressoExtracao.style.display = 'block';
    progressoFill.style.width = '30%';
    progressoTxt.innerText = 'Rolando membros no Facebook...';

    const [tabAtiva] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabAtiva || !tabAtiva.id) {
      alert('Erro: aba do Facebook não encontrada.');
      btnExtrair.disabled = false;
      btnExtrair.innerText = '⚡ Extrair Todos os Contatos';
      progressoExtracao.style.display = 'none';
      return;
    }

    try {
      // 1. Rola a página 3 vezes para carregar mais membros
      for (let r = 0; r < 3; r++) {
        await chrome.scripting.executeScript({
          target: { tabId: tabAtiva.id },
          func: () => { window.scrollBy(0, 1500); }
        });
        progressoFill.style.width = (40 + r * 15) + '%';
        await new Promise(res => setTimeout(res, 600));
      }

      progressoTxt.innerText = 'Identificando membros e cargos...';
      progressoFill.style.width = '85%';

      // 2. Extrai membros do DOM do Facebook
      const resultado = await chrome.scripting.executeScript({
        target: { tabId: tabAtiva.id },
        func: () => {
          const h1 = document.querySelector('h1');
          let nomeGrupo = (h1 && h1.innerText && h1.innerText.trim()) ? h1.innerText.trim() : (document.title || '').replace(/\s*\|\s*Facebook\s*$/i, '').trim();
          if (!nomeGrupo) nomeGrupo = 'Grupo Facebook Herbalife';

          const links = Array.from(document.querySelectorAll('a[role="link"], a[href*="/user/"], a[href*="/groups/"]'));
          const membrosMap = new Map();
          const termosIgnorar = [
            'adicionar', 'mensagem', 'ver tudo', 'amigo', 'grupo', 'facebook',
            'compartilhar', 'curtir', 'notificações', 'feed', 'gaming', 'convidar',
            'classificado', 'discussão', 'destaques', 'vídeo', 'eventos', 'sobre',
            'membros', 'pessoas', 'arquivos'
          ];

          links.forEach(a => {
            const href = (a.href || '').split('?')[0];
            const nome = (a.innerText || '').trim();
            if (!href || nome.length < 3 || nome.length > 50 || nome.includes('\n')) return;
            const low = nome.toLowerCase();
            if (termosIgnorar.some(t => low.includes(t))) return;

            const isPerfil = href.includes('/user/') || href.includes('/profile.php') ||
                             (href.includes('facebook.com/') && !href.includes('/groups/'));
            const card = a.closest('div[role="listitem"]') || a.parentElement?.parentElement || {};
            const cardText = (card.innerText || '').toLowerCase();

            if (!isPerfil && !cardText.includes('administrador') && !cardText.includes('membro')) return;

            const isAdmin = cardText.includes('administrador') || cardText.includes('moderador') || low.includes('admin');

            if (!membrosMap.has(nome)) {
              membrosMap.set(nome, {
                nome: nome,
                telefone: '',
                perfilUrl: isPerfil ? href : `https://www.facebook.com/search/people/?q=${encodeURIComponent(nome)}`,
                cargo: isAdmin ? 'admin' : 'membro',
                grupoOrigem: nomeGrupo,
                grupo: nomeGrupo
              });
            }
          });

          return {
            nomeGrupo: nomeGrupo,
            membros: Array.from(membrosMap.values())
          };
        }
      });

      const res = (resultado && resultado[0] && resultado[0].result) ? resultado[0].result : { nomeGrupo: 'Grupo Facebook', membros: [] };
      contatosExtraidos = res.membros || [];
      nomeGrupoAtual = res.nomeGrupo || 'HERBALIFE BRASIL';

      btnExtrair.disabled = false;
      btnExtrair.innerText = '⚡ Extrair Novamente';
      progressoExtracao.style.display = 'none';

      const admCount = contatosExtraidos.filter(c => c.cargo === 'admin').length;
      totalExtraidos.innerText = contatosExtraidos.length;
      totalComTel.innerText = `${admCount} Admins`;

      resultBoxExtrator.style.display = 'block';

      if (btnSincronizarCrm) {
        btnSincronizarCrm.innerHTML = '🚀 Sincronizar com Meus Leads no Litrão do Reset';
      }

      alert(`✅ SUCESSO!\n\n${contatosExtraidos.length} membros extraídos do grupo "${nomeGrupoAtual}" (${admCount} Administradores)!\n\nClique no botão verde "Sincronizar" abaixo para enviar ao seu Painel.`);
    } catch (err) {
      btnExtrair.disabled = false;
      btnExtrair.innerText = '⚡ Extrair Todos os Contatos';
      progressoExtracao.style.display = 'none';
      alert('Erro ao extrair da aba do Facebook: ' + err.message);
    }
  }

  btnExtrair.addEventListener('click', async () => {
    if (!tab) {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = t;
    }

    if (tab && tab.url && tab.url.includes('facebook.com')) {
      await executarExtracaoFacebookDireta();
      return;
    }

    if (tab) await garantirContentScript(tab.id);
    if (!isZap) {
      alert('Abra o WhatsApp Web ou o Facebook no navegador para extrair os membros!');
      return;
    }

    ehExtracaoFacebook = false;
    btnExtrair.disabled = true;
    btnExtrair.innerText = '⏳ Rolando lista de participantes...';
    progressoExtracao.style.display = 'block';
    progressoFill.style.width = '20%';

    chrome.tabs.sendMessage(tab.id, { action: 'extrair_contatos', nomeGrupo: selectGrupos.value }, (res) => {
      btnExtrair.disabled = false;
      btnExtrair.innerText = '⚡ Extrair Novamente';
      progressoExtracao.style.display = 'none';

      if (chrome.runtime.lastError) {
        const _e = chrome.runtime.lastError.message;
        alert('Aviso: Atualize a página do WhatsApp (F5) para restabelecer a conexão e tente extrair novamente.');
        return;
      }

      if (!res || !res.sucesso) {
        alert('Erro ao extrair contatos: ' + ((res && res.erro) || 'Verifique se o grupo está aberto.'));
        return;
      }

      contatosExtraidos = res.contatos || res.leads || [];
      nomeGrupoAtual = res.nomeGrupo || nomeGrupoAtual || 'Grupo WhatsApp';

      const comTel = contatosExtraidos.filter(c => c.telefone && c.telefone.length >= 8);
      totalExtraidos.innerText = contatosExtraidos.length;
      totalComTel.innerText = comTel.length;
      resultBoxExtrator.style.display = 'block';
    });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'progresso_extracao') {
      progressoFill.style.width = Math.min(95, Math.max(20, msg.contagem * 2)) + '%';
      progressoTxt.innerText = `${msg.contagem} participantes encontrados...`;
    }
  });

  // Sincronizar com o CRM ResetFIT Automaticamente
  btnSincronizarCrm.addEventListener('click', async () => {
    if (contatosExtraidos.length === 0) {
      alert('Nenhum contato extraído para sincronizar. Selecione e extraia os contatos de um grupo primeiro.');
      return;
    }

    if (ehExtracaoFacebook) {
      btnSincronizarCrm.disabled = true;
      btnSincronizarCrm.innerText = '⏳ Sincronizando com Litrão do Reset...';

      const pacoteFb = {
        origem: 'ResetFIT Pro v2.6.0',
        tipo: 'RESETFIT_SINCRONIZAR_FACEBOOK',
        grupo: nomeGrupoAtual || 'Grupo Facebook',
        total: contatosExtraidos.length,
        leads: contatosExtraidos,
        data: new Date().toISOString()
      };

      try {
        await chrome.storage.local.set({
          resetfit_fb_pending_import: pacoteFb
        });

        // Tenta enviar mensagem para abas do painel
        const todasAbas = await chrome.tabs.query({});
        for (const tabP of todasAbas) {
          if (!tabP.url) continue;
          const u = tabP.url.toLowerCase();
          if (u.includes('painel.html') || u.includes('litraodoreset.com.br') || u.includes('vercel.app') || u.includes('localhost') || u.includes('127.0.0.1')) {
            try {
              chrome.tabs.sendMessage(tabP.id, { tipo: 'RESETFIT_SINCRONIZAR_FACEBOOK', pacote: pacoteFb });
            } catch(e) {}
          }
        }

        btnSincronizarCrm.disabled = false;
        btnSincronizarCrm.innerText = '✅ Sincronizado no Litrão do Reset!';
        btnSincronizarCrm.style.background = '#047857';
        alert(`🎉 SUCESSO!\n\n${contatosExtraidos.length} membros do grupo "${nomeGrupoAtual}" foram enviados para o Litrão do Reset!\n\nAbra o seu painel para ver a lista atualizada.`);
        return;
      } catch(errFb) {
        btnSincronizarCrm.disabled = false;
        btnSincronizarCrm.innerText = '🚀 Sincronizar Novamente';
        alert('Erro ao sincronizar: ' + errFb.message);
        return;
      }
    }

    btnSincronizarCrm.disabled = true;
    btnSincronizarCrm.innerText = '⏳ Sincronizando com CRM...';

    const pacote = {
      origem: 'ResetFIT Pro v2.6.0',
      grupo: nomeGrupoAtual || 'Grupo WhatsApp',
      criadoEm: new Date().toISOString(),
      timestamp: Date.now(),
      total: contatosExtraidos.length,
      contatos: contatosExtraidos
    };

    try {
      // 1. Grava no storage da extensão para quando o painel for aberto depois
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          resetfit_crm_pending_import: pacote,
          resetfit_ultimo_lote: pacote
        });
      }

      // 2. Procura abas abertas que contenham o Painel do Consultor
      let abasPainelEncontradas = [];
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        try {
          const todasAbas = await chrome.tabs.query({});
          abasPainelEncontradas = todasAbas.filter(tab => {
            if (!tab.url) return false;
            const u = tab.url.toLowerCase();
            return u.includes('painel.html') ||
                   u.includes('litraodoreset.com.br') ||
                   u.includes('vercel.app') ||
                   u.includes('localhost') ||
                   u.includes('127.0.0.1');
          });
        } catch (errTabs) {
          console.warn('Erro ao consultar abas abertas:', errTabs);
        }
      }

      let sincronizadoEmTempoReal = false;
      let totalImportadosRealTime = 0;

      // 3. Se houver aba aberta do painel, injeta e sincroniza em tempo real
      if (abasPainelEncontradas.length > 0 && typeof chrome !== 'undefined' && chrome.scripting) {
        for (const tab of abasPainelEncontradas) {
          try {
            // Tenta enviar mensagem direta via runtime
            try {
              chrome.tabs.sendMessage(tab.id, { tipo: 'RESETFIT_SINCRONIZAR_CRM', pacote });
            } catch (eMsg) {}

            // Injeta script diretamente no contexto da página do painel
            const resultados = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              args: [pacote],
              func: (dados) => {
                try {
                  let hid = 'geral';
                  try {
                    const authStr = localStorage.getItem('litrao_consultor_auth');
                    if (authStr) {
                      const parsed = JSON.parse(authStr);
                      if (parsed && parsed.herbalife_id) hid = String(parsed.herbalife_id).trim();
                    }
                  } catch (eAuth) {}

                  const key = `litrao_crm_leads_${hid}`;
                  let leadsExistentes = [];
                  try {
                    leadsExistentes = JSON.parse(localStorage.getItem(key)) || [];
                    if (!Array.isArray(leadsExistentes)) leadsExistentes = [];
                  } catch (eLeads) {
                    leadsExistentes = [];
                  }

                  const telefonesSet = new Set(
                    leadsExistentes.map(l => String(l.telefone || '').replace(/\D/g, '')).filter(Boolean)
                  );
                  let novosCount = 0;
                  let dupCount = 0;

                  (dados.contatos || []).forEach((c, idx) => {
                    const telRaw = String(c.telefone || c.numero || '').trim();
                    const telLimpo = telRaw.replace(/\D/g, '');
                    if (!telLimpo) return;

                    if (telefonesSet.has(telLimpo)) {
                      dupCount++;
                      return;
                    }

                    const nomeFormatado = (c.nome || c.pushname || `Contato ${idx + 1}`).replace(/~/g, '').trim();
                    leadsExistentes.push({
                      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                      nome: nomeFormatado,
                      telefone: telRaw,
                      grupo: c.grupo || dados.grupo || 'Grupo WhatsApp',
                      isAdmin: !!(c.isAdmin || c.admin),
                      coluna: 'novos',
                      dataAdicionado: new Date().toISOString(),
                      notas: c.notas || ''
                    });
                    telefonesSet.add(telLimpo);
                    novosCount++;
                  });

                  localStorage.setItem(key, JSON.stringify(leadsExistentes));

                  // Atualiza UI se funções nativas do painel existirem
                  if (typeof window.atualizarSelectGruposKanban === 'function') window.atualizarSelectGruposKanban();
                  if (typeof window.renderizarKanbanCrm === 'function') window.renderizarKanbanCrm();
                  if (typeof window.atualizarMetricasCardsCrm === 'function') window.atualizarMetricasCardsCrm();

                  // Exibe notificação visual Toast flutuante no painel
                  let toast = document.getElementById('toast-resetfit-crm-sync');
                  if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'toast-resetfit-crm-sync';
                    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:linear-gradient(135deg, #6B21A8, #3730A3);color:#fff;padding:14px 18px;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);border:1px solid rgba(168,85,247,0.4);display:flex;align-items:center;gap:12px;font-family:ui-sans-serif,system-ui,sans-serif;max-width:380px;';
                    document.body.appendChild(toast);
                  }
                  toast.innerHTML = `
                    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
                      🚀
                    </div>
                    <div style="flex:1;">
                      <h4 style="margin:0;font-size:13px;font-weight:800;color:#fff;">ResetFIT • CRM Sincronizado!</h4>
                      <p style="margin:2px 0 0;font-size:11px;color:#E9D5FF;line-height:1.35;">
                        <b>${novosCount} contatos</b> do grupo <b>"${dados.grupo}"</b> adicionados na coluna <b>Novos Contatos</b>!
                      </p>
                    </div>
                  `;
                  toast.style.display = 'flex';
                  setTimeout(() => {
                    if (toast) toast.style.display = 'none';
                  }, 6500);

                  return { sucesso: true, novos: novosCount, duplicados: dupCount };
                } catch (errInjecao) {
                  return { sucesso: false, erro: errInjecao.message };
                }
              }
            });

            if (resultados && resultados[0] && resultados[0].result && resultados[0].result.sucesso) {
              sincronizadoEmTempoReal = true;
              totalImportadosRealTime += (resultados[0].result.novos || 0);
              // Como já injetou na página aberta, limpa pendência do storage
              chrome.storage.local.remove(['resetfit_crm_pending_import']);
            }
          } catch (errExec) {
            console.warn('Erro ao sincronizar na aba:', errExec);
          }
        }
      }

      btnSincronizarCrm.innerText = '✅ Sincronizado no CRM!';
      setTimeout(() => {
        btnSincronizarCrm.disabled = false;
        btnSincronizarCrm.innerText = '🚀 Sincronizar com Meu CRM ResetFIT';
      }, 3000);

      if (sincronizadoEmTempoReal) {
        alert(
          `🚀 Sucesso Total!\n\n` +
          `• Contatos extraídos: ${contatosExtraidos.length}\n` +
          `• Novos contatos inseridos no CRM: ${totalImportadosRealTime}\n` +
          `• Grupo de Origem: "${nomeGrupoAtual}"\n\n` +
          `O seu Painel do Consultor ResetFIT foi atualizado em TEMPO REAL na coluna 'Novos Contatos'!`
        );
      } else {
        alert(
          `💾 Contatos Salvos com Sucesso!\n\n` +
          `• Total de contatos preparados: ${contatosExtraidos.length}\n` +
          `• Grupo de Origem: "${nomeGrupoAtual}"\n\n` +
          `Assim que você abrir o seu Painel do Consultor ResetFIT, esses contatos serão adicionados AUTOMATICAMENTE ao seu CRM Kanban na coluna 'Novos Contatos' sem precisar baixar nem importar arquivos!`
        );
      }
    } catch (errGeral) {
      console.error('Erro na sincronização:', errGeral);
      btnSincronizarCrm.disabled = false;
      btnSincronizarCrm.innerText = '❌ Erro ao Sincronizar';
      setTimeout(() => { btnSincronizarCrm.innerText = '🚀 Sincronizar com Meu CRM ResetFIT'; }, 3000);
      alert('Houve um erro ao sincronizar com o CRM: ' + (errGeral.message || errGeral));
    }
  });

  btnBaixarJson.addEventListener('click', () => {
    if (contatosExtraidos.length === 0) return;
    const pacote = { grupo: nomeGrupoAtual, total: contatosExtraidos.length, leads: contatosExtraidos, contatos: contatosExtraidos, membros: contatosExtraidos };
    const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnBaixarCsv.addEventListener('click', () => {
    if (contatosExtraidos.length === 0) return;
    let csv = 'Nome;Telefone;Grupo;Admin\n';
    contatosExtraidos.forEach(c => {
      csv += `"${(c.nome || '').replace(/"/g, '""')}";"${c.telefone || ''}";"${c.grupo || nomeGrupoAtual}";"${c.isAdmin ? 'SIM' : 'NÃO'}"\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ==========================================
  // 2. MENSAGENS RÁPIDAS (1 CLIQUE)
  // ==========================================
  const listaMensagensEl = document.getElementById('lista-mensagens-rapidas');
  const btnNovaMsg = document.getElementById('btn-nova-msg-rapida');
  // ==========================================
  // UTILITÁRIO: LEITURA DE ARQUIVOS DE MÍDIA
  // ==========================================
  function lerArquivoComoBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Nenhum arquivo fornecido.'));
      const reader = new FileReader();
      reader.onload = () => {
        let tipo = 'outro';
        if (file.type.startsWith('image/')) tipo = 'imagem';
        else if (file.type.startsWith('video/')) tipo = 'video';
        else if (file.type.startsWith('audio/')) tipo = 'audio';

        resolve({
          base64: reader.result,
          mimeType: file.type || 'image/jpeg',
          nome: file.name,
          tamanho: file.size,
          tipo: tipo
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  const formMsg = document.getElementById('form-msg-rapida');
  const btnSalvarMsg = document.getElementById('btn-salvar-msg-rapida');
  const btnCancelarMsg = document.getElementById('btn-cancelar-msg-rapida');
  const inputMsgTitulo = document.getElementById('input-msg-titulo');
  const inputMsgTexto = document.getElementById('input-msg-texto');
  const btnMsgMidia = document.getElementById('btn-msg-midia');
  const inputMsgMidia = document.getElementById('input-msg-midia');
  const previewMsgMidiaBox = document.getElementById('preview-msg-midia-box');
  const txtMsgMidiaNome = document.getElementById('txt-msg-midia-nome');
  const btnRemoverMsgMidia = document.getElementById('btn-remover-msg-midia');

  let midiaMsgRapidaTemp = null;

  if (btnMsgMidia && inputMsgMidia) {
    btnMsgMidia.addEventListener('click', () => inputMsgMidia.click());
    inputMsgMidia.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        btnMsgMidia.innerText = '⏳ Carregando...';
        midiaMsgRapidaTemp = await lerArquivoComoBase64(file);
        if (txtMsgMidiaNome) txtMsgMidiaNome.innerText = `${midiaMsgRapidaTemp.tipo === 'video' ? '🎥' : '📷'} ${file.name}`;
        if (previewMsgMidiaBox) previewMsgMidiaBox.style.display = 'flex';
        btnMsgMidia.innerText = 'Trocar';
      } catch (err) {
        alert("Erro ao ler mídia: " + err.message);
      }
    });
  }

  if (btnRemoverMsgMidia) {
    btnRemoverMsgMidia.addEventListener('click', () => {
      midiaMsgRapidaTemp = null;
      if (inputMsgMidia) inputMsgMidia.value = '';
      if (previewMsgMidiaBox) previewMsgMidiaBox.style.display = 'none';
      if (btnMsgMidia) btnMsgMidia.innerText = 'Escolher Arquivo';
    });
  }

  function obterMensagensSalvas() {
    try {
      const raw = localStorage.getItem('litrao_mensagens_rapidas');
      return raw ? JSON.parse(raw) : MENSAGENS_PADRAO;
    } catch (_) {
      return MENSAGENS_PADRAO;
    }
  }

  function salvarMensagens(msgs) {
    localStorage.setItem('litrao_mensagens_rapidas', JSON.stringify(msgs));
    renderizarMensagens();
  }

  function renderizarMensagens() {
    const msgs = obterMensagensSalvas();
    listaMensagensEl.innerHTML = '';
    msgs.forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      const badgeMidia = m.midia ? `<span class="tag tag-green" style="margin-left: 4px;">${m.midia.tipo === 'video' ? '🎥 Vídeo' : '📷 Foto'}</span>` : '';
      row.innerHTML = `
        <div style="overflow: hidden; flex: 1;">
          <div class="item-title" style="display: flex; align-items: center;">${m.titulo} ${badgeMidia}</div>
          <div class="item-preview">${m.texto}</div>
        </div>
        <div style="display: flex; gap: 4px; flex-shrink: 0;">
          <button class="btn btn-green btn-small" data-idx="${idx}" title="Enviar na conversa aberta">⚡ Enviar</button>
          <button class="btn btn-dark btn-small" data-del="${idx}" title="Excluir">🗑️</button>
        </div>
      `;
      listaMensagensEl.appendChild(row);
    });

    // Eventos dos botões de envio
    listaMensagensEl.querySelectorAll('[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.idx;
        const msg = msgs[idx];
        if (isZap && msg) {
          if (msg.midia && msg.midia.base64) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'enviar_midia_chat',
              midia: msg.midia,
              legenda: msg.texto
            }, (res) => {
              if (chrome.runtime.lastError) {
                const _e = chrome.runtime.lastError.message;
                alert('Aviso: Atualize a página do WhatsApp (F5) para conectar com a extensão.');
                return;
              }
              if (res && res.sucesso) {
                alert(`Foto/Vídeo "${msg.titulo}" enviada na conversa ativa!`);
              } else {
                alert('Aviso: ' + ((res && res.erro) || 'Verifique se uma conversa está aberta.'));
              }
            });
          } else {
            chrome.tabs.sendMessage(tab.id, { action: 'enviar_texto_chat', texto: msg.texto }, () => {
              if (chrome.runtime.lastError) {
                const _e = chrome.runtime.lastError.message;
                alert('Aviso: Atualize a página do WhatsApp (F5) para conectar com a extensão.');
                return;
              }
              alert(`Mensagem "${msg.titulo}" enviada na conversa ativa!`);
            });
          }
        } else {
          navigator.clipboard.writeText(msg.texto);
          alert(`Mensagem copiada para a área de transferência!`);
        }
      });
    });

    // Eventos de exclusão
    listaMensagensEl.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.del);
        msgs.splice(idx, 1);
        salvarMensagens(msgs);
      });
    });
  }

  renderizarMensagens();

  btnNovaMsg.addEventListener('click', () => {
    formMsg.style.display = 'block';
    if (previewMsgMidiaBox) previewMsgMidiaBox.style.display = 'none';
    midiaMsgRapidaTemp = null;
    if (inputMsgMidia) inputMsgMidia.value = '';
    if (btnMsgMidia) btnMsgMidia.innerText = 'Escolher Arquivo';
    inputMsgTitulo.focus();
  });

  btnCancelarMsg.addEventListener('click', () => {
    formMsg.style.display = 'none';
    inputMsgTitulo.value = '';
    inputMsgTexto.value = '';
    midiaMsgRapidaTemp = null;
    if (inputMsgMidia) inputMsgMidia.value = '';
    if (previewMsgMidiaBox) previewMsgMidiaBox.style.display = 'none';
  });

  btnSalvarMsg.addEventListener('click', () => {
    const tit = inputMsgTitulo.value.trim();
    const txt = inputMsgTexto.value.trim();
    if (!tit) {
      alert("Preencha o título da mensagem.");
      return;
    }
    const msgs = obterMensagensSalvas();
    msgs.push({
      id: 'msg_' + Date.now(),
      titulo: tit,
      texto: txt,
      midia: midiaMsgRapidaTemp ? Object.assign({}, midiaMsgRapidaTemp) : null
    });
    salvarMensagens(msgs);
    formMsg.style.display = 'none';
    inputMsgTitulo.value = '';
    inputMsgTexto.value = '';
    midiaMsgRapidaTemp = null;
    if (inputMsgMidia) inputMsgMidia.value = '';
    if (previewMsgMidiaBox) previewMsgMidiaBox.style.display = 'none';
  });


  // ==========================================
  // SEQUÊNCIAS DE ENVIOS COM 1 CLIQUE
  // ==========================================
  const SEQUENCIAS_PADRAO = [
    {
      id: 'seq_1',
      titulo: '🥤 Apresentação Completa ResetFIT (3 Passos)',
      passos: [
        { texto: 'Olá {nome}, tudo bem? Passando para te contar sobre o método ResetFIT!', delay: 3 },
        { texto: 'Nossa receita turbinada de 1 Litro leva Chá Verde, Fibras e Energia limpa. Ajuda a desinchar, queimar retenção e dá muita disposição!', delay: 4 },
        { texto: 'Você prefere que eu te mande os sabores ou quer passar no nosso Espaço para provar uma dose gratuita hoje?', delay: 0 }
      ]
    },
    {
      id: 'seq_2',
      titulo: '🧪 Convite Degustação Grátis EVS (3 Passos)',
      passos: [
        { texto: 'Oi {nome}, tudo bem por aí?', delay: 3 },
        { texto: 'Estamos selecionando algumas pessoas para provar gratuitamente o ResetFIT aqui no nosso Espaço Vida Saudável!', delay: 4 },
        { texto: 'Qual horário fica melhor pra você passar aqui, no almoço ou no final da tarde?', delay: 0 }
      ]
    },
    {
      id: 'seq_3',
      titulo: '💰 Fechamento de Venda & Pagamento Pix (2 Passos)',
      passos: [
        { texto: 'Maravilha, {nome}! Seu pedido do Kit ResetFIT está registrado!', delay: 3 },
        { texto: 'Você pode realizar o Pix para a nossa chave: {chave_pix}\nAssim que fizer, me manda o comprovante que já preparo o seu kit bem geladinho!', delay: 0 }
      ]
    },
    {
      id: 'seq_4',
      titulo: '⏳ Reativação de Contatos Sumidos (2 Passos)',
      passos: [
        { texto: 'Oi {nome}, como você está? Lembrei de você hoje!', delay: 3 },
        { texto: 'Chegou uma receita nova do ResetFIT super refrescante para essa semana! Como andam suas metas de hidratação?', delay: 0 }
      ]
    }
  ];

  const listaSequenciasEl = document.getElementById('lista-sequencias');
  const btnNovaSequencia = document.getElementById('btn-nova-sequencia');
  const formSequencia = document.getElementById('form-sequencia');
  const inputSeqTitulo = document.getElementById('input-seq-titulo');
  const containerPassosForm = document.getElementById('container-passos-form');
  const btnAdicionarPasso = document.getElementById('btn-adicionar-passo');
  const btnSalvarSequencia = document.getElementById('btn-salvar-sequencia');
  const btnCancelarSequencia = document.getElementById('btn-cancelar-sequencia');
  const boxProgressoSeq = document.getElementById('box-progresso-seq');
  const txtProgressoSeq = document.getElementById('txt-progresso-seq');
  const fillProgressoSeq = document.getElementById('fill-progresso-seq');

  function obterSequenciasSalvas() {
    try {
      const raw = localStorage.getItem('litrao_sequencias_1clique');
      return raw ? JSON.parse(raw) : SEQUENCIAS_PADRAO;
    } catch (_) {
      return SEQUENCIAS_PADRAO;
    }
  }

  function salvarSequencias(seqs) {
    localStorage.setItem('litrao_sequencias_1clique', JSON.stringify(seqs));
    renderizarSequencias();
  }

  function renderizarSequencias() {
    if (!listaSequenciasEl) return;
    const seqs = obterSequenciasSalvas();
    listaSequenciasEl.innerHTML = '';

    seqs.forEach((s, idx) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.style.flexDirection = 'column';
      row.style.alignItems = 'stretch';
      row.style.gap = '6px';

      // Monta as tags dos passos
      let passosHtml = '';
      s.passos.forEach((p, pIdx) => {
        const iconeMidia = p.midia ? (p.midia.tipo === 'video' ? '🎥 ' : '📷 ') : '';
        passosHtml += `<span class="tag tag-blue" title="${p.texto || 'Mídia'}">${iconeMidia}P${pIdx + 1} (${p.delay}s)</span> `;
      });

      row.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div class="item-title">${s.titulo}</div>
          <button class="btn btn-dark btn-small" data-seq-del="${idx}" title="Excluir Sequência" style="padding: 2px 6px;">🗑️</button>
        </div>
        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
          ${passosHtml}
        </div>
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <button class="btn btn-green btn-small" data-seq-run="${s.id}" style="width: 100%; font-size: 11px; padding: 7px;">
            ⚡ Disparar Sequência (1 Clique)
          </button>
        </div>
      `;
      listaSequenciasEl.appendChild(row);
    });

    // Eventos do botão de 1 clique
    listaSequenciasEl.querySelectorAll('[data-seq-run]').forEach(btn => {
      btn.addEventListener('click', () => {
        const seqId = btn.dataset.seqRun;
        const seq = seqs.find(s => s.id === seqId);
        if (!seq) return;

        if (!isZap) {
          alert("Abra uma conversa no WhatsApp Web para disparar esta sequência.");
          return;
        }

        // Feedback no popup
        btn.disabled = true;
        btn.innerText = '⏳ Executando Funil...';
        if (boxProgressoSeq) {
          boxProgressoSeq.style.display = 'block';
          txtProgressoSeq.innerText = `Iniciando "${seq.titulo}"...`;
          fillProgressoSeq.style.width = '20%';
        }

        chrome.tabs.sendMessage(tab.id, {
          action: 'executar_sequencia_1clique',
          sequencia: seq
        }, (res) => {
          btn.disabled = false;
          btn.innerText = '⚡ Disparar Sequência (1 Clique)';
          if (boxProgressoSeq) {
            boxProgressoSeq.style.display = 'none';
          }
          if (chrome.runtime.lastError) {
            const _e = chrome.runtime.lastError.message;
            alert('Aviso: Atualize a página do WhatsApp (F5) para restabelecer a conexão.');
            return;
          }
          if (res && res.sucesso) {
            alert(`✅ Sucesso! Sequência "${seq.titulo}" enviada na conversa!`);
          } else {
            alert('Aviso: ' + ((res && res.erro) || 'Verifique se uma conversa está aberta.'));
          }
        });
      });
    });

    // Eventos de exclusão
    listaSequenciasEl.querySelectorAll('[data-seq-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.seqDel);
        seqs.splice(idx, 1);
        salvarSequencias(seqs);
      });
    });
  }

  renderizarSequencias();

  // Formulário para Nova Sequência
  if (btnNovaSequencia) {
    btnNovaSequencia.addEventListener('click', () => {
      formSequencia.style.display = 'block';
      inputSeqTitulo.value = '';
      containerPassosForm.innerHTML = '';
      adicionarCampoPassoForm('Olá {nome}, tudo bem?', 3);
      adicionarCampoPassoForm('Passando para te apresentar o Litrão do Reset!', 0);
      inputSeqTitulo.focus();
    });
  }

  function adicionarCampoPassoForm(textoPadrao = '', delayPadrao = 3, midiaPadrao = null) {
    const div = document.createElement('div');
    div.style.background = '#1E293B';
    div.style.padding = '8px';
    div.style.borderRadius = '6px';
    div.style.border = '1px solid #334155';
    div.stepMidia = midiaPadrao || null;

    div.innerHTML = `
      <textarea rows="2" placeholder="Mensagem / Legenda deste passo (use {nome})" class="passo-texto" style="margin-bottom: 4px;">${textoPadrao}</textarea>
      
      <!-- Linha de Mídia do Passo -->
      <div style="background: #0B1120; border: 1px dashed #334155; border-radius: 4px; padding: 4px 6px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
        <div class="passo-midia-preview" style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
          <span class="passo-midia-status" style="font-size: 10px; color: #64748B;">Nenhuma foto/vídeo</span>
        </div>
        <input type="file" accept="image/*,video/*" class="passo-midia-input" style="display: none;">
        <button type="button" class="btn btn-dark btn-small btn-passo-midia" style="font-size: 9px; padding: 2px 6px;">📎 Anexar Mídia</button>
        <button type="button" class="btn btn-dark btn-small btn-passo-remover-midia" style="display: none; color: #EF4444; padding: 1px 5px; font-size: 10px;">✕</button>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
        <span style="font-size: 10px; color: #94A3B8;">Aguardar após enviar (segundos):</span>
        <input type="number" value="${delayPadrao}" min="0" max="60" class="passo-delay" style="width: 60px; margin-bottom: 0; padding: 4px;">
        <button type="button" class="btn btn-dark btn-small btn-remover-passo" style="padding: 2px 6px;" title="Remover este passo">🗑️</button>
      </div>
    `;

    const btnMidia = div.querySelector('.btn-passo-midia');
    const inputMidia = div.querySelector('.passo-midia-input');
    const statusMidia = div.querySelector('.passo-midia-status');
    const btnRemoverMidia = div.querySelector('.btn-passo-remover-midia');

    function atualizarUiMidia() {
      if (div.stepMidia) {
        statusMidia.innerHTML = `<span style="color:#10B981; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${div.stepMidia.tipo === 'video' ? '🎥' : '📷'} ${div.stepMidia.nome}</span>`;
        btnRemoverMidia.style.display = 'inline-block';
        btnMidia.innerText = 'Trocar';
      } else {
        statusMidia.innerText = 'Nenhuma foto/vídeo';
        btnRemoverMidia.style.display = 'none';
        btnMidia.innerText = '📎 Anexar Mídia';
      }
    }

    btnMidia.addEventListener('click', () => inputMidia.click());

    inputMidia.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        btnMidia.innerText = '⏳';
        div.stepMidia = await lerArquivoComoBase64(file);
        atualizarUiMidia();
      } catch (err) {
        alert("Erro ao ler mídia: " + err.message);
      }
    });

    btnRemoverMidia.addEventListener('click', () => {
      div.stepMidia = null;
      inputMidia.value = '';
      atualizarUiMidia();
    });

    atualizarUiMidia();

    div.querySelector('.btn-remover-passo').addEventListener('click', () => {
      div.remove();
    });

    containerPassosForm.appendChild(div);
  }

  if (btnAdicionarPasso) {
    btnAdicionarPasso.addEventListener('click', () => {
      adicionarCampoPassoForm('', 3);
    });
  }

  if (btnCancelarSequencia) {
    btnCancelarSequencia.addEventListener('click', () => {
      formSequencia.style.display = 'none';
    });
  }

  if (btnSalvarSequencia) {
    btnSalvarSequencia.addEventListener('click', () => {
      const tit = inputSeqTitulo.value.trim();
      if (!tit) {
        alert("Preencha o nome da sequência.");
        return;
      }
      const passos = [];
      const stepDivs = containerPassosForm.children;
      for (const stepDiv of stepDivs) {
        const tEl = stepDiv.querySelector('.passo-texto');
        const dEl = stepDiv.querySelector('.passo-delay');
        if (tEl && dEl) {
          const txt = tEl.value.trim();
          const del = parseInt(dEl.value) || 0;
          const mid = stepDiv.stepMidia || null;
          if (txt || mid) {
            passos.push({ texto: txt, delay: del, midia: mid });
          }
        }
      }

      if (passos.length === 0) {
        alert("Adicione pelo menos 1 passo com mensagem ou mídia.");
        return;
      }

      const seqs = obterSequenciasSalvas();
      seqs.push({ id: 'seq_' + Date.now(), titulo: tit, passos });
      salvarSequencias(seqs);
      formSequencia.style.display = 'none';
      alert(`Sequência "${tit}" salva com sucesso!`);
    });
  }

  // ==========================================
  // GALERIA DE MÍDIAS & ÁUDIOS (1 CLIQUE)
  // ==========================================
  const btnSubirFotoGaleria = document.getElementById('btn-subir-foto-galeria');
  const inputGaleriaFoto = document.getElementById('input-galeria-foto');
  const btnSubirVideoGaleria = document.getElementById('btn-subir-video-galeria');
  const inputGaleriaVideo = document.getElementById('input-galeria-video');
  const btnNovoAudio = document.getElementById('btn-novo-audio');
  const inputAudioFile = document.getElementById('input-audio-file');
  const listaAudiosEl = document.getElementById('lista-audios');

  function formatarBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function obterMidiasGaleria() {
    try {
      const raw = localStorage.getItem('litrao_galeria_midias');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function salvarMidiasGaleria(midias) {
    try {
      localStorage.setItem('litrao_galeria_midias', JSON.stringify(midias));
    } catch (_) {}
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ litrao_galeria_midias: midias });
    }
    renderizarGaleriaMidias();
  }

  function renderizarGaleriaMidias() {
    if (!listaAudiosEl) return;
    const midias = obterMidiasGaleria();
    listaAudiosEl.innerHTML = '';

    if (midias.length === 0) {
      listaAudiosEl.innerHTML = `
        <div style="text-align: center; color: #64748B; padding: 14px; font-size: 11px;">
          Nenhuma foto ou vídeo salva ainda.<br>Clique nos botões acima para subir imagens promocionais, vídeos ou áudios!
        </div>
      `;
      return;
    }

    midias.forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.style.alignItems = 'center';
      row.style.gap = '8px';

      let thumbHtml = '';
      if (m.tipo === 'imagem') {
        thumbHtml = `<img src="${m.base64}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid #334155; flex-shrink: 0;">`;
      } else if (m.tipo === 'video') {
        thumbHtml = `<div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #1E293B; border-radius: 4px; font-size: 18px; flex-shrink: 0;">🎥</div>`;
      } else {
        thumbHtml = `<div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #064E3B; border-radius: 4px; font-size: 18px; flex-shrink: 0;">🎙️</div>`;
      }

      row.innerHTML = `
        ${thumbHtml}
        <div style="flex: 1; min-width: 0;">
          <div class="item-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.nome}</div>
          <div class="item-preview">${m.tipo.toUpperCase()} • ${formatarBytes(m.tamanho)}</div>
        </div>
        <div style="display: flex; gap: 4px; flex-shrink: 0;">
          <button class="btn btn-green btn-small" data-galeria-send="${idx}" title="Enviar no chat aberto do WhatsApp">⚡ Enviar</button>
          <button class="btn btn-dark btn-small" data-galeria-del="${idx}" title="Excluir">🗑️</button>
        </div>
      `;
      listaAudiosEl.appendChild(row);
    });

    listaAudiosEl.querySelectorAll('[data-galeria-send]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.galeriaSend);
        const midia = midias[idx];
        if (!midia) return;

        if (!isZap) {
          alert("Abra uma conversa no WhatsApp Web para enviar esta mídia.");
          return;
        }

        btn.disabled = true;
        btn.innerText = '⏳';

        chrome.tabs.sendMessage(tab.id, {
          action: 'enviar_midia_chat',
          midia: midia,
          legenda: ''
        }, (res) => {
          btn.disabled = false;
          btn.innerText = '⚡ Enviar';
          if (chrome.runtime.lastError) {
            const _e = chrome.runtime.lastError.message;
            alert('Aviso: Atualize a página do WhatsApp (F5) para restabelecer a conexão.');
            return;
          }
          if (res && res.sucesso) {
            alert(`✅ ${midia.nome} enviada no chat aberto!`);
          } else {
            alert('Aviso: ' + ((res && res.erro) || 'Verifique se uma conversa está aberta.'));
          }
        });
      });
    });

    listaAudiosEl.querySelectorAll('[data-galeria-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.galeriaDel);
        midias.splice(idx, 1);
        salvarMidiasGaleria(midias);
      });
    });
  }

  async function processarUploadGaleria(file) {
    if (!file) return;
    try {
      const midiaObj = await lerArquivoComoBase64(file);
      const midias = obterMidiasGaleria();
      midias.unshift(midiaObj);
      salvarMidiasGaleria(midias);
      alert(`🎉 Mídia "${file.name}" salva na sua Galeria!`);
    } catch (err) {
      alert("Erro ao processar mídia: " + err.message);
    }
  }

  if (btnSubirFotoGaleria && inputGaleriaFoto) {
    btnSubirFotoGaleria.addEventListener('click', () => inputGaleriaFoto.click());
    inputGaleriaFoto.addEventListener('change', (e) => {
      processarUploadGaleria(e.target.files[0]);
      e.target.value = '';
    });
  }

  if (btnSubirVideoGaleria && inputGaleriaVideo) {
    btnSubirVideoGaleria.addEventListener('click', () => inputGaleriaVideo.click());
    inputGaleriaVideo.addEventListener('change', (e) => {
      processarUploadGaleria(e.target.files[0]);
      e.target.value = '';
    });
  }

  if (btnNovoAudio && inputAudioFile) {
    btnNovoAudio.addEventListener('click', () => inputAudioFile.click());
    inputAudioFile.addEventListener('change', (e) => {
      processarUploadGaleria(e.target.files[0]);
      e.target.value = '';
    });
  }

  renderizarGaleriaMidias();

  // ==========================================
  // 3. BACKUP & RESTAURAÇÃO
  // ==========================================
  const btnExportarBackup = document.getElementById('btn-exportar-backup');
  const btnImportarBackup = document.getElementById('btn-importar-backup');
  const inputImportarBackup = document.getElementById('input-importar-backup');

  btnExportarBackup.addEventListener('click', () => {
    const backup = {
      versao: '2.1.0',
      dataExportacao: new Date().toISOString(),
      mensagensRapidas: obterMensagensSalvas(),
      leadsSalvos: contatosExtraidos
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_resetfit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("Backup gerado e baixado com sucesso!");
  });

  btnImportarBackup.addEventListener('click', () => {
    inputImportarBackup.click();
  });

  inputImportarBackup.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const json = JSON.parse(evt.target.result);
        if (json.mensagensRapidas && Array.isArray(json.mensagensRapidas)) {
          salvarMensagens(json.mensagensRapidas);
          alert(`Backup restaurado com sucesso! ${json.mensagensRapidas.length} mensagens carregadas.`);
        } else if (Array.isArray(json)) {
          salvarMensagens(json);
          alert(`Lista de mensagens importada com sucesso!`);
        } else {
          alert("Arquivo JSON lido, mas formato não reconhecido.");
        }
      } catch (err) {
        alert("Erro ao ler arquivo de backup.");
      }
    };
    reader.readAsText(file);
  });

});


  // ==========================================
  // MOTOR DE SPINTAX E DISPARADOR EM MASSA (ANTI-BLOQUEIO)
  // ==========================================
  const VARIACOES_PADRAO = [
    {
      id: 'var_1',
      texto: '{saudacao} {nome}, {tudo bem?|como vai?|passando rapidinho!} Vi seu contato no grupo e gostaria de te apresentar o método do Litrão do Reset para desinchar, queimar retenção e ter mais disposição. Quer que eu te mande os detalhes? Ref: #{aleatorio}'
    },
    {
      id: 'var_2',
      texto: '{Oi|Olá|Oie} {nome}! {Tudo certinho por aí?|Como você está?} Chegou uma receita nova e super refrescante do Litrão do Reset essa semana no nosso Espaço. Gostaria de uma dose gratuita de degustação? Ref: #{aleatorio}'
    },
    {
      id: 'var_3',
      texto: '{saudacao}! {Passando para te desejar uma ótima semana|Lembrei de você hoje}! Como andam suas metas de hidratação e energia? Nosso mix de 1 Litro tem feito muito sucesso por aqui! Ref: #{aleatorio}'
    }
  ];

  let textareaFocada = null;
  let disparoEmAndamento = false;
  let cancelarDisparoAtual = false;

  function obterVariacoesSalvas() {
    try {
      const raw = localStorage.getItem('litrao_disparador_variacoes');
      return raw ? JSON.parse(raw) : VARIACOES_PADRAO;
    } catch (_) {
      return VARIACOES_PADRAO;
    }
  }

  function salvarVariacoes(vars) {
    localStorage.setItem('litrao_disparador_variacoes', JSON.stringify(vars));
    renderizarVariacoes();
  }

  function renderizarVariacoes() {
    const container = document.getElementById('container-variacoes-disparo');
    if (!container) return;
    const lista = obterVariacoesSalvas();
    container.innerHTML = '';

    lista.forEach((item, idx) => {
      const box = document.createElement('div');
      box.style.cssText = 'background: #0E1626; border: 1px solid #1E293B; border-radius: 8px; padding: 8px;';

      box.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 10px; font-weight: bold; color: #10B981;">Mensagem ${idx + 1} (${String.fromCharCode(65 + idx)}):</span>
          ${lista.length > 1 ? `<button type="button" class="btn btn-dark btn-small" data-del-var="${idx}" style="padding: 2px 6px; font-size: 10px;">🗑️ Remover</button>` : ''}
        </div>
        <textarea rows="3" class="input-variacao-msg" data-idx="${idx}" style="margin-bottom: 0; font-size: 11px;">${item.texto}</textarea>
      `;

      const txtArea = box.querySelector('textarea');
      txtArea.addEventListener('focus', () => { textareaFocada = txtArea; });
      txtArea.addEventListener('input', () => {
        lista[idx].texto = txtArea.value;
        localStorage.setItem('litrao_disparador_variacoes', JSON.stringify(lista));
      });

      if (lista.length > 1) {
        box.querySelector('[data-del-var]').addEventListener('click', () => {
          lista.splice(idx, 1);
          salvarVariacoes(lista);
        });
      }

      container.appendChild(box);
    });

    // Define foco na primeira por padrão
    const primeiro = container.querySelector('textarea');
    if (primeiro) textareaFocada = primeiro;
  }

  renderizarVariacoes();

  // Adicionar Nova Variação
  const btnAddVar = document.getElementById('btn-add-variacao');
  if (btnAddVar) {
    btnAddVar.addEventListener('click', () => {
      const lista = obterVariacoesSalvas();
      lista.push({
        id: 'var_' + Date.now(),
        texto: '{saudacao} {nome}, {tudo bem?|como vai?|tudo certinho?} Passando para compartilhar novidades do Litrão do Reset! Ref: #{aleatorio}'
      });
      salvarVariacoes(lista);
    });
  }

  // Inserir Tags no Campo Ativo
  document.querySelectorAll('.btn-inserir-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (!textareaFocada) {
        const primeiro = document.querySelector('.input-variacao-msg');
        if (primeiro) textareaFocada = primeiro;
      }
      if (textareaFocada) {
        const start = textareaFocada.selectionStart || textareaFocada.value.length;
        const end = textareaFocada.selectionEnd || textareaFocada.value.length;
        const val = textareaFocada.value;
        textareaFocada.value = val.substring(0, start) + ' ' + tag + ' ' + val.substring(end);
        textareaFocada.dispatchEvent(new Event('input'));
        textareaFocada.focus();
      }
    });
  });

  // Funções de Resolução de Spintax e Tags Inteligentes
  function resolverSpintax(texto) {
    if (!texto) return '';
    const regex = /\{([^{}]+)\}/g;
    let anterior = '';
    let atual = texto;
    while (atual !== anterior) {
      anterior = atual;
      atual = atual.replace(regex, (match, opcoesStr) => {
        if (!opcoesStr.includes('|')) return match;
        const opcoes = opcoesStr.split('|');
        return opcoes[Math.floor(Math.random() * opcoes.length)].trim();
      });
    }
    return atual;
  }

  function resolverTagsInteligentes(texto, contato = {}) {
    if (!texto) return '';
    let res = texto;

    // 1. Saudação por Turno
    const hora = new Date().getHours();
    let listaSaudacoes = [];
    if (hora >= 5 && hora < 12) {
      listaSaudacoes = ['Bom dia', 'Olá, bom dia', 'Oi, bom dia', 'Oie, bom dia'];
    } else if (hora >= 12 && hora < 18) {
      listaSaudacoes = ['Boa tarde', 'Olá, boa tarde', 'Oi, boa tarde', 'Oie, boa tarde'];
    } else {
      listaSaudacoes = ['Boa noite', 'Olá, boa noite', 'Oi, boa noite'];
    }
    const saudacao = listaSaudacoes[Math.floor(Math.random() * listaSaudacoes.length)];
    res = res.replace(/\{saudacao\}/gi, saudacao);

    // 2. Nome
    let pNome = '';
    if (contato.nome && !contato.nome.match(/^\+?\d/)) {
      pNome = contato.nome.trim().split(' ')[0] || '';
    }
    if (pNome && pNome.length >= 2) {
      res = res.replace(/\{nome\}/gi, pNome);
      res = res.replace(/\{primeiro_nome\}/gi, pNome);
    } else {
      res = res.replace(/\{nome\}/gi, '');
      res = res.replace(/\{primeiro_nome\}/gi, '');
    }

    // 3. Hash e Código Aleatório Anti-Bloqueio
    const hash = Math.floor(1000 + Math.random() * 9000);
    res = res.replace(/\{aleatorio\}/gi, String(hash));
    res = res.replace(/\{protocolo\}/gi, '#' + hash);

    return res.replace(/\s{2,}/g, ' ').trim();
  }

  function gerarMensagemFinal(textoTemplate, contato = {}) {
    let t = resolverTagsInteligentes(textoTemplate, contato);
    t = resolverSpintax(t);
    return t;
  }

  // Testador ao Vivo
  const btnTestarLive = document.getElementById('btn-testar-spintax-live');
  const boxPreviewSpintax = document.getElementById('preview-spintax-box');

  if (btnTestarLive && boxPreviewSpintax) {
    btnTestarLive.addEventListener('click', () => {
      const lista = obterVariacoesSalvas();
      if (lista.length === 0) return;
      const escolhida = lista[Math.floor(Math.random() * lista.length)].texto;
      const nomesExemplo = ['Mariana', 'Carlos', 'Lucia', 'Jorge', 'Patricia'];
      const nomeSorteado = nomesExemplo[Math.floor(Math.random() * nomesExemplo.length)];
      const msgGerada = gerarMensagemFinal(escolhida, { nome: nomeSorteado });
      boxPreviewSpintax.innerHTML = `💬 <b>Resultado:</b> "${msgGerada}"`;
    });
  }

  // Puxar Telefones Extraídos
  const btnPuxarExtrator = document.getElementById('btn-puxar-extrator-para-disparo');
  const textareaTelefones = document.getElementById('disparo-massa-telefones');

  if (btnPuxarExtrator && textareaTelefones) {
    btnPuxarExtrator.addEventListener('click', () => {
      if (!contatosExtraidos || contatosExtraidos.length === 0) {
        alert("Nenhum contato extraído recentemente. Vá na aba 'Extrator' e extraia um grupo primeiro!");
        return;
      }
      const tels = contatosExtraidos
        .map(c => c.telefone)
        .filter(t => t && t.length >= 8);

      if (tels.length === 0) {
        alert("Nenhum telefone válido encontrado na extração.");
        return;
      }
      textareaTelefones.value = tels.join('\n');
      alert(`Sucesso! ${tels.length} telefones importados do Extrator para a lista de disparo!`);
    });
  }

  // ==========================================
  // MÍDIA ANEXA NO DISPARO EM MASSA (FOTO OU VÍDEO)
  // ==========================================
  const btnEscolherMidiaDisparo = document.getElementById('btn-escolher-midia-disparo');
  const inputFileMidiaDisparo = document.getElementById('input-file-midia-disparo');
  const previewMidiaDisparoBox = document.getElementById('preview-midia-disparo-box');
  const previewMidiaDisparoThumb = document.getElementById('preview-midia-disparo-thumb');
  const txtNomeMidiaDisparo = document.getElementById('txt-nome-midia-disparo');
  const txtInfoMidiaDisparo = document.getElementById('txt-info-midia-disparo');
  const btnRemoverMidiaDisparo = document.getElementById('btn-remover-midia-disparo');

  let midiaDisparoAtual = null;

  if (btnEscolherMidiaDisparo && inputFileMidiaDisparo) {
    btnEscolherMidiaDisparo.addEventListener('click', () => inputFileMidiaDisparo.click());
    inputFileMidiaDisparo.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        btnEscolherMidiaDisparo.innerText = '⏳ Lendo...';
        midiaDisparoAtual = await lerArquivoComoBase64(file);

        if (txtNomeMidiaDisparo) txtNomeMidiaDisparo.innerText = file.name;
        if (txtInfoMidiaDisparo) txtInfoMidiaDisparo.innerText = `${midiaDisparoAtual.tipo.toUpperCase()} • ${formatarBytes(file.size)}`;

        if (previewMidiaDisparoThumb) {
          if (midiaDisparoAtual.tipo === 'imagem') {
            previewMidiaDisparoThumb.innerHTML = `<img src="${midiaDisparoAtual.base64}" style="width: 100%; height: 100%; object-fit: cover;">`;
          } else {
            previewMidiaDisparoThumb.innerHTML = `<span style="font-size: 20px;">🎥</span>`;
          }
        }

        if (previewMidiaDisparoBox) previewMidiaDisparoBox.style.display = 'flex';
        btnEscolherMidiaDisparo.innerText = 'Trocar Mídia';
      } catch (err) {
        alert("Erro ao ler mídia: " + err.message);
      }
    });
  }

  if (btnRemoverMidiaDisparo) {
    btnRemoverMidiaDisparo.addEventListener('click', () => {
      midiaDisparoAtual = null;
      if (inputFileMidiaDisparo) inputFileMidiaDisparo.value = '';
      if (previewMidiaDisparoBox) previewMidiaDisparoBox.style.display = 'none';
      if (btnEscolherMidiaDisparo) btnEscolherMidiaDisparo.innerText = '📁 Escolher Mídia';
    });
  }

  // Iniciar Disparo em Massa
  const btnIniciarDisparo = document.getElementById('btn-iniciar-disparo');
  const btnPararDisparo = document.getElementById('btn-parar-disparo');
  const boxProgressoDisparo = document.getElementById('box-progresso-disparo');
  const txtProgressoDisparo = document.getElementById('txt-progresso-disparo');
  const txtContagemDisparo = document.getElementById('txt-contagem-disparo');
  const fillProgressoDisparo = document.getElementById('fill-progresso-disparo');
  const txtDelayRegressivo = document.getElementById('txt-delay-regressivo');
  const selectModoAlternancia = document.getElementById('disparo-modo-alternancia');
  const inputDelayMin = document.getElementById('disparo-delay-min');
  const inputDelayMax = document.getElementById('disparo-delay-max');

  if (btnPararDisparo) {
    btnPararDisparo.addEventListener('click', () => {
      cancelarDisparoAtual = true;
      btnPararDisparo.innerText = '⏳ Parando...';
    });
  }

  if (btnIniciarDisparo) {
    btnIniciarDisparo.addEventListener('click', async () => {
      if (disparoEmAndamento) return;

      const rawTels = textareaTelefones ? textareaTelefones.value.trim() : '';
      if (!rawTels) {
        alert("Preencha a lista de telefones (um por linha).");
        return;
      }

      const linhasTelefones = rawTels.split('\n').map(l => l.trim()).filter(Boolean);
      if (linhasTelefones.length === 0) {
        alert("Nenhum telefone válido encontrado.");
        return;
      }

      const variacoes = obterVariacoesSalvas().filter(v => v.texto && v.texto.trim().length > 0);
      if (variacoes.length === 0 && !midiaDisparoAtual) {
        alert("Adicione pelo menos uma mensagem nas variações ou anexe uma foto/vídeo.");
        return;
      }

      if (!isZap || !tab) {
        alert("Abra o WhatsApp Web (web.whatsapp.com) para iniciar o disparo.");
        return;
      }

      const delayMin = Math.max(5, parseInt(inputDelayMin.value) || 15);
      const delayMax = Math.max(delayMin, parseInt(inputDelayMax.value) || 35);
      const modo = selectModoAlternancia ? selectModoAlternancia.value : 'aleatorio';

      disparoEmAndamento = true;
      cancelarDisparoAtual = false;

      btnIniciarDisparo.disabled = true;
      btnIniciarDisparo.innerText = '⏳ Disparador Ativo...';
      if (boxProgressoDisparo) boxProgressoDisparo.style.display = 'block';

      let enviadosSucesso = 0;
      let errosCount = 0;

      for (let i = 0; i < linhasTelefones.length; i++) {
        if (cancelarDisparoAtual) {
          alert(`Disparo interrompido pelo usuário. Total enviado: ${enviadosSucesso}/${linhasTelefones.length}.`);
          break;
        }

        const telLinha = linhasTelefones[i];
        const pct = Math.round(((i) / linhasTelefones.length) * 100);
        if (fillProgressoDisparo) fillProgressoDisparo.style.width = pct + '%';
        if (txtContagemDisparo) txtContagemDisparo.innerText = `${i + 1} de ${linhasTelefones.length}`;
        const descMidia = midiaDisparoAtual ? (midiaDisparoAtual.tipo === 'video' ? '🎥 ' : '📷 ') : '';
        if (txtProgressoDisparo) txtProgressoDisparo.innerText = `Enviando ${descMidia}para ${telLinha}...`;

        // 1. Escolhe a mensagem (aleatória ou em ordem)
        let templateEscolhido = '';
        if (variacoes.length > 0) {
          if (modo === 'ordem') {
            templateEscolhido = variacoes[i % variacoes.length].texto;
          } else {
            templateEscolhido = variacoes[Math.floor(Math.random() * variacoes.length)].texto;
          }
        }

        // 2. Busca nome se existir nos contatos extraídos
        let nomeContato = '';
        const achado = contatosExtraidos.find(c => c.telefone && c.telefone.includes(telLinha.replace(/\D/g, '').slice(-8)));
        if (achado && achado.nome) nomeContato = achado.nome;

        // 3. Resolve Spintax e Tags Inteligentes
        const msgFinal = templateEscolhido ? gerarMensagemFinal(templateEscolhido, { nome: nomeContato, telefone: telLinha }) : '';

        // 4. Envia para o WhatsApp Web (com mídia anexa se presente)
        try {
          await garantirContentScript(tab.id);
          const res = await new Promise(resolve => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'disparar_mensagem_para_telefone',
              telefone: telLinha,
              texto: msgFinal,
              midia: midiaDisparoAtual
            }, (r) => {
              if (chrome.runtime.lastError || !r) resolve({ sucesso: false, erro: 'Erro de comunicação com o WhatsApp.' });
              else resolve(r);
            });
          });

          if (res && res.sucesso) {
            enviadosSucesso++;
          } else {
            errosCount++;
          }
        } catch (err) {
          errosCount++;
        }

        // 5. Delay humanizado se não for o último contato
        if (i < linhasTelefones.length - 1 && !cancelarDisparoAtual) {
          const delaySegundos = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
          for (let s = delaySegundos; s > 0; s--) {
            if (cancelarDisparoAtual) break;
            if (txtDelayRegressivo) txtDelayRegressivo.innerText = `⏳ Aguardando ${s}s antes do próximo envio (anti-bloqueio humanizado)...`;
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      disparoEmAndamento = false;
      btnIniciarDisparo.disabled = false;
      btnIniciarDisparo.innerText = '🚀 Iniciar Disparo em Massa com Rotação';
      if (btnPararDisparo) btnPararDisparo.innerText = '🛑 Parar Disparo';
      if (boxProgressoDisparo) boxProgressoDisparo.style.display = 'none';

      if (!cancelarDisparoAtual) {
        alert(`🎉 Disparo em massa finalizado com sucesso!\n\nEnviados: ${enviadosSucesso}\nErros / Não WhatsApp: ${errosCount}`);
      }
    });
  }

  // ==========================================
  // EXTENSÃO RESETFIT: ABA FACEBOOK GRUPOS (SUPERADMIN)
  // ==========================================
  function initFacebookExtractorPopup() {
    const statusAbaFb = document.getElementById('fb-popup-status-aba');
    const btnExtrairFb = document.getElementById('btn-popup-extrair-facebook');
    const btnRolarFb = document.getElementById('btn-popup-rolar-facebook');
    const boxResultadoFb = document.getElementById('fb-popup-resultado-box');
    const txtQtdFb = document.getElementById('fb-popup-qtd-membros');
    const listPreviewFb = document.getElementById('fb-popup-lista-preview');
    const btnSincronizarFb = document.getElementById('btn-popup-sincronizar-facebook');
    const btnCopiarFb = document.getElementById('btn-popup-copiar-facebook');

    if (!btnExtrairFb) return;

    let leadsFacebookExtraidosPopup = [];
    let grupoFacebookAtualPopup = 'Grupo Facebook';

    async function verificarAbaFacebookAtual() {
      if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return;
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) return;

        if (tab.url.includes('facebook.com/groups/')) {
          let nomeLimpo = (tab.title || 'Grupo Facebook').replace(/\s*\|\s*Facebook\s*$/i, '').trim();
          grupoFacebookAtualPopup = nomeLimpo;
          if (statusAbaFb) {
            statusAbaFb.innerHTML = `<span style="color:#38BDF8;">✅ Grupo Detectado:</span> <b>${nomeLimpo}</b>`;
          }
          if (btnExtrairFb) {
            btnExtrairFb.disabled = false;
            btnExtrairFb.innerText = '⚡ Extrair Membros deste Grupo (1 Clique)';
          }
        } else {
          if (statusAbaFb) {
            statusAbaFb.innerHTML = `<span style="color:#F59E0B;">⚠️ A aba ativa não é um grupo do Facebook.</span><br><span style="font-size:10px;color:#94A3B8;">Abra a página do grupo no Facebook e clique aqui novamente.</span>`;
          }
        }
      } catch (err) {}
    }

    verificarAbaFacebookAtual();

    btnExtrairFb.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;

      btnExtrairFb.disabled = true;
      btnExtrairFb.innerText = '⏳ Identificando membros...';

      try {
        const resultado = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const links = Array.from(document.querySelectorAll('a[role="link"], a[href*="/user/"], a[href*="/groups/"]'));
            const membrosMap = new Map();
            const termosIgnorar = [
              'adicionar', 'mensagem', 'ver tudo', 'amigo', 'grupo', 'facebook',
              'compartilhar', 'curtir', 'notificações', 'feed', 'gaming', 'convidar',
              'classificado', 'discussão', 'destaques', 'vídeo', 'eventos', 'sobre'
            ];

            links.forEach(a => {
              const href = (a.href || '').split('?')[0];
              const nome = (a.innerText || '').trim();
              if (!href || nome.length < 3 || nome.length > 50 || nome.includes('\n')) return;
              const low = nome.toLowerCase();
              if (termosIgnorar.some(t => low.includes(t))) return;

              const isPerfil = href.includes('/user/') || href.includes('/profile.php') ||
                               (href.includes('facebook.com/') && !href.includes('/groups/'));
              const card = a.closest('div[role="listitem"]') || a.parentElement?.parentElement || {};
              const cardText = (card.innerText || '').toLowerCase();

              if (!isPerfil && !cardText.includes('administrador') && !cardText.includes('membro')) return;

              const isAdmin = cardText.includes('administrador') || cardText.includes('moderador');

              if (!membrosMap.has(nome)) {
                membrosMap.set(nome, {
                  nome: nome,
                  perfilUrl: isPerfil ? href : `https://www.facebook.com/search/people/?q=${encodeURIComponent(nome)}`,
                  cargo: isAdmin ? 'admin' : 'membro'
                });
              }
            });

            return Array.from(membrosMap.values());
          }
        });

        const membros = (resultado && resultado[0] && resultado[0].result) ? resultado[0].result : [];
        leadsFacebookExtraidosPopup = membros;

        btnExtrairFb.disabled = false;
        btnExtrairFb.innerText = '⚡ Atualizar Extração';

        if (btnRolarFb) btnRolarFb.style.display = 'block';
        if (boxResultadoFb) boxResultadoFb.style.display = 'block';

        if (txtQtdFb) {
          const adm = membros.filter(m => m.cargo === 'admin').length;
          txtQtdFb.innerText = `${membros.length} membros extraídos (${adm} Administradores)`;
        }

        if (listPreviewFb) {
          if (membros.length === 0) {
            listPreviewFb.innerHTML = '<div style="padding:10px;text-align:center;color:#94A3B8;font-size:10px;">Nenhum membro detectado. Você está na aba "Pessoas" do grupo? Role a página para baixo e tente novamente!</div>';
          } else {
            listPreviewFb.innerHTML = membros.map(m => `
              <div style="padding:4px 6px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1E293B;font-size:10px;">
                <span style="font-weight:700;color:#F1F5F9;">${m.nome}</span>
                ${m.cargo === 'admin'
                  ? '<span style="background:rgba(245,158,11,0.2);color:#FBBF24;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:800;">👑 Admin</span>'
                  : '<span style="color:#64748B;font-size:8px;">Membro</span>'
                }
              </div>
            `).join('');
          }
        }
      } catch (e) {
        btnExtrairFb.disabled = false;
        btnExtrairFb.innerText = '⚡ Tentar Novamente';
        alert('Erro ao extrair da aba: certifique-se de estar com a página do Facebook aberta.');
      }
    });

    if (btnRolarFb) {
      btnRolarFb.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;

        btnRolarFb.innerText = '⏳ Rolando página...';
        btnRolarFb.disabled = true;

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            window.scrollBy(0, 1500);
          }
        });

        setTimeout(() => {
          btnRolarFb.disabled = false;
          btnRolarFb.innerText = '🔄 Rolar Mais (Carregar Mais)';
          btnExtrairFb?.click();
        }, 1000);
      });
    }

    if (btnSincronizarFb) {
      btnSincronizarFb.addEventListener('click', () => {
        if (!leadsFacebookExtraidosPopup.length) {
          alert('Nenhum membro extraído para sincronizar.');
          return;
        }

        const pacote = {
          tipo: 'RESETFIT_SINCRONIZAR_FACEBOOK',
          grupo: grupoFacebookAtualPopup,
          total: leadsFacebookExtraidosPopup.length,
          data: new Date().toISOString(),
          leads: leadsFacebookExtraidosPopup
        };

        chrome.storage.local.set({ resetfit_fb_pending_import: pacote }, () => {
          btnSincronizarFb.innerText = '✅ Sincronizado com Sucesso!';
          btnSincronizarFb.style.background = '#047857';
          alert(`🎉 SUCESSO!\n\n${leadsFacebookExtraidosPopup.length} contatos do grupo "${grupoFacebookAtualPopup}" foram enviados para o Litrão do Reset!\n\nAbra o seu painel para ver a lista atualizada.`);
        });
      });
    }

    if (btnCopiarFb) {
      btnCopiarFb.addEventListener('click', () => {
        if (!leadsFacebookExtraidosPopup.length) {
          alert('Nenhum membro extraído para copiar.');
          return;
        }
        navigator.clipboard.writeText(JSON.stringify(leadsFacebookExtraidosPopup, null, 2)).then(() => {
          alert(`✅ ${leadsFacebookExtraidosPopup.length} membros copiados para a área de transferência!`);
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFacebookExtractorPopup);
  } else {
    initFacebookExtractorPopup();
  }
