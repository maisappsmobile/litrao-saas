/**
 * Litrão do Reset - Extrator WhatsApp Web (Popup Controller)
 */

let contatosExtraidos = [];
let nomeGrupoAtual = '';

document.addEventListener('DOMContentLoaded', async () => {
  const dotStatus = document.getElementById('dot-status');
  const txtStatus = document.getElementById('txt-status');
  const groupDisplay = document.getElementById('group-display');
  const btnExtrair = document.getElementById('btn-extrair');
  const progress = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const resultBox = document.getElementById('result-box');
  const totalExtraidos = document.getElementById('total-extraidos');
  const totalComTel = document.getElementById('total-com-tel');
  const btnEnviarCrm = document.getElementById('btn-enviar-crm');
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

  // Consulta o content script
  try {
    chrome.tabs.sendMessage(tab.id, { action: 'verificar_status' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.sucesso) {
        dotStatus.className = 'dot active';
        txtStatus.innerText = 'WhatsApp Web conectado. Abra um grupo!';
        btnExtrair.disabled = false;
        return;
      }

      dotStatus.className = 'dot active';
      txtStatus.innerText = 'Pronto para extração';
      btnExtrair.disabled = false;

      if (response.info && response.info.nomeGrupo) {
        nomeGrupoAtual = response.info.nomeGrupo;
        groupDisplay.innerText = `Grupo: ${nomeGrupoAtual}`;
        groupDisplay.style.display = 'block';
      }
    });
  } catch (err) {
    dotStatus.className = 'dot active';
    txtStatus.innerText = 'WhatsApp Web detectado';
    btnExtrair.disabled = false;
  }

  // Clique no botão Extrair
  btnExtrair.addEventListener('click', () => {
    btnExtrair.disabled = true;
    btnExtrair.innerHTML = '<span>⏳ Extraindo participantes...</span>';
    progress.style.display = 'block';
    progressFill.style.width = '30%';

    chrome.tabs.sendMessage(tab.id, { action: 'extrair_contatos' }, (response) => {
      progressFill.style.width = '100%';
      setTimeout(() => { progress.style.display = 'none'; }, 400);

      btnExtrair.disabled = false;
      btnExtrair.innerHTML = '<span>⚡ Extrair Novamente</span>';

      if (!response || !response.sucesso) {
        alert('Erro ao extrair: ' + ((response && response.erro) || 'Verifique se o grupo está aberto na tela.'));
        return;
      }

      contatosExtraidos = response.contatos || [];
      nomeGrupoAtual = response.nomeGrupo || nomeGrupoAtual || 'Grupo WhatsApp';

      const comTelefone = contatosExtraidos.filter(c => c.telefone && c.telefone.length >= 8);

      totalExtraidos.innerText = contatosExtraidos.length;
      totalComTel.innerText = comTelefone.length;
      resultBox.style.display = 'block';
    });
  });

  // Ouvinte de progresso
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'progresso_extracao') {
      btnExtrair.innerHTML = `<span>⏳ Extraindo... (${msg.contagem} encontrados)</span>`;
      progressFill.style.width = Math.min(95, (msg.contagem * 2)) + '%';
    }
  });

  // Botão: Sincronizar com o CRM Kanban
  btnEnviarCrm.addEventListener('click', () => {
    if (contatosExtraidos.length === 0) return;

    // Salva no storage do Chrome
    chrome.storage.local.set({
      'litrao_crm_leads_importados': {
        grupo: nomeGrupoAtual,
        data: new Date().toISOString(),
        leads: contatosExtraidos
      }
    });

    // Baixa arquivo JSON otimizado com formato do Kanban para importar com 1 clique
    const jsonStr = JSON.stringify({
      origem: 'WhatsApp Web Extractor',
      grupo: nomeGrupoAtual,
      criadoEm: new Date().toISOString(),
      leads: contatosExtraidos
    }, null, 2);

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_kanban_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    btnEnviarCrm.innerHTML = '✅ Arquivo Pronto! Importe no Painel com 1 clique';
    setTimeout(() => {
      btnEnviarCrm.innerHTML = '🚀 Sincronizar com Meu Kanban do Litrão';
    }, 2500);
  });

  // Botão: Baixar CSV
  btnBaixarCsv.addEventListener('click', () => {
    if (contatosExtraidos.length === 0) return;

    let csvContent = 'Nome;Telefone;WhatsApp Link;Grupo;ExtraidoEm;Admin\n';
    contatosExtraidos.forEach(c => {
      const tel = c.telefone || '';
      const linkWa = tel ? `https://wa.me/${tel}` : '';
      csvContent += `"${(c.nome || '').replace(/"/g, '""')}";"${tel}";"${linkWa}";"${(c.grupoOrigem || '').replace(/"/g, '""')}";"${c.extraidoEm}";"${c.isAdmin ? 'SIM' : 'NÃO'}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${nomeGrupoAtual.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Botão: Copiar Lista
  btnCopiar.addEventListener('click', () => {
    if (contatosExtraidos.length === 0) return;

    const lista = contatosExtraidos
      .filter(c => c.telefone)
      .map(c => `${c.nome}: +${c.telefone}`)
      .join('\n');

    navigator.clipboard.writeText(lista).then(() => {
      btnCopiar.innerText = '✅ Copiado!';
      setTimeout(() => { btnCopiar.innerText = '📋 Copiar Lista'; }, 1800);
    });
  });
});
