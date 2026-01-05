/**
 * UI Module
 * Responsável por criar e gerenciar badges e tooltips.
 */

window.UIModule = {
    activeTooltip: null,

    /**
     * Cria o badge de status.
     * @param {number} score - Pontuação do anúncio (0-100).
     * @param {function} onClick - Callback ao clicar no badge.
     * @returns {HTMLElement} O elemento do badge.
     */
    createBadge(score, onClick) {
        const badge = document.createElement('div');
        badge.className = 'as-badge';
        badge.innerText = '🛡️'; // Ícone ou texto curto
        
        if (score >= 80) badge.classList.add('as-badge-safe');
        else if (score >= 40) badge.classList.add('as-badge-warning');
        else badge.classList.add('as-badge-danger');

        badge.title = `Trust Score: ${score}`;
        
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            onClick(e);
        });

        return badge;
    },

    /**
     * Remove tooltip ativo.
     */
    closeTooltip() {
        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }
    },

    /**
     * Renderiza o tooltip com detalhes.
     * @param {Object} data - Dados do anúncio.
     * @param {HTMLElement} targetElement - Elemento de referência (o badge).
     * @param {Object} actions - Callbacks { onReport, onReset }.
     */
    showTooltip(data, targetElement, actions) {
        this.closeTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'as-tooltip';
        
        // Cores baseadas no score
        const scoreColor = data.score >= 80 ? '#2ecc71' : (data.score >= 40 ? '#f1c40f' : '#e74c3c');

        tooltip.innerHTML = `
            <div class="as-tooltip-header">
                <span class="as-tooltip-title">Anti-Scam</span>
                <span class="as-score" style="background-color: ${scoreColor}">${data.score}</span>
            </div>
            <div class="as-tooltip-content">
                <div class="as-signal-row">
                    <span>❌ Não respondem:</span>
                    <b>${data.user_signals.no_response || 0}</b>
                </div>
                <div class="as-signal-row">
                    <span>💳 Pagamento suspeito:</span>
                    <b>${data.user_signals.suspicious_payment || 0}</b>
                </div>
                <div class="as-signal-row">
                    <span>📞 Contacto externo:</span>
                    <b>${data.user_signals.early_contact || 0}</b>
                </div>
                <div class="as-signal-row">
                    <span>🚨 Parece falso:</span>
                    <b>${data.user_signals.looks_fake || 0}</b>
                </div>
            </div>
            <div class="as-actions-title">Reportar:</div>
            <div class="as-actions">
                <button class="as-btn as-btn-report" data-signal="no_response">❌ Não responde</button>
                <button class="as-btn as-btn-report" data-signal="suspicious_payment">💳 Pagamento</button>
            </div>
            <div class="as-actions">
                <button class="as-btn as-btn-report" data-signal="early_contact">📞 Contacto</button>
                <button class="as-btn as-btn-report" data-signal="looks_fake">🚨 Falso</button>
            </div>
        `;

        // Posicionamento básico
        const rect = targetElement.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX + 25}px`;
        tooltip.style.top = `${rect.top + window.scrollY}px`;

        document.body.appendChild(tooltip);
        this.activeTooltip = tooltip;

        // Events para todos os botões de report
        tooltip.querySelectorAll('.as-btn-report').forEach(btn => {
            btn.onclick = () => actions.onReport(btn.dataset.signal);
        });

        // Fecha ao clicar fora
        setTimeout(() => {
             document.addEventListener('click', (e) => {
                if (!tooltip.contains(e.target) && e.target !== targetElement) {
                    this.closeTooltip();
                }
             }, { once: true });
        }, 100);
    }
};
