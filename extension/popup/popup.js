/**
 * Popup Logic
 * Mostra estatísticas e histórico recente.
 */

document.addEventListener('DOMContentLoaded', updateUI);

function updateUI() {
    chrome.storage.local.get(null, (items) => {
        let total = 0;
        let suspicious = 0;
        const history = [];

        for (const [key, val] of Object.entries(items)) {
            if (val.score !== undefined) {
                total++;
                if (val.score < 40) suspicious++;
                
                // Adiciona ao histórico (limitado aos últimos 10)
                history.push({ id: key, ...val });
            }
        }

        // Ordena por vistos recentemente
        history.sort((a, b) => b.last_seen - a.last_seen);
        
        // Atualiza Stats
        document.getElementById('total-ads').innerText = total;
        document.getElementById('fraud-ads').innerText = suspicious;

        // Atualiza Lista
        const listEl = document.getElementById('history-list');
        listEl.innerHTML = '';
        
        history.slice(0, 10).forEach(item => {
            const li = document.createElement('li');
            li.className = `history-item ${item.score < 40 ? 'suspicious' : 'safe'}`;
            
            const date = new Date(item.last_seen).toLocaleTimeString();
            li.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span>Score: ${item.score}</span>
                    <span style="color:#aaa">${date}</span>
                </div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
                    ID: ${item.id.substring(0, 8)}...
                </div>
            `;
            listEl.appendChild(li);
        });
    });
}

document.getElementById('reset-btn').addEventListener('click', async () => {
    const btn = document.getElementById('reset-btn');
    const originalText = btn.innerText;
    
    if(!confirm('⚠️ Apagar toda a memória e reiniciar a extensão?')) return;

    btn.innerText = '⏳ A Limpar...';
    btn.disabled = true;
    
    // 1. Limpa Storage da Extensão
    chrome.storage.local.clear(async () => {
        updateUI();
        
        // 2. Injeta script de limpeza
        try {
            // "lastFocusedWindow" é mais seguro que "currentWindow" para popups
            const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
            
            if (!tab) {
                btn.innerText = '❌ Erro: Aba não encontrada';
                setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000);
                return;
            }

            if (!chrome.scripting) {
                 btn.innerText = '❌ Erro: API Scripting';
                 return;
            }

            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        let count = 0;
                        try {
                            Object.keys(localStorage).forEach(key => {
                                if (key.startsWith('as_')) {
                                    localStorage.removeItem(key);
                                    count++;
                                }
                            });
                        } catch(e) { 
                            // Ignora erro de acesso (ex: contextos restritos)
                        }
                        
                        alert(`Anti-Scam: Limpeza efetuada!\n(${count} registos apagados)\n\nA recarregar...`);
                        window.location.reload();
                    }
                });
                btn.innerText = '✅ Feito!';
                setTimeout(() => window.close(), 1000);
            } catch (err) {
                console.error(err);
                if (err.message.includes('cannot access')) {
                    alert('ERRO: Não consigo aceder a esta página.\n\nSe estás a testar em ficheiros locais (file://), ativa "Permitir acesso a URL de ficheiro" na página de extensões.');
                }
                btn.innerText = '❌ Erro Permissão';
                setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 3000);
            }

        } catch (e) {
            console.error('Erro reset:', e);
            btn.innerText = '❌ Erro Geral';
        }
    });
});
