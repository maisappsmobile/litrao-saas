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
   * Normaliza um nome para comparação estrita (remove acentos, pontuação, múltiplos espaços e minúsculas)
   */
  function normalizarNomeParaComparacao(nome) {
    if (!nome) return '';
    return String(nome)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Extrai identificador único do perfil do Facebook para comparação estrita
   */
  function extrairIdentificadorPerfilFb(url) {
    if (!url) return '';
    const raw = String(url).trim();
    const matchId = raw.match(/[?&]id=(\d+)/i) || raw.match(/\/user\/(\d+)/i);
    if (matchId) return 'id_' + matchId[1];
    const limpa = raw.split('?')[0].replace(/\/+$/, '').toLowerCase();
    const matchUser = limpa.match(/facebook\.com\/([a-zA-Z0-9\.\_\-]+)/i);
    if (matchUser && !['groups', 'events', 'watch', 'pages', 'search', 'people'].includes(matchUser[1])) {
      return 'user_' + matchUser[1];
    }
    return limpa;
  }

  /**
   * Identifica a chave correta do localStorage para os leads do Facebook do SuperAdmin ou Consultor
   */
  function obterFacebookStorageKeys() {
    const keys = new Set(['litrao_facebook_leads_433005811', 'litrao_facebook_leads_superadmin']);
    try {
      const authStr = localStorage.getItem('litrao_consultor_auth');
      if (authStr) {
        const parsed = JSON.parse(authStr);
        if (parsed.id) {
          const limpo = String(parsed.id).replace(/\D/g, '');
          if (limpo) keys.add(`litrao_facebook_leads_${limpo}`);
        }
        if (parsed.herbalife_id) {
          const limpoH = String(parsed.herbalife_id).replace(/\D/g, '');
          if (limpoH) keys.add(`litrao_facebook_leads_${limpoH}`);
        }
      }
      // Procura qualquer chave já gravada que comece com litrao_facebook_leads_
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('litrao_facebook_leads_')) {
          keys.add(k);
        }
      }
    } catch (e) {}
    return Array.from(keys);
  }

  /**
   * Processa o lote de contatos do Facebook e injeta na base do SuperAdmin com Desduplicação Estrita Universal
   */
  function processarPacoteFacebookLeads(pacote) {
    if (!pacote || !Array.isArray(pacote.leads) || pacote.leads.length === 0) {
      return { sucesso: false, erro: 'Pacote sem contatos' };
    }

    const storageKeys = obterFacebookStorageKeys();
    const chavePrincipal = storageKeys[0] || 'litrao_facebook_leads_433005811';

    // Tenta obter base da memória global da página se já estiver carregada
    if (window.__resetfit_fb_leads_cache && Array.isArray(window.__resetfit_fb_leads_cache) && window.__resetfit_fb_leads_cache.length > 0) {
      leadsExistentes = window.__resetfit_fb_leads_cache;
    } else {
      try {
        // Tenta ler da chave principal ou da primeira que contenha dados
        for (const k of storageKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              leadsExistentes = parsed;
              break;
            }
          }
        }
      } catch (e) {
        leadsExistentes = [];
      }
    }

    // REGRA DE OURO ANTI-DUPLICAÇÃO:
    // Mapeia TODOS os contatos que já existem no painel, INDEPENDENTE da coluna/card em que estejam
    // (pendente, enviado, conversa, instalou). Nenhum contato existente pode ser duplicado!
    const nomesExistentesSet = new Set(
      leadsExistentes.map(l => normalizarNomeParaComparacao(l.nome)).filter(Boolean)
    );

    const perfisExistentesSet = new Set(
      leadsExistentes.map(l => extrairIdentificadorPerfilFb(l.perfilUrl)).filter(Boolean)
    );

    let novosCount = 0;
    let duplicadosCount = 0;
    const grupoNome = pacote.grupo || 'Grupo Facebook';
    const publicoPacote = pacote.publico || 'Consultor';

    // Registra o público no histórico do painel para popular os filtros do Kanban
    try {
      const publicosSalvos = new Set(['Consultor', 'Cliente', 'Público Geral']);
      const rawPub = localStorage.getItem('litrao_facebook_publicos');
      if (rawPub) {
        const parsed = JSON.parse(rawPub);
        if (Array.isArray(parsed)) parsed.forEach(p => publicosSalvos.add(p));
      }
      if (publicoPacote) publicosSalvos.add(publicoPacote);
      localStorage.setItem('litrao_facebook_publicos', JSON.stringify(Array.from(publicosSalvos)));
    } catch(ePub) {}

    pacote.leads.forEach(l => {
      const nomeTrim = String(l.nome || '').trim();
      if (!nomeTrim) return;

      const nomeNorm = normalizarNomeParaComparacao(nomeTrim);
      const perfilNorm = extrairIdentificadorPerfilFb(l.perfilUrl);
      const publicoFinal = l.publico || publicoPacote || 'Consultor';

      // Se já existir por nome OU por identificador de perfil em QUALQUER etapa do CRM, NÃO DUPLICA!
      const leadExistente = leadsExistentes.find(exist => 
        normalizarNomeParaComparacao(exist.nome) === nomeNorm || 
        (perfilNorm && extrairIdentificadorPerfilFb(exist.perfilUrl) === perfilNorm)
      );

      if (leadExistente) {
        // Se o lead existente ainda não tiver público, anexa o público agora
        if (!leadExistente.publico || leadExistente.publico === 'Público Geral') {
          leadExistente.publico = publicoFinal;
        }
        duplicadosCount++;
        return;
      }

      const novoLead = {
        id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        nome: nomeTrim,
        perfilUrl: l.perfilUrl || `https://www.facebook.com/search/people/?q=${encodeURIComponent(nomeTrim)}`,
        grupoOrigem: l.grupoOrigem || grupoNome,
        publico: publicoFinal,
        cargo: l.cargo || 'membro',
        status: 'pendente',
        origemTag: 'Facebook Grupos',
        dataAdicionado: new Date().toLocaleDateString('pt-BR'),
        notas: `Extraído via Extensão ResetFIT (${grupoNome}) • Público: ${publicoFinal}`
      };

      leadsExistentes.unshift(novoLead);
      if (nomeNorm) nomesExistentesSet.add(nomeNorm);
      if (perfilNorm) perfisExistentesSet.add(perfilNorm);
      novosCount++;
    });

    // 1. Grava no IndexedDB de Alta Capacidade (suporta centenas de milhares de leads sem limite de cota)
    try {
      if (window.indexedDB) {
        const reqIdb = window.indexedDB.open('ResetFitDatabase_Leads', 1);
        reqIdb.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('facebook_leads')) {
            db.createObjectStore('facebook_leads', { keyPath: 'id' });
          }
        };
        reqIdb.onsuccess = (e) => {
          try {
            const db = e.target.result;
            const tx = db.transaction('facebook_leads', 'readwrite');
            const store = tx.objectStore('facebook_leads');
            store.clear();
            leadsExistentes.forEach(l => {
              if (l && l.id) store.put(l);
            });
            console.log(`[ResetFIT Bridge] ${leadsExistentes.length} leads salvos no IndexedDB!`);
          } catch(errTx) {
            console.warn('[ResetFIT Bridge] Erro tx IndexedDB:', errTx);
          }
        };
      }
    } catch(errIdb) {
      console.warn('[ResetFIT Bridge] IndexedDB indisponível no frame:', errIdb);
    }

    // 2. Grava amostra segura no localStorage para não estourar a cota de 5MB
    try {
      const amostra = leadsExistentes.length > 2000 ? leadsExistentes.slice(0, 1000) : leadsExistentes;
      const jsonAmostra = JSON.stringify(amostra);
      storageKeys.forEach(k => {
        try { localStorage.setItem(k, jsonAmostra); } catch (_) {}
      });
      try {
        localStorage.setItem('litrao_facebook_leads_total_real', String(leadsExistentes.length));
      } catch (_) {}
    } catch (errSalvar) {
      console.warn('[ResetFIT Bridge] Erro ao gravar amostra no localStorage:', errSalvar);
    }

    // Atualiza a tabela do Facebook no painel
    try {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            if (window.__resetfit_fb_leads_cache) {
              window.__resetfit_fb_leads_cache = null;
            }
            if (typeof window.ResetFitDB !== 'undefined' && typeof window.ResetFitDB.obterTodos === 'function') {
              window.ResetFitDB.obterTodos().then(dados => {
                if (dados && dados.length > 0) window.__resetfit_fb_leads_cache = dados;
                if (typeof window.renderizarTabelaLeadsFacebook === 'function') window.renderizarTabelaLeadsFacebook();
              });
            } else if (typeof window.renderizarTabelaLeadsFacebook === 'function') {
              window.renderizarTabelaLeadsFacebook();
            }
          } catch(e) {}
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch(e) {}

    if (novosCount > 0 || duplicadosCount > 0) {
      exibirToastFacebookSincronizacao(novosCount, grupoNome, duplicadosCount, publicoPacote);
    }

    return { sucesso: true, novos: novosCount, duplicados: duplicadosCount, publico: publicoPacote };
  }

  function exibirToastFacebookSincronizacao(novosCount, grupoNome, duplicadosCount, publicoPacote = 'Consultor') {
    try {
      let toast = document.getElementById('toast-resetfit-fb-bridge');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-resetfit-fb-bridge';
        toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:linear-gradient(135deg, #1D4ED8, #4338CA);color:#fff;padding:14px 18px;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);border:1px solid rgba(96,165,250,0.4);display:flex;align-items:center;gap:12px;font-family:ui-sans-serif,system-ui,sans-serif;max-width:400px;';
        document.body.appendChild(toast);
      }

      const dupMsg = duplicadosCount > 0 ? `<br><span style="font-size:10px;opacity:0.9;color:#BAE6FD;">🛡️ <b>${duplicadosCount} contatos já existentes</b> foram mantidos intactos em suas etapas (sem repetição).</span>` : '';

      toast.innerHTML = `
        <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
          📘
        </div>
        <div style="flex:1;">
          <h4 style="margin:0;font-size:13px;font-weight:800;color:#fff;">Facebook • Sincronização Concluída!</h4>
          <p style="margin:2px 0 0;font-size:11px;color:#DBEAFE;line-height:1.35;">
            <b>${novosCount} novos contatos</b> adicionados ao grupo <b>"${publicoPacote}"</b> no Kanban (origem: <i>${grupoNome}</i>)!${dupMsg}
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

  // Escuta alterações de storage para atualizar imediatamente qualquer aba aberta do painel
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.resetfit_fb_pending_import && changes.resetfit_fb_pending_import.newValue) {
          console.log('[ResetFIT Bridge] onChanged detectou novos leads do Facebook!');
          checarImportacaoPendente();
        }
        if (changes.resetfit_crm_pending_import && changes.resetfit_crm_pending_import.newValue) {
          console.log('[ResetFIT Bridge] onChanged detectou novos contatos do CRM!');
          checarImportacaoPendente();
        }
      }
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
