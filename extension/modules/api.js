/**
 * Anti-Scam API Module
 * Gerencia a comunicação com o servidor backend.
 */

const APIModule = {
    BASE_URL: 'http://localhost:3000/api', // Placeholder para dev
    ENABLED: false, // Flag para ativar/desativar backend real

    /**
     * Verifica se o backend está acessível.
     */
    async checkHealth() {
        if (!this.ENABLED) return false;
        try {
            const res = await fetch(`${this.BASE_URL}/health`);
            return res.ok;
        } catch (e) {
            console.warn('[Anti-Scam API] Backend unavailable');
            return false;
        }
    },

    /**
     * Obtém dados agregados de um anúncio do servidor.
     * @param {string} hash - Hash do anúncio
     * @returns {Promise<Object|null>}
     */
    async fetchAdData(hash) {
        if (!this.ENABLED) return null;
        try {
            const res = await fetch(`${this.BASE_URL}/ads/${hash}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error('[Anti-Scam API] Fetch error:', e);
            return null;
        }
    },

    /**
     * Envia um sinal/voto para o servidor.
     * @param {string} hash 
     * @param {string} signalType 
     * @param {number} value 
     */
    async submitSignal(hash, signalType, value) {
        if (!this.ENABLED) return;
        try {
            await fetch(`${this.BASE_URL}/ads/${hash}/signals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: signalType, value, timestamp: Date.now() })
            });
        } catch (e) {
            console.error('[Anti-Scam API] Submit error:', e);
        }
    },

    /**
     * Sincroniza dados locais com servidor (Merge).
     * @param {Object} localData 
     */
    async syncAdData(hash, localData) {
        if (!this.ENABLED) return localData;
        
        // 1. Tenta obter dados remotos
        const remoteData = await this.fetchAdData(hash);
        if (!remoteData) {
            // Se não existe remoto, cria (opcional)
            return localData; 
        }

        // 2. Merge inteligente (Prioriza contagens do servidor para community signals)
        const merged = { ...localData };
        if (remoteData.community_signals) {
            merged.community_signals = { 
                ...localData.community_signals, 
                ...remoteData.community_signals 
            };
        }
        
        return merged;
    }
};

window.APIModule = APIModule;
