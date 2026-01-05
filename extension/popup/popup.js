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
