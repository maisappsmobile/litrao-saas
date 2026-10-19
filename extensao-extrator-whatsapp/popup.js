/**
 * Litrão do Reset - Extrator WhatsApp Web (Popup Controller v2.0)
 * Suporte a Seleção de Grupos (Print 4) e Sincronização Inteligente
 */

let contatosExtraidos = [];
let nomeGrupoAtual = '';

document.addEventListener('DOMContentLoaded', async () => {
  const dotStatus = document.getElementById('dot-status');
  const txtStatus = document.getElementById('txt-status');
  const selectGrupos = document.getElementById('select-grupos-whatsapp');
  const btnRecarregarGrupos = document.getElementById('btn-recarregar-grupos');
  const btnExtrair = document.getElementById('btn-extrair');
  const progress = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const msgFeedback = document.getElementById('msg-feedback');
  const resultBox = document.getElementById('result-box');
  const totalExtraidos = document.getElementById('total-extraidos');
  const totalComTel = document.getElementById('total-com-tel');
  const btnEnviarCrm = document.getElementById('btn-enviar-crm');
  const btnBaixarJson = document.getElementById('btn-baixar-json');
  const btnBaixarCsv = document.getElementById('btn-baixar-csv');
  const btnCopiar = document.getElementById('btn-copiar');

  // Identifica a aba ativa
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('web.whatsapp.com')) {
    dotStatus.className = 'dot';
    txtStatus.innerText = 'Abra o WhatsApp Web nesta aba';
    btnExtrair.disabled = true;
    return;
  }

  // Função para carregar grupos no select
  function carregarListaDeGrupos() {
    chrome.tabs.sendMessage(tab.id, { action: 'listar_conversas' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.sucesso) {
        dotStatus.className = 'dot active';
        txtStatus.innerText = 'WhatsApp Web conectado. Abra o grupo!';
        btnExtrair.disabled = false;
        return;
      }

      dotStatus.className = 'dot active';
      txtStatus.innerText = 'Pronto para extração';
      btnExtrair.disabled = false;

      // Popula o select de grupos
      selectGrupos.innerHTML = '';
      const optAtual = document.createElement('option');
      optAtual.value = '__ATUAL__';
      
      const grupoAberto = (res.infoAtual && res.infoAtual.nomeGrupo) ? res.infoAtual.nomeGrupo : '';
      nomeGrupoAtual = grupoAberto || 'Grupo Selecionado';
      optAtual.textContent = grupoAberto ? `⚡ Aberto agora: ${grupoAberto}` : '⚡ Conversa aberta na tela';
      selectGrupos.appendChild(optAtual);

      if (res.conversas && res.conversas.length > 0) {
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

  carregarListaDeGrupos();

  // Recarregar conversas manualmente
  btnRecarregarGrupos.addEventListener('click', () => {
    btnRecarregarGrupos.style.transform = 'rotate(180deg)';
    setTimeout(() => { btnRecarregarGrupos.style.transform = 'none'; }, 400);
    carregarListaDeGrupos();
  });

  // Ao mudar de grupo no select, abre a conversa automaticamente no WhatsApp Web
  selectGrupos.addEventListener('change', () => {
    const val = selectGrupos.value;
    if (val && val !== '__ATUAL__') {
      txtStatus.innerText = `Abrindo: ${val}...`;
      chrome.tabs.sendMessage(tab.id, { action: 'abrir_conversa', nome: val }, (res) => {
        if (res && res.sucesso) {
          nomeGrupoAtual = val;
          txtStatus.innerText = `Pronto para extrair: ${val}`;
        }
      });
    }
  });

  // Clique no botão Extrair
  btnExtrair.addEventListener('click', () => {
    btnExtrair.disabled = true;
    btnExtrair.innerHTML = '<span>⏳ Extraindo todos os membros...</span>';
    progress.style.display = 'block';
    progressFill.style.width = '15%';
    msgFeedback.style.display = 'block';
    msgFeedback.innerText = 'Rolando lista de participantes...';

    const grupoSelecionado = selectGrupos.value;

    chrome.tabs.sendMessage(tab.id, { action: 'extrair_contatos', nomeGrupo: grupoSelecionado }, (response) => {
      progressFill.style.width = '100%';
      setTimeout(() => { 
        progress.style.display = 'none'; 
        msgFeedback.style.display = 'none';
      }, 500);

      btnExtrair.disabled = false;
      btnExtrair.innerHTML = '<span>⚡ Extrair Novamente</span>';

      if (!response || !response.sucesso) {
        alert('Erro ao extrair: ' + ((response && response.erro) || 'Verifique se o grupo está aberto no WhatsApp.'));
        return;
      }

      contatosExtraidos = response.contatos || response.leads || [];
      nomeGrupoAtual = response.nomeGrupo || nomeGrupoAtual || 'Grupo WhatsApp';

      const comTelefone = contatosExtraidos.filter(c => c.telefone && c.telefone.length >= 8);

      totalExtraidos.innerText = contatosExtraidos.length;
      totalComTel.innerText = comTelefone.length;
      resultBox.style.display = 'block';
    });
  });

  // Ouvinte de progresso dinâmico
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'progresso_extracao') {
      btnExtrair.innerHTML = `<span>⏳ Extraindo... (${msg.contagem} membros)</span>`;
      msgFeedback.innerText = `${msg.contagem} participantes encontrados até agora...`;
      progressFill.style.width = Math.min(95, Math.max(20, msg.contagem * 2)) + '%';
    }
  });

  // Botão 1: Sincronizar com o CRM Kanban (Automático)
  btnEnviarCrm.addEventListener('click', async () => {
    if (contatosExtraidos.length === 0) return;

    btnEnviarCrm.innerHTML = '⏳ Sincronizando...';

    // 1. Gera e baixa o arquivo JSON estruturado e compatível com o Kanban
    const pacoteDados = {
      origem: 'WhatsApp Web Extractor v2.0',
      grupo: nomeGrupoAtual,
      criadoEm: new Date().toISOString(),
      total: contatosExtraidos.length,
      leads: contatosExtraidos,
      contatos: contatosExtraidos,
      membros: contatosExtraidos
    };

    const jsonStr = JSON.stringify(pacoteDados, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_kanban_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 2. Copia para a área de transferência no formato pronto
    let textoClipboard = `${nomeGrupoAtual}\n`;
    contatosExtraidos.forEach(c => {
      textoClipboard += `${c.nome || 'Contato'};${c.telefone || ''};${c.grupo || nomeGrupoAtual}\n`;
    });
    navigator.clipboard.writeText(textoClipboard).catch(() => {});

    // 3. Procura abas abertas do Painel do Consultor para sincronizar direto
    try {
      const painelTabs = await chrome.tabs.query({ url: ['*://*.litraodoreset.com.br/*', '*://*/painel.html*'] });
      if (painelTabs && painelTabs.length > 0) {
        // Envia mensagem para a aba do painel
        chrome.tabs.sendMessage(painelTabs[0].id, {
          action: 'importar_leads_extensao',
          dados: pacoteDados
        }, () => {});
      }
    } catch (_) {}

    btnEnviarCrm.innerHTML = '✅ Arquivo Baixado e Lista Copiada!';
    setTimeout(() => {
      btnEnviarCrm.innerHTML = '🚀 Sincronizar com Meu Kanban do Litrão';
    }, 3000);

    alert(`Sucesso! ${contatosExtraidos.length} contatos foram exportados.\n\nO arquivo JSON foi baixado e a lista foi copiada para sua área de transferência!\n\nAgora no Painel do Consultor, basta clicar em "Importar Contatos" e selecionar o arquivo baixado ou colar o texto com Ctrl+V.`);
  });

  // Botão 2: Baixar JSON
  btnBaixarJson.addEventListener('click', () => {
    if (contatosExtraidos.length === 0) return;

    const pacoteDados = {
      origem: 'WhatsApp Web Extractor v2.0',
      grupo: nomeGrupoAtual,
      criadoEm: new Date().toISOString(),
      total: contatosExtraidos.length,
      leads: contatosExtraidos,
      contatos: contatosExtraidos,
      membros: contatosExtraidos
    };

    const blob = new Blob([JSON.stringify(pacoteDados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Botão 3: Baixar CSV
  btnBaixarCsv.addEventListener('click', () => {
    if (contatosExtraidos.length === 0) return;

    let csvContent = 'Nome;Telefone;WhatsApp Link;Grupo;ExtraidoEm;Admin\n';
    contatosExtraidos.forEach(c => {
      const tel = c.telefone || '';
      const linkWa = tel ? `https://wa.me/${tel.replace(/\D/g, '')}` : '';
      csvContent += `"${(c.nome || '').replace(/"/g, '""')}";"${tel}";"${linkWa}";"${(c.grupo || nomeGrupoAtual).replace(/"/g, '""')}";"${c.extraidoEm || ''}";"${c.isAdmin ? 'SIM' : 'NÃO'}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilha_contatos_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Botão 4: Copiar Lista formatada
  btnCopiar.addEventListener('click', () => {
    if (contatosExtraidos.length === 0) return;

    let texto = '';
    contatosExtraidos.forEach(c => {
      texto += `${c.nome || 'Contato'};${c.telefone || ''};${c.grupo || nomeGrupoAtual}\n`;
    });

    navigator.clipboard.writeText(texto).then(() => {
      btnCopiar.innerText = '✅ Lista Copiada!';
      setTimeout(() => { btnCopiar.innerText = '📋 Copiar Lista Pronta para o Kanban'; }, 2000);
      alert(`${contatosExtraidos.length} contatos copiados! Basta ir no Painel do Consultor -> Importar Contatos e colar com Ctrl + V.`);
    });
  });

});
