/**
 * Behavior Tracker Module
 * Captura comportamentos passivos do utilizador SEM invadir privacidade.
 * Foca em padrões agregados, não dados individuais.
 */

window.BehaviorTracker = {
    // Estado da sessão atual
    session: {
        startTime: 0,
        scrollDepth: 0,
        maxScrollDepth: 0,
        scrollEvents: [],
        hasOpenedContact: false,
        hasCopiedContact: false,
        hasUsedBack: false,
        isActive: false,
        adId: null
    },

    // Configuração de thresholds
    CONFIG: {
        FAST_ABANDON_THRESHOLD: 10000,  // 10 segundos
        VERY_FAST_ABANDON: 5000,         // 5 segundos
        ERRATIC_SCROLL_THRESHOLD: 5,     // Mudanças de direção
        GOOD_ENGAGEMENT_TIME: 30000,     // 30 segundos = bom sinal
        SCROLL_COMPLETE_THRESHOLD: 75    // 75% = viu a maior parte
    },

    /**
     * Inicia tracking para um anúncio específico.
     * @param {string} adId - ID único do anúncio
     */
    startTracking(adId) {
        this.resetSession();
        this.session.adId = adId;
        this.session.startTime = Date.now();
        this.session.isActive = true;
        
        this.attachListeners();
        console.log(`[BehaviorTracker] Iniciou tracking para: ${adId}`);
    },

    /**
     * Reseta a sessão para novo anúncio.
     */
    resetSession() {
        this.session = {
            startTime: 0,
            scrollDepth: 0,
            maxScrollDepth: 0,
            scrollEvents: [],
            hasOpenedContact: false,
            hasCopiedContact: false,
            hasUsedBack: false,
            isActive: false,
            adId: null
        };
    },

    /**
     * Anexa event listeners para tracking.
     */
    attachListeners() {
        // Scroll tracking
        this._scrollHandler = this.trackScroll.bind(this);
        window.addEventListener('scroll', this._scrollHandler, { passive: true });

        // Copy detection (telefone/email copiado)
        this._copyHandler = this.trackCopy.bind(this);
        document.addEventListener('copy', this._copyHandler);

        // Back button detection
        this._popstateHandler = this.trackBack.bind(this);
        window.addEventListener('popstate', this._popstateHandler);

        // Page visibility (fechar aba)
        this._visibilityHandler = this.trackVisibility.bind(this);
        document.addEventListener('visibilitychange', this._visibilityHandler);

        // Beforeunload para capturar saída
        this._unloadHandler = () => this.endTracking('unload');
        window.addEventListener('beforeunload', this._unloadHandler);
    },

    /**
     * Remove event listeners.
     */
    detachListeners() {
        window.removeEventListener('scroll', this._scrollHandler);
        document.removeEventListener('copy', this._copyHandler);
        window.removeEventListener('popstate', this._popstateHandler);
        document.removeEventListener('visibilitychange', this._visibilityHandler);
        window.removeEventListener('beforeunload', this._unloadHandler);
    },

    /**
     * Rastreia scroll e deteta padrões erráticos.
     */
    trackScroll() {
        if (!this.session.isActive) return;

        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

        // Guardar histórico para detetar padrão errático
        const lastScroll = this.session.scrollEvents[this.session.scrollEvents.length - 1] || 0;
        const direction = scrollPercent > lastScroll ? 'down' : 'up';
        
        this.session.scrollEvents.push({ percent: scrollPercent, direction, time: Date.now() });
        
        // Limitar histórico a últimos 20 eventos
        if (this.session.scrollEvents.length > 20) {
            this.session.scrollEvents.shift();
        }

        this.session.scrollDepth = scrollPercent;
        this.session.maxScrollDepth = Math.max(this.session.maxScrollDepth, scrollPercent);
    },

    /**
     * Deteta cópia de texto (possível telefone/email).
     */
    trackCopy(e) {
        if (!this.session.isActive) return;
        
        const selection = window.getSelection().toString();
        
        // Verifica se parece telefone ou email
        const phonePattern = /[\d\s\-\+]{9,}/;
        const emailPattern = /[\w\.-]+@[\w\.-]+/;
        
        if (phonePattern.test(selection) || emailPattern.test(selection)) {
            this.session.hasCopiedContact = true;
            console.log('[BehaviorTracker] Detetou cópia de contacto');
        }
    },

    /**
     * Deteta uso do botão voltar.
     */
    trackBack() {
        if (!this.session.isActive) return;
        this.session.hasUsedBack = true;
        console.log('[BehaviorTracker] Detetou uso de back');
    },

    /**
     * Deteta mudança de visibilidade (tab switch/close).
     */
    trackVisibility() {
        if (!this.session.isActive) return;
        
        if (document.hidden) {
            this.endTracking('visibility');
        }
    },

    /**
     * Verifica se padrão de scroll foi errático (hesitação).
     * @returns {boolean}
     */
    isScrollErratic() {
        const events = this.session.scrollEvents;
        if (events.length < 5) return false;

        let directionChanges = 0;
        for (let i = 1; i < events.length; i++) {
            if (events[i].direction !== events[i-1].direction) {
                directionChanges++;
            }
        }

        return directionChanges >= this.CONFIG.ERRATIC_SCROLL_THRESHOLD;
    },

    /**
     * Marca que o utilizador abriu a secção de contacto.
     */
    markContactOpened() {
        if (this.session.isActive) {
            this.session.hasOpenedContact = true;
            console.log('[BehaviorTracker] Contacto aberto');
        }
    },

    /**
     * Termina tracking e retorna métricas.
     * @param {string} reason - Razão do término
     * @returns {Object} Métricas da sessão
     */
    endTracking(reason = 'manual') {
        if (!this.session.isActive) return null;

        const timeOnPage = Date.now() - this.session.startTime;
        
        const metrics = {
            adId: this.session.adId,
            timeOnPage,
            maxScrollDepth: this.session.maxScrollDepth,
            isScrollErratic: this.isScrollErratic(),
            hasOpenedContact: this.session.hasOpenedContact,
            hasCopiedContact: this.session.hasCopiedContact,
            hasUsedBack: this.session.hasUsedBack,
            exitReason: reason,
            // Classificações derivadas
            isFastAbandon: timeOnPage < this.CONFIG.FAST_ABANDON_THRESHOLD,
            isVeryFastAbandon: timeOnPage < this.CONFIG.VERY_FAST_ABANDON,
            isGoodEngagement: timeOnPage >= this.CONFIG.GOOD_ENGAGEMENT_TIME,
            hasCompletedScroll: this.session.maxScrollDepth >= this.CONFIG.SCROLL_COMPLETE_THRESHOLD
        };

        console.log('[BehaviorTracker] Sessão terminada:', metrics);

        this.detachListeners();
        this.session.isActive = false;

        return metrics;
    },

    /**
     * Calcula pontuação comportamental baseada nas métricas.
     * @param {Object} metrics - Métricas da sessão
     * @returns {number} Ajuste de score (-20 a +15)
     */
    calculateBehaviorScore(metrics) {
        let adjustment = 0;

        // Sinais negativos
        if (metrics.isVeryFastAbandon) adjustment -= 10;
        else if (metrics.isFastAbandon) adjustment -= 5;
        
        if (metrics.isScrollErratic && metrics.hasUsedBack) adjustment -= 5;

        // Sinais positivos
        if (metrics.isGoodEngagement) adjustment += 10;
        if (metrics.hasCompletedScroll) adjustment += 5;
        if (metrics.hasOpenedContact) adjustment += 5;
        if (metrics.hasCopiedContact) adjustment += 10;

        // Limitar range
        return Math.max(-20, Math.min(15, adjustment));
    }
};
