/**
 * ResetFIT Pro - Ponte de Sincronização Automática com o Painel do Consultor
 * Injetado nas páginas do painel para receber contatos extraídos em tempo real
 * ou importar lotes pendentes assim que o painel for aberto.
 */

(function () {
  'use strict';

  // Evita carregamento duplicado no mesmo frame
  if (window.__RESETFIT_BRIDGE_LOADED__) return;
  window.__RESETFIT_BRIDGE_LOADED__ = true;

  console.log('[ResetFIT Bridge] Inicializando sincronizador do CRM...');

  /**
   * Identifica a chave correta do localStorage para o consultor atual
   */
  function obterCrmStorageKey() {
    let hid = 'geral';
    try {
      const authStr = localStorage.getItem('litrao_consultor_auth');
      if (authStr) {
        const parsed = JSON.parse(authStr);
        if (parsed && parsed.herbalife_id) {
          hid = String(parsed.herbalife_id).trim();
        }
      }
    } catch (e) {
      console.warn('[ResetFIT Bridge] Erro ao ler autenticação do consultor:', e);
    }
    return `litrao_crm_leads_${hid}`;
  }

  /**
   * Dispara atualização visual da UI no contexto principal da página
   */
  function atualizarUiPainelPrincipal() {
    try {
      // Dispara evento customizado para o DOM da página
      window.dispatchEvent(new CustomEvent('resetfit_crm_atualizado', { bubbles: true }));

      // Executa script no contexto global da página
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            if (typeof window.atualizarSelectGruposKanban === 'function') window.atualizarSelectGruposKanban();
            if (typeof window.renderizarKanbanCrm === 'function') window.renderizarKanbanCrm();
            if (typeof window.atualizarMetricasCardsCrm === 'function') window.atualizarMetricasCardsCrm();
          } catch(e) {
            console.warn('[ResetFIT Script] Falha ao atualizar UI nativa:', e);
          }
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (err) {
      console.warn('[ResetFIT Bridge] Erro ao disparar script de UI:', err);
    }
  }

  /**
   * Exibe notificação toast elegante no painel
   */
  function exibirToastSincronizacao(novosCount, grupoNome, duplicadosCount) {
    try {
      let toast = document.getElementById('toast-resetfit-crm-bridge');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-resetfit-crm-bridge';
        toast.className = 'fixed top-5 right-5 z-[999999] bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white px-5 py-4 rounded-2xl shadow-2xl border border-purple-400/40 flex items-center gap-3.5 transition-all transform duration-300 pointer-events-auto';
        toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:linear-gradient(135deg, #6B21A8, #3730A3);color:#fff;padding:14px 18px;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);border:1px solid rgba(168,85,247,0.4);display:flex;align-items:center;gap:12px;font-family:ui-sans-serif,system-ui,sans-serif;max-width:380px;';
        document.body.appendChild(toast);
      }

      const dupMsg = duplicadosCount > 0 ? `<br><span style="font-size:10px;opacity:0.8;">(${duplicadosCount} números já existentes foram ignorados)</span>` : '';

      toast.innerHTML = `
        <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
          🚀
        </div>
        <div style="flex:1;">
          <h4 style="margin:0;font-size:13px;font-weight:800;color:#fff;">ResetFIT • Sincronização Automática</h4>
          <p style="margin:2px 0 0;font-size:11px;color:#E9D5FF;line-height:1.35;">
            <b>${novosCount} contatos</b> do grupo <b>"${grupoNome || 'WhatsApp'}"</b> foram salvos no seu CRM Kanban!${dupMsg}
          </p>
        </div>
      `;
      toast.style.display = 'flex';

      setTimeout(() => {
        if (toast) toast.style.display = 'none';
      }, 7000);
    } catch (e) {
      console.warn('[ResetFIT Bridge] Erro ao renderizar toast:', e);
    }
  }

  /**
   * Processa o lote de contatos e injeta diretamente no CRM Kanban
   */
  function processarPacoteCrm(pacote) {
    if (!pacote || !Array.isArray(pacote.contatos) || pacote.contatos.length === 0) {
      return { sucesso: false, erro: 'Pacote sem contatos' };
    }

    const storageKey = obterCrmStorageKey();
    let leadsExistentes = [];
    try {
      const raw = localStorage.getItem(storageKey);
      leadsExistentes = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(leadsExistentes)) leadsExistentes = [];
    } catch (e) {
      leadsExistentes = [];
    }

    const telefonesExistentes = new Set(
      leadsExistentes.map(l => String(l.telefone || '').replace(/\D/g, '')).filter(Boolean)
    );

    let novosCount = 0;
    let duplicadosCount = 0;
    const grupoNome = pacote.grupo || 'Grupo WhatsApp';

    pacote.contatos.forEach((c, index) => {
      const telRaw = String(c.telefone || c.numero || '').trim();
      const telLimpo = telRaw.replace(/\D/g, '');

      if (!telLimpo) return;

      if (telefonesExistentes.has(telLimpo)) {
        duplicadosCount++;
        return;
      }

      const nomeFormatado = (c.nome || c.pushname || `Contato ${index + 1}`).replace(/~/g, '').trim();
      const novoLead = {
        id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        nome: nomeFormatado,
        telefone: telRaw,
        grupo: c.grupo || grupoNome,
        isAdmin: !!(c.isAdmin || c.admin),
        coluna: 'novos',
        dataAdicionado: new Date().toISOString(),
        notas: c.notas || ''
      };

      leadsExistentes.push(novoLead);
      telefonesExistentes.add(telLimpo);
      novosCount++;
    });

    try {
      localStorage.setItem(storageKey, JSON.stringify(leadsExistentes));
    } catch (errSalvar) {
      console.error('[ResetFIT Bridge] Erro ao gravar leads no localStorage:', errSalvar);
      return { sucesso: false, erro: errSalvar.message };
    }

    // Atualiza a interface
    atualizarUiPainelPrincipal();

    // Mostra feedback se adicionou algo
    if (novosCount > 0) {
      exibirToastSincronizacao(novosCount, grupoNome, duplicadosCount);
    }

    console.log(`[ResetFIT Bridge] Sucesso: ${novosCount} novos leads inseridos no CRM (${duplicadosCount} ignorados).`);
    return { sucesso: true, novos: novosCount, duplicados: duplicadosCount };
  }

  /**
   * Verifica se há importação pendente gravada no chrome.storage
   */
  function checarImportacaoPendente() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get(['resetfit_crm_pending_import'], (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.resetfit_crm_pending_import) {
        console.log('[ResetFIT Bridge] Lote pendente detectado ao abrir o painel:', res.resetfit_crm_pending_import);
        const resultado = processarPacoteCrm(res.resetfit_crm_pending_import);
        if (resultado.sucesso) {
          // Remove a pendência processada com sucesso
          chrome.storage.local.remove(['resetfit_crm_pending_import']);
        }
      }
    });
  }

  // Escuta mensagens em tempo real enviadas pelo popup da extensão
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.tipo === 'RESETFIT_SINCRONIZAR_CRM' && request.pacote) {
        console.log('[ResetFIT Bridge] Mensagem em tempo real recebida da extensão:', request.pacote);
        const resultado = processarPacoteCrm(request.pacote);
        sendResponse(resultado);
      }
      return true;
    });
  }

  // Executa checagem imediata e repete caso a página ainda estivesse terminando de renderizar
  checarImportacaoPendente();
  setTimeout(checarImportacaoPendente, 1500);
  setTimeout(checarImportacaoPendente, 4000);

  // Também expõe listener para postMessage (redundância total)
  window.addEventListener('message', (event) => {
    if (event.data && event.data.tipo === 'RESETFIT_SINCRONIZAR_CRM' && event.data.pacote) {
      processarPacoteCrm(event.data.pacote);
    }
  });

})();
