/**
 * Anti-Scam Bot Detection Module
 * Analisa comportamento do usuário para prevenir manipulação de scores por bots.
 */

window.BotDetector = {
    // Estado interno
    metrics: {
        lastClickTime: 0,
        clickCount: 0,
        scrollEvents: 0,
        mouseDistance: 0,
        lastMousePos: { x: 0, y: 0 }
    },

    isBot: false,

    init() {
        this.attachListeners();
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
        if (timeDiff < 50 && this.metrics.lastClickTime !== 0) {
            this.isBot = true;
            console.log("Bot detected: Rapid clicking");
        }

        this.metrics.lastClickTime = now;
        this.metrics.clickCount++;
    },

    /**
     * Retorna se o comportamento atual é suspeito.
     * @returns {boolean}
     */
    checkSuspicion() {
        // Exemplo: Se clicou mas não moveu o mouse (clique programático)
        if (this.metrics.clickCount > 0 && this.metrics.mouseDistance === 0) {
            return true;
        }
        return this.isBot;
    },

    /**
     * Retorna fator de peso para sinais (0.0 a 1.0)
     */
    getWeightMultiplier() {
        if (this.checkSuspicion()) return 0.1; // Penaliza bots em 90%
        return 1.0;
    }
};


