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
        sessionStart: Date.now()
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

        const now = Date.now();

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
            return { 
                allowed: false, 
                reason: 'Muitos votos. Aguarde um minuto.' 
            };
        }

        // 4. Cooldown por anúncio (Baseado em Expiry)
        const expiry = this.reportState.adCooldowns[adHash];
        if (expiry && now < expiry) {
            const remaining = Math.ceil((expiry - now) / 1000);
            return { 
                allowed: false, 
                reason: `Aguarde ${remaining}s para votar novamente.` 
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
    registerVoteChange(adHash, delta) {
        if (delta > 0) {
            this.reportState.reportsThisMinute++;
            this.reportState.sessionReportCount++;
            
            // NOTA: O Cooldown agora é gerido dinamicamente pelo UIModule (ui.js)
            // baseado na cor/risco do botão. Removido o cooldown fixo de 3s daqui.
        }

        // Atualiza contador persistente (as_vote_count)
        const current = parseInt(localStorage.getItem(`as_vote_count_${adHash}`) || '0');
        const newVal = Math.max(0, current + delta);
        localStorage.setItem(`as_vote_count_${adHash}`, newVal);
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
        // Penaliza bots severamente
        if (this.checkSuspicion()) return 0.1;
        
        // Peso dinâmico: primeiro report = 100%, subsequentes decaem
        const reportCount = this.reportState.sessionReportCount;
        let weight = this.CONFIG.FIRST_REPORT_WEIGHT - 
                     (reportCount * this.CONFIG.WEIGHT_DECAY);
        
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
