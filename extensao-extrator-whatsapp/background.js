/**
 * ResetFIT - Automação WhatsApp & Facebook Pro (Background Service Worker)
 * Habilita Side Panel (Painel Lateral) nativo do Chrome e sincronização multi-abas
 */

// Permite abrir o Painel Lateral ao clicar no ícone da extensão
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    .catch((err) => console.log("SidePanel behavior note:", err));
}

// Ouve atalhos de teclado ou comandos de abertura
chrome.runtime.onInstalled.addListener(() => {
  console.log("[ResetFIT Pro] Extensão v2.7.2 pronta e ativa!");
});

// Repassa mensagens de sincronização para todas as abas abertas do painel em tempo real
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && (request.tipo === 'RESETFIT_SINCRONIZAR_FACEBOOK' || request.tipo === 'RESETFIT_SINCRONIZAR_CRM')) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && (!sender.tab || tab.id !== sender.tab.id)) {
          chrome.tabs.sendMessage(tab.id, request, () => {
            // Silencia erro se a aba não for do painel ou não tiver content script
            if (chrome.runtime.lastError) { /* silencia intencionalmente */ }
          });
        }
      });
    });
    sendResponse({ recebido: true });
    return true; // Retorna true apenas quando há resposta assíncrona
  }
  
  // Para qualquer outra mensagem não tratada por este worker, retorna false para não segurar a porta aberta
  return false;
});
