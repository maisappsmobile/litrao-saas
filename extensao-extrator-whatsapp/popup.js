/**
 * ResetFIT - Automação WhatsApp Pro (Popup Controller v2.5.0)
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
          chrome.tabs.sendMessage(tab.id, { action: 'abrir_drawer_lateral' });
          window.close();
        }
      } catch (_) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { action: 'abrir_drawer_lateral' });
          window.close();
        }
      }
    });
  }

  const dotStatus = document.getElementById('dot-status');
  const txtStatus = document.getElementById('txt-status');
  if (!isZap) {
    dotStatus.style.background = '#EF4444';
    dotStatus.style.boxShadow = 'none';
    txtStatus.innerText = 'Abra o WhatsApp Web';
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

  if (isZap) carregarGrupos();

  btnRecarregarGrupos.addEventListener('click', carregarGrupos);

  selectGrupos.addEventListener('change', () => {
    const val = selectGrupos.value;
    if (val && val !== '__ATUAL__' && isZap) {
      chrome.tabs.sendMessage(tab.id, { action: 'abrir_conversa', nome: val }, () => {
        nomeGrupoAtual = val;
      });
    }
  });

  btnExtrair.addEventListener('click', async () => {
    if (tab) await garantirContentScript(tab.id);
    if (!isZap) return;
    btnExtrair.disabled = true;
    btnExtrair.innerText = '⏳ Rolando lista de participantes...';
    progressoExtracao.style.display = 'block';
    progressoFill.style.width = '20%';

    chrome.tabs.sendMessage(tab.id, { action: 'extrair_contatos', nomeGrupo: selectGrupos.value }, (res) => {
      btnExtrair.disabled = false;
      btnExtrair.innerText = '⚡ Extrair Novamente';
      progressoExtracao.style.display = 'none';

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

  // Sincronizar com o CRM ResetFIT
  btnSincronizarCrm.addEventListener('click', async () => {
    if (contatosExtraidos.length === 0) return;

    btnSincronizarCrm.innerText = '⏳ Sincronizando...';

    const pacote = {
      origem: 'ResetFIT Pro v2.5.0',
      grupo: nomeGrupoAtual,
      criadoEm: new Date().toISOString(),
      total: contatosExtraidos.length,
      leads: contatosExtraidos,
      contatos: contatosExtraidos,
      membros: contatosExtraidos
    };

    // Baixa o JSON universal
    const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_resetfit_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Copia lista para a área de transferência
    let txtClip = `${nomeGrupoAtual}\n`;
    contatosExtraidos.forEach(c => {
      txtClip += `${c.nome || 'Contato'};${c.telefone || ''};${c.grupo || nomeGrupoAtual}\n`;
    });
    navigator.clipboard.writeText(txtClip).catch(() => {});

    btnSincronizarCrm.innerText = '✅ Sincronizado!';
    setTimeout(() => { btnSincronizarCrm.innerText = '🚀 Sincronizar com Meu CRM ResetFIT'; }, 2500);

    alert(`Sucesso! ${contatosExtraidos.length} contatos exportados.\n\nO arquivo JSON foi baixado e a lista foi copiada para a sua área de transferência!\n\nNo Painel ResetFIT -> Importar Contatos, selecione o arquivo baixado ou cole com Ctrl+V.`);
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
              if (res && res.sucesso) {
                alert(`Foto/Vídeo "${msg.titulo}" enviada na conversa ativa!`);
              } else {
                alert('Aviso: ' + ((res && res.erro) || 'Verifique se uma conversa está aberta.'));
              }
            });
          } else {
            chrome.tabs.sendMessage(tab.id, { action: 'enviar_texto_chat', texto: msg.texto }, () => {
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
