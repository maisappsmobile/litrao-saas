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

  // Identifica a aba ativa do WhatsApp Web
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isZap = tab && tab.url && tab.url.includes('web.whatsapp.com');

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

  btnExtrair.addEventListener('click', () => {
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
