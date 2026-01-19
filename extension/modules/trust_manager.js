/**
 * SCM HUNTERS - Trust Manager Module
 * Gere a reputação invisível do utilizador com base no seu comportamento.
 * Sem UI, sem Gamificação, apenas integridade de dados.
 */

window.TrustManager = {
    STORAGE_KEY: 'as_user_trust_v1',
    HISTORY_KEY: 'as_user_actions_v1',
    MAX_WEIGHT: 1.4,
    MIN_WEIGHT: 0.6,
    BASE_WEIGHT: 1.0,

    init() {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            localStorage.setItem(this.STORAGE_KEY, this.BASE_WEIGHT.toString());
            this.logAction('system_init', 'Novo perfil de confiança criado.');
        }
        console.log(`[TrustManager] Ativo. Peso Atual: ${this.getTrustWeight()}`);
    },

    /**
     * Retorna o fator de multiplicação para os votos do utilizador.
     * Inclui lógica de Decay: Reputação não é eterna.
     */
    getTrustWeight() {
        const score = parseFloat(localStorage.getItem(this.STORAGE_KEY) || this.BASE_WEIGHT);
        const history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
        
        let finalScore = score;

        if (history.length > 0) {
            const lastAction = history[history.length - 1].t;
            const daysSinceLast = (Date.now() - lastAction) / (1000 * 60 * 60 * 24);
            
            // Se inativo há mais de 30 dias, perde 0.05 por semana de inatividade
            if (daysSinceLast > 30) {
                const weeksInactive = Math.floor((daysSinceLast - 30) / 7);
                finalScore = Math.max(this.BASE_WEIGHT, score - (weeksInactive * 0.05));
            }
        }

        // Garante limites duros
        return Math.min(this.MAX_WEIGHT, Math.max(this.MIN_WEIGHT, finalScore));
    },

    /**
     * Regista uma ação e ajusta a reputação.
     * @param {string} type - 'correction', 'contradiction', 'spam_attempt', 'consistency'
     */
    recordAction(type) {
        let current = this.getTrustWeight();
        let delta = 0;
        let reason = '';

        switch (type) {
            case 'correction': // User removeu um voto (bom sinal de auditoria)
                delta = 0.02;
                reason = 'Correção de voto (auditoria positiva)';
                break;
            case 'contradiction': // User tentou votar no oposto
                delta = -0.05;
                reason = 'Tentativa de contradição lógica';
                break;
            case 'spam_attempt': // Detectado pelo BotDetector ou UI
                delta = -0.03;
                reason = 'Padrão de voto suspeito/rápido';
                break;
            case 'consistency': // Uso legítimo em múltiplos anúncios
                delta = 0.01;
                reason = 'Consistência de uso';
                break;
        }

        if (delta !== 0) {
            const next = current + delta;
            localStorage.setItem(this.STORAGE_KEY, next.toFixed(4));
            this.logAction(type, reason, delta);
        }
    },

    /**
     * Log interno (para futura auditoria, invisível ao user).
     */
    logAction(type, reason, delta = 0) {
        try {
            const history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
            history.push({
                t: Date.now(),
                type,
                reason,
                delta,
                weightAfter: this.getTrustWeight()
            });
            // Mantém apenas os últimos 50 eventos
            if (history.length > 50) history.shift();
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.error('[TrustManager] Erro ao gravar histórico', e);
        }
    }
};

// Auto-init
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.TrustManager.init();
} else {
    window.addEventListener('DOMContentLoaded', () => window.TrustManager.init());
}
