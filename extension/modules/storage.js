/**
 * Anti-Scam Storage Module
 * Gerencia persistência local de scores e sinais.
 */

const StorageModule = {
    // Configurações
    CONFIG: {
        INITIAL_SCORE: 50,
        MIN_SCORE: 0,
        MAX_SCORE: 100,
        RESET_DAYS: 7, // Dias para reset parcial
        RESET_AMOUNT: 5 // Pontos recuperados por reset
    },

    /**
     * Gera um hash único para o anúncio baseado em título + preço + criador.
     * @param {string} text - String concatenada (ex: titulo + preco)
     * @returns {Promise<string>} - Hash SHA-256
     */
    async generateHash(text) {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Salva ou atualiza um anúncio no storage local.
     * @param {string} hash - Hash único do anúncio
     * @param {Object} data - Dados parciais para atualizar
     */
    async updateAdData(hash, data) {
        return new Promise((resolve) => {
            chrome.storage.local.get([hash], (result) => {
                let entry = result[hash] || this.createDefaultEntry();
                
                // Atualiza campos
                entry = { ...entry, ...data, last_seen: Date.now() };

                // Recalcula score se houver novos sinais
                if (data.user_signals) {
                    entry.score = this.calculateScore(entry);
                }

                // Salva
                chrome.storage.local.set({ [hash]: entry }, () => {
                   resolve(entry);
                });
            });
        });
    },

    /**
     * Recupera dados de um anúncio.
     * @param {string} hash 
     * @returns {Promise<Object>}
     */
    async getAdData(hash) {
        return new Promise((resolve) => {
            chrome.storage.local.get([hash], (result) => {
                resolve(result[hash] || null);
            });
        });
    },

    createDefaultEntry() {
        return {
            first_seen: Date.now(),
            last_seen: Date.now(),
            score: this.CONFIG.INITIAL_SCORE,
            user_signals: {
                no_response: 0,
                suspicious_payment: 0,
                early_contact: 0,
                looks_fake: 0
            }
        };
    },

    calculateScore(entry) {
        let score = this.CONFIG.INITIAL_SCORE;
        const signals = entry.user_signals;

        // Pesos por tipo de sinal
        score -= ((signals.no_response || 0) * 5);
        score -= ((signals.early_contact || 0) * 10);
        score -= ((signals.suspicious_payment || 0) * 15);
        score -= ((signals.looks_fake || 0) * 20);

        // Limites
        return Math.max(this.CONFIG.MIN_SCORE, Math.min(this.CONFIG.MAX_SCORE, score));
    }
};

// Export para uso em outros módulos (se usar bundler) ou global scope
// window.StorageModule = StorageModule; 
