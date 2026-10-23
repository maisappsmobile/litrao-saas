/**
 * ResetFIT - Automação WhatsApp Pro (Background Service Worker)
 * Habilita Side Panel (Painel Lateral) nativo do Chrome
 */

// Permite abrir o Painel Lateral ao clicar no ícone da extensão
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    .catch((err) => console.log("SidePanel behavior note:", err));
}

// Ouve atalhos de teclado ou comandos de abertura
chrome.runtime.onInstalled.addListener(() => {
  console.log("[ResetFIT Pro] Extensão v2.5.0 instalada/atualizada com sucesso!");
});

// Repassa mensagens de sincronização para todas as abas abertas do painel em tempo real
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && (request.tipo === 'RESETFIT_SINCRONIZAR_FACEBOOK' || request.tipo === 'RESETFIT_SINCRONIZAR_CRM')) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && (!sender.tab || tab.id !== sender.tab.id)) {
          chrome.tabs.sendMessage(tab.id, request).catch(() => {});
        }
      });
    });
    sendResponse({ recebido: true });
  }
  return true;
});
