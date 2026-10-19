/**
 * Litrão do Reset - WhatsApp SuperSuite Pro (Background Service Worker)
 * Habilita Side Panel (Painel Lateral) nativo do Chrome
 */

// Permite abrir o Painel Lateral ao clicar no ícone da extensão
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    .catch((err) => console.log("SidePanel behavior note:", err));
}

// Ouve atalhos de teclado ou comandos de abertura
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Litrão SuperSuite] Extensão v2.2 instalada/atualizada com sucesso!");
});
