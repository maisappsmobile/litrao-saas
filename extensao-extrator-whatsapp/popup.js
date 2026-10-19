/**
 * Litrão do Reset - WhatsApp SuperSuite (Popup Controller v2.1)
 * Inclui: Extrator Completo, Mensagens Rápidas, Sequências, Áudios, Disparo em Massa, Autoresponder e Backup
 */

// Mensagens Rápidas Padrão Validadas para o Litrão do Reset
const MENSAGENS_PADRAO = [
  {
    id: 'msg_1',
    titulo: '🥤 Convite Litrão do Reset',
    texto: 'Olá {nome}, tudo bem? Passando para te apresentar o método do Litrão do Reset! Nossa garrafa turbinada de 1 Litro que ajuda a desinchar, eliminar retenção e dá energia limpa o dia todo. Quer experimentar essa semana?'
  },
  {
    id: 'msg_2',
    titulo: '🧪 Degustação Grátis no Espaço (EVS)',
    texto: 'Oi {nome}! Gostaria de te convidar para passar no nosso Espaço Vida Saudável e degustar gratuitamente uma dose do Litrão do Reset! Qual dia fica melhor pra você, hoje ou amanhã?'
  },
  {
    id: 'msg_3',
    titulo: '📋 Link de Bioimpedância / Avaliação',
    texto: 'Olá {nome}! Preparei um formulário rápido de avaliação corporal gratuita para calcularmos seu metabolismo e sua meta de hidratação. Posso te enviar o link?'
  },
  {
    id: 'msg_4',
    titulo: '💰 Tabela de Preços & Pacote Semanal',
    texto: 'Oi {nome}! O nosso Kit Semanal do Litrão do Reset inclui 5 garrafas completas (mix de Chá Verde, Fibras e Energia). O valor da dose individual é R$ 25,00 ou o pacote semanal completo por apenas R$ 115,00! Como prefere receber?'
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

  function carregarGrupos() {
    if (!isZap) return;
    chrome.tabs.sendMessage(tab.id, { action: 'listar_conversas' }, (res) => {
      if (!res || !res.sucesso) return;
      selectGrupos.innerHTML = '';
      const optAtual = document.createElement('option');
      optAtual.value = '__ATUAL__';
      const grupoAberto = (res.infoAtual && res.infoAtual.nomeGrupo) ? res.infoAtual.nomeGrupo : '';
      nomeGrupoAtual = grupoAberto || 'Grupo Selecionado';
      optAtual.textContent = grupoAberto ? `⚡ Aberto agora: ${grupoAberto}` : '⚡ Conversa aberta na tela';
      selectGrupos.appendChild(optAtual);

      if (res.conversas) {
        res.conversas.forEach(c => {
          if (c.nome && c.nome !== grupoAberto) {
            const opt = document.createElement('option');
            opt.value = c.nome;
            opt.textContent = (c.isGrupo ? '👥 ' : '💬 ') + c.nome;
            selectGrupos.appendChild(opt);
          }
        });
      }
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

  // Sincronizar com o Kanban do Litrão
  btnSincronizarCrm.addEventListener('click', async () => {
    if (contatosExtraidos.length === 0) return;

    btnSincronizarCrm.innerText = '⏳ Sincronizando...';

    const pacote = {
      origem: 'WhatsApp SuperSuite v2.1',
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
    a.download = `leads_kanban_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
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
    setTimeout(() => { btnSincronizarCrm.innerText = '🚀 Sincronizar com Meu Kanban do Litrão'; }, 2500);

    alert(`Sucesso! ${contatosExtraidos.length} contatos exportados.\n\nO arquivo JSON compatível foi baixado e os contatos foram copiados para a área de transferência!\n\nNo Painel do Consultor -> Abrir CRM Kanban -> Importar Contatos, selecione o arquivo baixado ou cole com Ctrl+V.`);
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
  const formMsg = document.getElementById('form-msg-rapida');
  const btnSalvarMsg = document.getElementById('btn-salvar-msg-rapida');
  const btnCancelarMsg = document.getElementById('btn-cancelar-msg-rapida');
  const inputMsgTitulo = document.getElementById('input-msg-titulo');
  const inputMsgTexto = document.getElementById('input-msg-texto');

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
      row.innerHTML = `
        <div style="overflow: hidden;">
          <div class="item-title">${m.titulo}</div>
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
          chrome.tabs.sendMessage(tab.id, { action: 'enviar_texto_chat', texto: msg.texto }, () => {
            alert(`Mensagem "${msg.titulo}" enviada na conversa ativa!`);
          });
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
    inputMsgTitulo.focus();
  });

  btnCancelarMsg.addEventListener('click', () => {
    formMsg.style.display = 'none';
    inputMsgTitulo.value = '';
    inputMsgTexto.value = '';
  });

  btnSalvarMsg.addEventListener('click', () => {
    const tit = inputMsgTitulo.value.trim();
    const txt = inputMsgTexto.value.trim();
    if (!tit || !txt) {
      alert("Preencha título e texto.");
      return;
    }
    const msgs = obterMensagensSalvas();
    msgs.push({ id: 'msg_' + Date.now(), titulo: tit, texto: txt });
    salvarMensagens(msgs);
    formMsg.style.display = 'none';
    inputMsgTitulo.value = '';
    inputMsgTexto.value = '';
  });


  // ==========================================
  // SEQUÊNCIAS DE ENVIOS COM 1 CLIQUE
  // ==========================================
  const SEQUENCIAS_PADRAO = [
    {
      id: 'seq_1',
      titulo: '🥤 Apresentação Completa Litrão (3 Passos)',
      passos: [
        { texto: 'Olá {nome}, tudo bem? Passando para te contar sobre o método do Litrão do Reset!', delay: 3 },
        { texto: 'Nossa receita turbinada de 1 Litro leva Chá Verde, Fibras e Energia limpa. Ajuda a desinchar, queimar retenção e dá muita disposição!', delay: 4 },
        { texto: 'Você prefere que eu te mande os sabores ou quer passar no nosso Espaço para provar uma dose gratuita hoje?', delay: 0 }
      ]
    },
    {
      id: 'seq_2',
      titulo: '🧪 Convite Degustação Grátis EVS (3 Passos)',
      passos: [
        { texto: 'Oi {nome}, tudo bem por aí?', delay: 3 },
        { texto: 'Estamos selecionando algumas pessoas para provar gratuitamente o Litrão do Reset aqui no nosso Espaço Vida Saudável!', delay: 4 },
        { texto: 'Qual horário fica melhor pra você passar aqui, no almoço ou no final da tarde?', delay: 0 }
      ]
    },
    {
      id: 'seq_3',
      titulo: '💰 Fechamento de Venda & Pagamento Pix (2 Passos)',
      passos: [
        { texto: 'Maravilha, {nome}! Seu pedido do Kit do Litrão do Reset está registrado!', delay: 3 },
        { texto: 'Você pode realizar o Pix para a nossa chave: {chave_pix}\nAssim que fizer, me manda o comprovante que já preparo o seu kit bem geladinho!', delay: 0 }
      ]
    },
    {
      id: 'seq_4',
      titulo: '⏳ Reativação de Contatos Sumidos (2 Passos)',
      passos: [
        { texto: 'Oi {nome}, como você está? Lembrei de você hoje!', delay: 3 },
        { texto: 'Chegou uma receita nova do Litrão super refrescante para essa semana! Como andam suas metas de hidratação?', delay: 0 }
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
        passosHtml += `<span class="tag tag-blue" title="${p.texto}">P${pIdx + 1} (${p.delay}s)</span> `;
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

  function adicionarCampoPassoForm(textoPadrao = '', delayPadrao = 3) {
    const div = document.createElement('div');
    div.style.background = '#1E293B';
    div.style.padding = '8px';
    div.style.borderRadius = '6px';
    div.style.border = '1px solid #334155';

    div.innerHTML = `
      <textarea rows="2" placeholder="Mensagem deste passo (use {nome})" class="passo-texto" style="margin-bottom: 4px;">${textoPadrao}</textarea>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
        <span style="font-size: 10px; color: #94A3B8;">Aguardar após enviar (segundos):</span>
        <input type="number" value="${delayPadrao}" min="0" max="60" class="passo-delay" style="width: 60px; margin-bottom: 0; padding: 4px;">
        <button type="button" class="btn btn-dark btn-small btn-remover-passo" style="padding: 2px 6px;">✕</button>
      </div>
    `;

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
      const textos = containerPassosForm.querySelectorAll('.passo-texto');
      const delays = containerPassosForm.querySelectorAll('.passo-delay');

      const passos = [];
      textos.forEach((tEl, idx) => {
        const txt = tEl.value.trim();
        const del = parseInt(delays[idx].value) || 0;
        if (txt) {
          passos.push({ texto: txt, delay: del });
        }
      });

      if (passos.length === 0) {
        alert("Adicione pelo menos 1 passo com mensagem.");
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
    a.download = `backup_zapplus_litrao_${new Date().toISOString().slice(0, 10)}.json`;
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
