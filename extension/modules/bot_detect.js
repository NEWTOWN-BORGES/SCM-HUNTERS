/**
 * Anti-Scam Bot Detection - VERSÃO SIMPLIFICADA
 * Sistema básico: 5 votos/anúncio + cooldowns por cor
 */

window.BotDetector = {
    // Configuração simplificada
    CONFIG: {
        MAX_VOTES_PER_AD: 5,

        // Cooldowns por tipo (em segundos)
        COOLDOWN_RED: 5,      // Sinais críticos (vermelho)
        COOLDOWN_YELLOW: 3,   // Sinais de aviso (amarelo)
        COOLDOWN_GREEN: 0,    // Sinais positivos (verde/branco)
        COOLDOWN_REMOVE: 0    // Remover voto (sem cooldown)
    },

    // Estado de cooldowns
    reportState: {
        adCooldowns: {}  // { adHash: timestamp }
    },

    init() {
        console.log('[BotDetector] Inicializado (modo simplificado)');
    },

    /**
     * Verifica se um voto pode ser registado.
     * @param {string} adHash - Hash do anúncio
     * @param {string} signalType - Tipo de sinal
     * @returns {Object} { allowed: boolean, reason: string }
     */
    canReport(adHash, signalType) {
        const now = Date.now();

        // 1. Limite de 5 votos por anúncio
        const voteCount = parseInt(localStorage.getItem(`as_vote_count_${adHash}`) || '0');
        if (voteCount >= this.CONFIG.MAX_VOTES_PER_AD) {
            return {
                allowed: false,
                reason: `Limite de ${this.CONFIG.MAX_VOTES_PER_AD} votos atingido neste anúncio.`
            };
        }

        // 2. Cooldown baseado na cor do botão
        const cooldownSeconds = this.getCooldownForSignal(signalType);

        if (cooldownSeconds > 0) {
            const expiry = this.reportState.adCooldowns[adHash];
            if (expiry && now < expiry) {
                const remaining = Math.ceil((expiry - now) / 1000);
                return {
                    allowed: false,
                    reason: `Aguarde ${remaining}s antes de votar novamente.`
                };
            }
        }

        return { allowed: true };
    },

    /**
     * Retorna cooldown em segundos baseado no tipo de sinal.
     */
    getCooldownForSignal(signalType) {
        // Sinais CRÍTICOS (Vermelho) - 5s
        const redSignals = [
            'votes_no_response', 'votes_external_contact', 'votes_advance_payment',
            'votes_fake_item', 'votes_deposit_no_visit', 'votes_off_platform',
            'votes_not_owner', 'votes_no_visit_allowed', 'votes_cloned_listing',
            'votes_property_different', 'votes_mbway_scam', 'votes_fake_proof',
            'votes_sms_code', 'votes_foreign_shipping', 'votes_suspicious_link',
            'votes_cloned_ad', 'votes_fake_profile', 'votes_deposit_before_see',
            'votes_fake_payment_proof', 'votes_abroad_car', 'votes_accident_hidden',
            'votes_debts_hidden', 'votes_fake_courier', 'votes_phishing',
            'votes_external_payment', 'votes_no_docs'
        ];

        // Sinais de AVISO (Amarelo) - 3s
        const yellowSignals = [
            'votes_price_too_good', 'votes_unrealistic_price', 'votes_repost',
            'votes_conditions_changed', 'votes_pressure', 'votes_evasive',
            'votes_vague_location', 'votes_generic_images', 'votes_new_profile',
            'votes_inconsistent', 'votes_too_cheap', 'votes_ai_photos',
            'votes_targets_foreigners', 'votes_bad_portuguese', 'votes_address_fishing',
            'votes_only_whatsapp', 'votes_km_suspect', 'votes_no_test_drive',
            'votes_docs_incomplete', 'votes_pressure_sale'
        ];

        if (redSignals.includes(signalType)) return this.CONFIG.COOLDOWN_RED;
        if (yellowSignals.includes(signalType)) return this.CONFIG.COOLDOWN_YELLOW;

        // Verdes, brancos, likes/dislikes = sem cooldown
        return this.CONFIG.COOLDOWN_GREEN;
    },

    /**
     * Regista uma alteração de voto.
     * @param {string} adHash 
     * @param {number} delta - 1 para adicionar, -1 para remover
     * @param {string} signalType
     */
    registerVoteChange(adHash, delta, signalType = 'unknown') {
        const now = Date.now();

        // Atualiza contador persistente
        const current = parseInt(localStorage.getItem(`as_vote_count_${adHash}`) || '0');
        const newVal = Math.max(0, current + delta);
        localStorage.setItem(`as_vote_count_${adHash}`, newVal);

        // Define cooldown apenas se for ADICIONAR voto (delta > 0)
        if (delta > 0) {
            const cooldownSeconds = this.getCooldownForSignal(signalType);
            if (cooldownSeconds > 0) {
                this.reportState.adCooldowns[adHash] = now + (cooldownSeconds * 1000);
            }
        }
        // Remover voto (delta < 0) = SEM cooldown, não atualiza adCooldowns
    },

    /**
     * Retorna contagem de votos do utilizador.
     */
    getUserVoteCount(adHash) {
        return parseInt(localStorage.getItem(`as_vote_count_${adHash}`) || '0');
    },

    /**
     * Retorna segundos restantes de cooldown.
     */
    getCooldownRemaining(adHash) {
        const now = Date.now();
        const expiry = this.reportState.adCooldowns[adHash];
        if (expiry && now < expiry) {
            return Math.ceil((expiry - now) / 1000);
        }
    },

    /**
     * Helper para verificar se cooldown está ativo.
     */
    isCooldownActive(adHash) {
        return this.getCooldownRemaining(adHash) > 0;
    },

    /**
     * Compatibilidade: retorna peso fixo de 1.0 (sem pesos dinâmicos).
     */
    getWeightMultiplier() {
        return 1.0;
    },

    /**
     * Compatibilidade: sempre válido.
     */
    validateQualityAction() {
        return true;
    },

    /**
     * Status para debug.
     */
    getStatus() {
        return {
            maxVotesPerAd: this.CONFIG.MAX_VOTES_PER_AD,
            cooldowns: {
                red: this.CONFIG.COOLDOWN_RED,
                yellow: this.CONFIG.COOLDOWN_YELLOW,
                green: this.CONFIG.COOLDOWN_GREEN
            }
        };
    }
};
