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
   * Identifica a chave correta do localStorage para os leads do Facebook do SuperAdmin
   */
  function obterFacebookStorageKey() {
    let hid = '433005811';
    try {
      const authStr = localStorage.getItem('litrao_consultor_auth');
      if (authStr) {
        const parsed = JSON.parse(authStr);
        if (parsed && parsed.herbalife_id) {
          hid = String(parsed.herbalife_id).trim();
        }
      }
    } catch (e) {}
    return `litrao_facebook_leads_${hid}`;
  }

  /**
   * Processa o lote de contatos do Facebook e injeta na base do SuperAdmin
   */
  function processarPacoteFacebookLeads(pacote) {
    if (!pacote || !Array.isArray(pacote.leads) || pacote.leads.length === 0) {
      return { sucesso: false, erro: 'Pacote sem contatos' };
    }

    const storageKey = obterFacebookStorageKey();
    let leadsExistentes = [];
    try {
      const raw = localStorage.getItem(storageKey);
      leadsExistentes = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(leadsExistentes)) leadsExistentes = [];
    } catch (e) {
      leadsExistentes = [];
    }

    const nomesExistentes = new Set(
      leadsExistentes.map(l => String(l.nome || '').toLowerCase().trim()).filter(Boolean)
    );

    let novosCount = 0;
    let duplicadosCount = 0;
    const grupoNome = pacote.grupo || 'Grupo Facebook';

    pacote.leads.forEach(l => {
      const nomeTrim = String(l.nome || '').trim();
      if (!nomeTrim) return;

      if (nomesExistentes.has(nomeTrim.toLowerCase())) {
        duplicadosCount++;
        return;
      }

      const novoLead = {
        id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        nome: nomeTrim,
        perfilUrl: l.perfilUrl || `https://www.facebook.com/search/people/?q=${encodeURIComponent(nomeTrim)}`,
        grupoOrigem: l.grupoOrigem || grupoNome,
        cargo: l.cargo || 'membro',
        status: 'pendente',
        origemTag: 'Facebook Grupos',
        dataAdicionado: new Date().toLocaleDateString('pt-BR'),
        notas: `Extraído via Extensão ResetFIT (${grupoNome})`
      };

      leadsExistentes.unshift(novoLead);
      nomesExistentes.add(nomeTrim.toLowerCase());
      novosCount++;
    });

    try {
      localStorage.setItem(storageKey, JSON.stringify(leadsExistentes));
    } catch (errSalvar) {
      console.error('[ResetFIT Bridge] Erro ao gravar leads do Facebook:', errSalvar);
      return { sucesso: false, erro: errSalvar.message };
    }

    // Atualiza a tabela do Facebook no painel
    try {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            if (typeof window.renderizarTabelaLeadsFacebook === 'function') window.renderizarTabelaLeadsFacebook();
          } catch(e) {}
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch(e) {}

    if (novosCount > 0) {
      exibirToastFacebookSincronizacao(novosCount, grupoNome, duplicadosCount);
    }

    return { sucesso: true, novos: novosCount, duplicados: duplicadosCount };
  }

  function exibirToastFacebookSincronizacao(novosCount, grupoNome, duplicadosCount) {
    try {
      let toast = document.getElementById('toast-resetfit-fb-bridge');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-resetfit-fb-bridge';
        toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:linear-gradient(135deg, #1D4ED8, #4338CA);color:#fff;padding:14px 18px;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);border:1px solid rgba(96,165,250,0.4);display:flex;align-items:center;gap:12px;font-family:ui-sans-serif,system-ui,sans-serif;max-width:380px;';
        document.body.appendChild(toast);
      }

      const dupMsg = duplicadosCount > 0 ? `<br><span style="font-size:10px;opacity:0.8;">(${duplicadosCount} contatos já existentes foram mantidos)</span>` : '';

      toast.innerHTML = `
        <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
          📘
        </div>
        <div style="flex:1;">
          <h4 style="margin:0;font-size:13px;font-weight:800;color:#fff;">Facebook • Sincronização Concluída!</h4>
          <p style="margin:2px 0 0;font-size:11px;color:#DBEAFE;line-height:1.35;">
            <b>${novosCount} contatos</b> do grupo <b>"${grupoNome}"</b> foram adicionados aos seus Leads do Facebook!${dupMsg}
          </p>
        </div>
      `;
      toast.style.display = 'flex';

      setTimeout(() => {
        if (toast) toast.style.display = 'none';
      }, 7000);
    } catch(e) {}
  }

  /**
   * Verifica se há importação pendente gravada no chrome.storage
   */
  function checarImportacaoPendente() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    // 1. Checa pendência de WhatsApp CRM
    chrome.storage.local.get(['resetfit_crm_pending_import', 'resetfit_fb_pending_import'], (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.resetfit_crm_pending_import) {
        console.log('[ResetFIT Bridge] Lote WhatsApp pendente detectado:', res.resetfit_crm_pending_import);
        const resultado = processarPacoteCrm(res.resetfit_crm_pending_import);
        if (resultado.sucesso) {
          chrome.storage.local.remove(['resetfit_crm_pending_import']);
        }
      }

      // 2. Checa pendência de Facebook Leads
      if (res && res.resetfit_fb_pending_import) {
        console.log('[ResetFIT Bridge] Lote Facebook pendente detectado:', res.resetfit_fb_pending_import);
        const resultadoFb = processarPacoteFacebookLeads(res.resetfit_fb_pending_import);
        if (resultadoFb.sucesso) {
          chrome.storage.local.remove(['resetfit_fb_pending_import']);
        }
      }
    });
  }

  // Escuta mensagens em tempo real enviadas pela extensão
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.tipo === 'RESETFIT_SINCRONIZAR_CRM' && request.pacote) {
        console.log('[ResetFIT Bridge] Mensagem CRM recebida da extensão:', request.pacote);
        const resultado = processarPacoteCrm(request.pacote);
        sendResponse(resultado);
      } else if (request && request.tipo === 'RESETFIT_SINCRONIZAR_FACEBOOK' && request.pacote) {
        console.log('[ResetFIT Bridge] Mensagem Facebook recebida da extensão:', request.pacote);
        const resultadoFb = processarPacoteFacebookLeads(request.pacote);
        sendResponse(resultadoFb);
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
    } else if (event.data && event.data.tipo === 'RESETFIT_SINCRONIZAR_FACEBOOK' && event.data.pacote) {
      processarPacoteFacebookLeads(event.data.pacote);
    }
  });

})();
