/**
 * Anti-Scam Bot Detection & Anti-Abuse Module
 * Analisa comportamento do utilizador para prevenir manipulação de scores.
 * ATUALIZADO: Rate limiting, cooldowns e deteção de sequências.
 */

window.BotDetector = {
    // Estado interno
    metrics: {
        lastClickTime: 0,
        clickCount: 0,
        scrollEvents: 0,
        mouseDistance: 0,
        lastMousePos: { x: 0, y: 0 },
        sessionStart: Date.now(),
        suspicionLevel: 0,              // Nível de suspeição (0-100)
        lastSuspicionDecay: Date.now(),
        voteToggleHistory: {}           // { adHash_signal: { lastAction, timestamp, count } }
    },

    // Configuração anti-abuso
    CONFIG: {
        MAX_REPORTS_PER_MINUTE: 5,
        MAX_VOTES_PER_AD: 5,            // Novo limite: 5 votos por anúncio
        REPORT_COOLDOWN_MS: 3000,      // 3s entre reports no mesmo anúncio (Pedido User)
        
        // Deteção de bots
        MIN_CLICK_INTERVAL_MS: 50,       // Cliques < 50ms = bot
        MIN_MOUSE_DISTANCE: 10,          // Mouse deve mover-se
        
        // Peso dinâmico
        FIRST_REPORT_WEIGHT: 1.0,
        WEIGHT_DECAY: 0.2,               // Cada report subsequente pesa menos 20%
        MIN_WEIGHT: 0.3                  // Peso mínimo 30%
    },

    // Estado de reports
    reportState: {
        reportsThisMinute: 0,
        minuteStart: Date.now(),
        adCooldowns: {},                 // { adHash: lastReportTimestamp }
        sessionReportCount: 0
    },

    isBot: false,
    suspicionReasons: [],

    init() {
        this.attachListeners();
        console.log('[BotDetector] Inicializado com anti-abuso');
    },

    attachListeners() {
        document.addEventListener('mousemove', (e) => this.trackMouse(e));
        document.addEventListener('click', (e) => this.trackClick(e));
        document.addEventListener('scroll', () => this.metrics.scrollEvents++);
    },

    trackMouse(e) {
        const dist = Math.sqrt(
            Math.pow(e.clientX - this.metrics.lastMousePos.x, 2) + 
            Math.pow(e.clientY - this.metrics.lastMousePos.y, 2)
        );
        this.metrics.mouseDistance += dist;
        this.metrics.lastMousePos = { x: e.clientX, y: e.clientY };
    },

    trackClick(e) {
        const now = Date.now();
        const timeDiff = now - this.metrics.lastClickTime;
        
        // Bot check: Cliques super-humanos (< 50ms)
        if (timeDiff < this.CONFIG.MIN_CLICK_INTERVAL_MS && this.metrics.lastClickTime !== 0) {
            this.isBot = true;
            this.suspicionReasons.push('rapid_clicks');
            console.log('[BotDetector] Bot detetado: Cliques rápidos');
        }

        this.metrics.lastClickTime = now;
        this.metrics.clickCount++;
    },

    /**
     * Verifica se um report pode ser feito (rate limiting + cooldown).
     * @param {string} adHash - Hash do anúncio
     * @param {string} [signalType] - Tipo de voto (opcional)
     * @returns {Object} { allowed: boolean, reason: string }
     */
    canReport(adHash, signalType) {
        // BYPASS: Likes e Dislikes não têm limites
        if (signalType && ['votes_like', 'votes_dislike'].includes(signalType)) {
            return { allowed: true };
        }

        // 0. Decay suspicion over time (1 point per 5s)
        this.decaySuspicion();

        // 1. Limite absoluto por anúncio (Persistente)
        const voteCount = parseInt(localStorage.getItem(`as_vote_count_${adHash}`) || '0');
        if (voteCount >= this.CONFIG.MAX_VOTES_PER_AD) {
             return { 
                allowed: false, 
                reason: `Já registaste ${this.CONFIG.MAX_VOTES_PER_AD} interações neste anúncio. Limite atingido.` 
            };
        }

        // 2. Reset contador por minuto
        if (now - this.reportState.minuteStart > 60000) {
            this.reportState.reportsThisMinute = 0;
            this.reportState.minuteStart = now;
        }

        // 3. Rate limit global
        if (this.reportState.reportsThisMinute >= this.CONFIG.MAX_REPORTS_PER_MINUTE) {
            this.addSuspicion(10, 'global_rate_limit');
            return { 
                allowed: false, 
                reason: 'Muitos votos. Aguarde um minuto.' 
            };
        }

        // 4. Cooldown dinâmico por anúncio (Step 6)
        const expiry = this.reportState.adCooldowns[adHash];
        if (expiry && now < expiry) {
            const remaining = Math.ceil((expiry - now) / 1000);
            this.addSuspicion(5, 'cooldown_spam');
            return { 
                allowed: false, 
                reason: `Integridade ativa. Aguarde ${remaining}s.` 
            };
        }

        return { allowed: true };
    },

    /**
     * Retorna segundos restantes de cooldown (0 se nenhum).
     */
    getCooldownRemaining(adHash) {
        const now = Date.now();
        const expiry = this.reportState.adCooldowns[adHash];
        if (expiry && now < expiry) {
            return Math.ceil((expiry - now) / 1000);
        }
        return 0;
    },

    /**
     * Retorna número de votos do utilizador neste anúncio.
     */
    getUserVoteCount(adHash) {
         return parseInt(localStorage.getItem(`as_vote_count_${adHash}`) || '0');
    },

    /**
     * Regista uma alteração de voto (adição ou remoção).
     * @param {string} adHash 
     * @param {number} delta - 1 para adição, -1 para remoção
     */
    registerVoteChange(adHash, delta, signalType = 'unknown') {
        const now = Date.now();
        if (delta > 0) {
            this.reportState.reportsThisMinute++;
            this.reportState.sessionReportCount++;
            
            // Auditoria de Velocidade (Step 6)
            if (this.metrics.lastClickTime !== 0 && (now - this.metrics.lastClickTime) < 2000) {
                this.addSuspicion(15, 'fast_report');
            }
        }

        // Auditoria de Toggling (Vota/Remove repetido)
        const toggleKey = `${adHash}_${signalType}`;
        const history = this.metrics.voteToggleHistory[toggleKey] || { lastAction: 0, timestamp: 0, count: 0 };
        
        if (now - history.timestamp < 10000) { // Se ação repetida no mesmo sinal em < 10s
            history.count++;
            if (history.count > 2) {
                this.addSuspicion(20, 'vote_toggling');
            }
        } else {
            history.count = 1;
        }
        history.timestamp = now;
        history.lastAction = delta;
        this.metrics.voteToggleHistory[toggleKey] = history;

        // Atualiza contador persistente (as_vote_count)
        const current = parseInt(localStorage.getItem(`as_vote_count_${adHash}`) || '0');
        const newVal = Math.max(0, current + delta);
        localStorage.setItem(`as_vote_count_${adHash}`, newVal);
    },

    /**
     * Adiciona nível de suspeição e comunica com TrustManager se necessário.
     */
    addSuspicion(points, reason) {
        this.metrics.suspicionLevel = Math.min(100, this.metrics.suspicionLevel + points);
        if (points >= 15 && window.TrustManager) {
            window.TrustManager.recordAction('spam_attempt');
        }
        console.warn(`[BotDetector] Suspeição +${points} (${reason}). Nível: ${this.metrics.suspicionLevel}`);
    },

    /**
     * Diminui suspeição ao longo do tempo (1 ponto a cada 5s).
     */
    decaySuspicion() {
        const now = Date.now();
        const elapsed = now - this.metrics.lastSuspicionDecay;
        if (elapsed > 5000) {
            const pointsToDecay = Math.floor(elapsed / 5000);
            this.metrics.suspicionLevel = Math.max(0, this.metrics.suspicionLevel - pointsToDecay);
            this.metrics.lastSuspicionDecay = now;
        }
    },

    /**
     * Retorna cooldown dinâmico baseado no nível de suspeição (Step 6).
     */
    getDynamicCooldown(baseSeconds) {
        // Multiplicador: 1.0 (0 suspeição) até ~6.0 (100 suspeição)
        const multiplier = 1 + (this.metrics.suspicionLevel / 20);
        return Math.floor(baseSeconds * multiplier);
    },

    /**
     * Regista um report (para compatibilidade e tracking anti-abuso).
     * @param {string} adHash 
     */
    registerReport(adHash) {
        this.registerVoteChange(adHash, 1);
    },

    /**
     * Retorna se o comportamento atual é suspeito.
     * @returns {boolean}
     */
    checkSuspicion() {
        // Cliques sem movimento de mouse (clique programático)
        if (this.metrics.clickCount > 0 && this.metrics.mouseDistance < this.CONFIG.MIN_MOUSE_DISTANCE) {
            this.suspicionReasons.push('no_mouse_movement');
            return true;
        }

        // Muitos reports em pouco tempo
        if (this.reportState.sessionReportCount > 10 && 
            (Date.now() - this.metrics.sessionStart) < 300000) { // > 10 reports em 5 min
            this.suspicionReasons.push('excessive_reports');
            return true;
        }

        return this.isBot;
    },

    /**
     * Retorna fator de peso para sinais (0.3 a 1.0).
     * Peso decai com reports subsequentes e suspeição.
     */
    getWeightMultiplier() {
        // 1. Penaliza bots e suspeição alta severamente
        if (this.checkSuspicion()) {
             // Peso decai linearmente com a suspeição quando está em modo crítico
             const suspicionFactor = Math.max(0.1, 1 - (this.metrics.suspicionLevel / 100));
             return 0.1 * suspicionFactor;
        }
        
        // 2. Peso dinâmico baseado em volume de sessão
        const reportCount = this.reportState.sessionReportCount;
        let weight = this.CONFIG.FIRST_REPORT_WEIGHT - 
                     (reportCount * this.CONFIG.WEIGHT_DECAY);
        
        // 3. Ajuste fino pela suspeição (mesmo se não for "bot" oficial)
        if (this.metrics.suspicionLevel > 20) {
            weight *= (1 - (this.metrics.suspicionLevel / 200));
        }

        return Math.max(this.CONFIG.MIN_WEIGHT, weight);
    },

    /**
     * Valida ações de qualidade (evita farm de reputação).
     * @param {string} actionType - 'contact_open' | 'scroll_complete' | 'copy_contact'
     * @param {Object} metrics - Métricas atuais
     * @returns {boolean}
     */
    validateQualityAction(actionType, metrics) {
        const timeOnPage = Date.now() - this.metrics.sessionStart;

        // 1. Scroll Completo
        if (actionType === 'scroll_complete') {
            // Impossível ler anúncio e scrollar em < 2 segundos
            if (timeOnPage < 2000) return false;
            // Deve ter havido movimento do rato significativo
            if (this.metrics.mouseDistance < 100) return false;
        }

        // 2. Abertura de Contacto
        if (actionType === 'contact_open') {
            // Requer interesse real (min 3s de leitura)
            if (timeOnPage < 3000) return false;
            // Deve ter havido pelo menos um clique ou scroll antes
            if (this.metrics.clickCount === 0 && this.metrics.scrollEvents === 0) return false;
        }

        return true;
    },

    /**
     * Verifica se sequência de eventos faz sentido humano.
     * @param {Object} events - Eventos da sessão
     * @returns {boolean}
     */
    isSequenceValid(events) {
        // Sequência impossível: report sem ter feito scroll (a menos que seja óbvio no topo)
        // Relaxamos um pouco aqui pois pode ser fraude óbvia no título
        
        // Tempo suspeito: report em < 2s de página aberta (bot rápido)
        if (events.hasReported && events.timeOnPage < 2000) {
            return false;
        }

        // Se marcou "scroll completo", tempo deve ser compatível
        if (events.hasCompletedScroll && events.timeOnPage < 500) {
            return false;
        }

        return true;
    },

    /**
     * Limpa cooldowns antigos (limpeza periódica).
     */
    cleanupCooldowns() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hora
        
        for (const hash in this.reportState.adCooldowns) {
            if (now - this.reportState.adCooldowns[hash] > maxAge) {
                delete this.reportState.adCooldowns[hash];
            }
        }
    },

    /**
     * Retorna o peso inerente de um sinal específico.
     * @param {string} signalType 
     * @returns {number}
     */
    getSignalBaseWeight(signalType) {
        // 1. Sinais CRÍTICOS (Risco Máximo)
        const critical = [
            'votes_no_response', 'votes_external_contact', 'votes_advance_payment',
            'votes_fake_item', 'votes_deposit_no_visit', 'votes_off_platform',
            'votes_not_owner', 'votes_no_visit_allowed', 'votes_cloned_listing',
            'votes_property_different', 'votes_mbway_scam', 'votes_fake_proof',
            'votes_sms_code', 'votes_foreign_shipping', 'votes_suspicious_link',
            'votes_cloned_ad', 'votes_fake_profile', 'votes_deposit_before_see',
            'votes_fake_payment_proof', 'votes_abroad_car', 'votes_accident_hidden',
            'votes_debts_hidden', 'votes_fake_courier', 'votes_phishing', 'votes_external_payment'
        ];

        // 2. Sinais de AVISO (Amarelo)
        const warning = [
            'votes_price_too_good', 'votes_unrealistic_price', 'votes_repost',
            'votes_conditions_changed', 'votes_pressure', 'votes_evasive',
            'votes_location_vague', 'votes_generic_images', 'votes_new_profile',
            'votes_inconsistent', 'votes_too_cheap', 'votes_ai_photos',
            'votes_targets_foreigners', 'votes_bad_portuguese', 'votes_address_fishing',
            'votes_only_whatsapp', 'votes_km_suspect', 'votes_no_test_drive',
            'votes_docs_incomplete', 'votes_pressure_sale'
        ];

        // 3. Sinais POSITIVOS (Verde)
        const positive = [
            'votes_visit_available', 'votes_visit_done', 'votes_saw_car',
            'votes_test_drive_ok', 'votes_mechanic_check', 'votes_hand_delivery',
            'votes_product_ok', 'votes_mail_ok', 'votes_docs_shown',
            'votes_docs_ok', 'votes_docs_complete', 'votes_location_confirmed',
            'votes_location_matches', 'votes_real_owner', 'votes_owner_real',
            'votes_old_profile', 'votes_legit_profile', 'votes_trusted_seller',
            'votes_trusted_stand', 'votes_history_clear', 'votes_original_photos',
            'votes_real_photos', 'votes_legit', 'votes_clear_answers',
            'votes_clear_communication', 'votes_communication', 'votes_normal_interaction',
            'votes_responsive', 'votes_clear_process', 'votes_fair_price'
        ];

        if (critical.includes(signalType)) return 1.5;
        if (warning.includes(signalType)) return 1.2;
        if (positive.includes(signalType)) return 1.0;
        
        return 0.8; // Neutro / Outros
    },

    /**
     * Obtém resumo do estado anti-abuso para debug.
     */
    getStatus() {
        return {
            isBot: this.isBot,
            suspicionReasons: this.suspicionReasons,
            reportsThisMinute: this.reportState.reportsThisMinute,
            sessionReports: this.reportState.sessionReportCount,
            currentWeight: this.getWeightMultiplier()
        };
    }
};
