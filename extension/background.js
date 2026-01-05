/**
 * Background Service Worker
 * Gerencia eventos de instalação e coordenação.
 */

chrome.runtime.onInstalled.addListener(() => {
    console.log("Anti-Scam Extension Installed");
    
    // Inicializa storage se necessário (opcional, pois o module faz check lazy)
    chrome.storage.local.get(['global_stats'], (result) => {
        if (!result.global_stats) {
            chrome.storage.local.set({
                global_stats: {
                    ads_scanned: 0,
                    frauds_detected: 0
                }
            });
        }
    });
});

// Exemplo: Listener para mensagens do content script (se precisar comunicar com API externa futuramente)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CHECK_STATUS") {
        sendResponse({ status: "active" });
    }
    return true;
});
