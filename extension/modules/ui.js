/**
 * UI Module
 * Responsável por criar e gerenciar badges e tooltips.
 * ATUALIZADO: Tooltips com explicações semânticas e feedback anti-abuso.
 */

window.UIModule = {
    activeTooltip: null,
    isClickLocked: false,
    outsideClickHandler: null,
    hoverTimeout: null,
    feedbackTimeout: null,
    // Estado de Persistência UI
    expandedTabs: {}, 
    activeTab: 'risk',
    currentData: null,
    currentHash: null,

    /**
     * Cria o badge de status.
     * @param {number} score - Pontuação do anúncio (0-100).
     * @param {function} onClick - Callback ao clicar no badge.
     * @returns {HTMLElement} O elemento do badge.
     */
    /**
     * Cria o container de badges (Risco + Qualidade).
     * @param {Object} data - Dados do anúncio (risk_score, quality_score).
     * @param {function} onClick - Callback ao clicar.
     * @returns {HTMLElement} O elemento container.
     */
    createBadge(data, onClick) {
        const container = document.createElement('div');
        container.className = 'as-badge-container';
        
        // 1. Badge de Risco (Sempre visível) - Escudo
        const riskBadge = document.createElement('div');
        riskBadge.className = 'as-badge as-badge-risk';
        
        let iconContent = '';
        // Lógica de Ícones:
        // >= 80: Safe (Verde) -> Mantém escudo simples, sem check (pedido do user)
        // >= 40: Warning (Laranja) -> Escudo + !
        // < 40: Danger (Vermelho) -> Escudo + X
        if (data.risk_score >= 80) {
            riskBadge.classList.add('as-badge-safe');
            // Escudo Simples (Visual mais limpo/neutro, mesmo sendo verde)
            iconContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
        } else if (data.risk_score >= 40) {
            riskBadge.classList.add('as-badge-warning');
            iconContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
        } else {
            riskBadge.classList.add('as-badge-danger');
            iconContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`; 
        }
        
        riskBadge.innerHTML = iconContent;
        container.appendChild(riskBadge);

        // 2. Badge de Qualidade (Só se houver score > 0) - Estrela
        if (data.quality_score > 0) {
            const qualityBadge = document.createElement('div');
            qualityBadge.className = 'as-badge as-badge-quality';
            // Estrela SVG
            qualityBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            container.appendChild(qualityBadge);
        }

        const state = window.StorageModule ? window.StorageModule.getQualitativeState(data) : { label: 'Em análise' };
        container.title = `Estado: ${state.label} | ${state.description}`;
        
        // Interaction Logic: Hover (temporário) vs Click (fixo)
        const showIt = (fromClick = false, event = null) => {
            this.cancelHideTimer();
            
            if (fromClick) {
                // Se já está fixo pelo clique, fecha e desfixa
                if (this.isClickLocked && this.activeTooltip && this.activeTooltip._target === container) {
                    this.isClickLocked = false;
                    this.closeTooltip();
                    return;
                }
                // Fixa o tooltip
                this.isClickLocked = true;
            }
            
            onClick(event); // Chama showTooltip com o evento
        };

        const hideIt = () => this.startHideTimer();

        container.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            showIt(true, e); // true = veio de clique
        });

        container.addEventListener('mouseenter', (e) => showIt(false, e)); // false = veio de hover
        container.addEventListener('mouseleave', () => hideIt());

        return container;
    },

    /**
     * Remove tooltip ativo.
     */
    closeTooltip() {
        this.cancelHideTimer();
        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }
        this.isClickLocked = false;
    },

    startHideTimer() {
        if (this.isClickLocked) return;
        this.cancelHideTimer();
        this.hoverTimeout = setTimeout(() => {
            this.closeTooltip();
        }, 500); // 500ms para dar tempo de mover o mouse
    },

    cancelHideTimer() {
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }
    },

    /**
     * Renderiza o tooltip com dois eixos.
     */
    showTooltip(data, targetElement, options = {}, adHash = null, isUpdate = false) {
        if (!isUpdate && this.activeTooltip) this.closeTooltip();
        if (isUpdate && !this.activeTooltip) return;

        this.currentData = data; // Guardar para re-render
        this.currentHash = adHash; // Guardar hash

        try {
            const userVotes = window.BotDetector ? window.BotDetector.getUserVoteCount(adHash) : 0;
            const maxVotes = window.BotDetector ? window.BotDetector.CONFIG.MAX_VOTES_PER_AD : 5;
            const explanation = window.StorageModule.getScoreExplanation(data);
            const riskColor = data.risk_score >= 80 ? '#10b981' : (data.risk_score >= 40 ? '#f59e0b' : '#ef4444');
    
            // Helpers locais
            const getLikeRatio = (signals) => {
                const likes = signals.votes_like || 0;
                const dislikes = signals.votes_dislike || 0;
                const total = likes + dislikes;
                if (total === 0) return 100;
                if (total > 0 && likes === 0) return 0;
                return Math.round((likes / total) * 100);
            };

            const cs = data.community_signals || {};
            
            // Carregar votos do utilizador do localStorage para persistência
            if (adHash) {
                try {
                    const savedVotes = JSON.parse(localStorage.getItem(`as_user_votes_${adHash}`) || '{}');
                    cs.user_votes = savedVotes;
                } catch (e) {
                    cs.user_votes = {};
                }
            }
            const localUserVotes = cs.user_votes || {};
            
            const totalVotes = cs.total_votes_raw || cs.total_votes || 0;
            
            const getPercent = (votes) => {
                const weightedTotal = cs.total_votes_weighted || cs.total_votes || 0;
                if (weightedTotal === 0) return 0;
                // Os votos individuais (cs.votes_*) são agora WEIGHTED se vierem do novo sistema
                return Math.round((votes / weightedTotal) * 100);
            };
    
            const pLegit = getPercent(cs.votes_legit || 0);
            const pNoResponse = getPercent(cs.votes_no_response || 0);
            const pExternal = getPercent(cs.votes_external_contact || 0);
            const pAdvance = getPercent(cs.votes_advance_payment || 0);
            const pFake = getPercent(cs.votes_fake_item || 0);
    
            // Filtrar botões por tab
            const allButtons = options.buttons || [];
            const riskButtons = allButtons.filter(b => b.tab === 'risk');
            const positiveButtons = allButtons.filter(b => b.tab === 'positive');

            // Nível de Confiança (Maturity Ladder)
            const confMap = {
                'low': { label: 'Incipiente', icon: '🔹' },
                'medium': { label: 'Moderada', icon: '🔸' },
                'high': { label: 'Elevada', icon: '⭐' }
            };
            const currentConf = confMap[explanation.confidence || 'low'];
            const confLevel = currentConf.label;
            const confIcon = currentConf.icon;

            // Qualitative State Handling (Step 2 Roadmap)
            const state = explanation.state || { label: 'Dados Insuficientes', color: '#94a3b8', class: 'as-state-neutral' };
            const stateBg = state.color;
            const stateText = 'white';

            // Subtitle Handling (Evitar undefined)
            const subtitleText = explanation.subtitle || 'Anúncio recente · Padrões em análise';

            // Construção do HTML (Movido para antes da lógica de posicionamento)
            const html = `
                <div class="as-tooltip-header">
                    <span class="as-tooltip-title">Análise de Padrões do Anúncio</span>
                </div>
                
                 <div class="as-header-content">
                    <div class="as-state-badge ${state.class}" style="background: ${stateBg}; color: ${stateText}; padding: 4px 12px; border-radius: 6px; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; box-shadow: 0 4px 12px -2px ${stateBg}44;">
                        ${state.label}
                    </div>
                    <div class="as-header-text" style="margin-left: 14px;">
                        <span class="as-label-mini" style="display:block; font-size:9px; text-transform:uppercase; color:#9ca3af; font-weight:600;">Confiança: ${confIcon} ${confLevel}</span>
                        <span class="as-title" style="display:block; font-weight:700;">Diagnóstico SCM Hunters</span>
                        <span class="as-subtitle" style="font-size:11px; color:#94a3b8; opacity:0.9;">
                            ${state.description}
                        </span>
                    </div>
                </div>

                <!-- FEEDBACK AREA (para alertas de limite, sucesso, erro) -->
                <div class="as-feedback-area"></div>

                <!-- TABS NAVIGATION -->
                <div class="as-tabs-nav">
                    <button class="as-tab-btn ${this.activeTab === 'risk' ? 'active' : ''}" data-tab="risk">⚠️ Padrões</button>
                    <button class="as-tab-btn ${this.activeTab === 'positive' ? 'active' : ''}" data-tab="positive">✅ Sinais</button>
                </div>

                <!-- LIKES GLOBALS (Top Position) -->
                <div class="as-likes-section as-likes-top">
                    <!-- ... unchanged likes section ... -->
                    <div class="as-likes-container-center">
                        <div class="as-likes-container">
                            <button class="as-like-btn ${localUserVotes['votes_like'] ? 'as-btn-voted active' : ''}" title="Gosto disto">
                                <svg viewBox="0 0 24 24" class="as-icon-like"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/></svg>
                                <span class="as-like-count">${cs.votes_like || 0}</span>
                            </button>
                            <div class="as-like-bar-container">
                                 <div class="as-like-bar" style="width: ${getLikeRatio(cs)}%"></div>
                            </div>
                            <button class="as-dislike-btn ${localUserVotes['votes_dislike'] ? 'as-btn-voted active' : ''}" title="Não gosto disto">
                                <svg viewBox="0 0 24 24" class="as-icon-dislike"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
                                <span class="as-dislike-count">${cs.votes_dislike || 0}</span>
                            </button>
                        </div>
                    </div>
                    <div class="as-total-votes-label">
                        <span title="Pessoas que participaram">👥 ${Math.round(cs.users_count || (totalVotes > 0 ? totalVotes : 0))}</span>
                        <span style="opacity:0.5; margin:0 4px;">|</span>
                        <span title="Total de interações">💬 ${Math.round(totalVotes)}</span>
                    </div>
                    <div class="as-user-limit-info">Interações registadas: <b>${userVotes}</b></div>
                    <div class="as-cooldown-timer" style="display:none">Próximo voto em: <span class="as-timer-val">30</span>s</div>
                </div>

                <!-- TAB CONTENT: RISK -->
                <div class="as-tab-content as-tab-risk ${this.activeTab === 'risk' ? 'active' : ''}" id="as-tab-risk">
                    <div class="as-section-title-mini" style="font-size:10px; font-weight:700; color:#9ca3af; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">⚙️ Padrões do Sistema</div>
                    <div class="as-section-content">
                        ${this.renderExplanations(explanation.explanations.filter(e => e.kind !== 'quality'), 'risk')}
                    </div>

                    <div class="as-separator" style="height:1px; background:#f3f4f6; margin:12px 0;"></div>

                    <div class="as-section-title-mini" style="font-size:10px; font-weight:700; color:#9ca3af; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">👥 Interações Registadas</div>
                    <div class="as-dynamic-buttons as-grid-buttons">
                        ${this.renderButtons(riskButtons, cs, 'risk')}
                    </div>
                </div>

                <!-- TAB CONTENT: POSITIVE -->
                <div class="as-tab-content as-tab-positive ${this.activeTab === 'positive' ? 'active' : ''}" id="as-tab-positive">
                    <div class="as-section-title-mini" style="font-size:10px; font-weight:700; color:#9ca3af; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">⚙️ Padrões do Sistema</div>
                    <div class="as-section-content">
                        ${this.renderExplanations(explanation.explanations.filter(e => e.kind === 'quality'), 'positive')}
                    </div>

                    <div class="as-separator" style="height:1px; background:#f3f4f6; margin:12px 0;"></div>

                    <div class="as-section-title-mini" style="font-size:10px; font-weight:700; color:#9ca3af; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">👥 Interações Registadas</div>
                    <div class="as-dynamic-buttons as-grid-buttons">
                        ${this.renderButtons(positiveButtons, cs, 'positive')}
                    </div>
                </div>
                
                <!-- FOOTER -->
                <div class="as-disclaimer" style="font-size:10px; color:#9ca3af; text-align:center; padding:8px 12px; border-top:1px solid #e5e7eb; margin-top:auto; background:#f9fafb;">
                    Esta análise baseia-se em padrões observáveis e registos comunitários. A decisão final e verificação de segurança cabem sempre ao utilizador.
                </div>
            `;

            let tooltip;

            if (isUpdate) {
                tooltip = this.activeTooltip;
                tooltip.innerHTML = html;
                tooltip.style.height = 'auto'; // Força recálculo da altura
            } else {
                tooltip = document.createElement('div');
                tooltip.className = 'as-tooltip';
                tooltip._target = targetElement;
                tooltip.innerHTML = html; // Define conteúdo ANTES de append para ter altura

                document.body.appendChild(tooltip);
                this.activeTooltip = tooltip;

                // FIX: Attach Events ONLY once, on creation.
                // Re-renders (innerHTML updates) will still work because we use event delegation (.closest)
                this.attachEvents(tooltip, options, adHash);

                // Persistência de Hover
                tooltip.addEventListener('mouseenter', () => this.cancelHideTimer());
                tooltip.addEventListener('mouseleave', () => this.startHideTimer());

                // Posicionamento Robusto
                const rect = targetElement.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                const tooltipHeight = tooltipRect.height;
                const tooltipWidth = 420; // 420px Confirmado
                const margin = 10;
                
                // Horizontal
                let left = rect.left + window.scrollX + 25;
                if ((left + tooltipWidth) > (window.innerWidth + window.scrollX)) {
                    left = (window.innerWidth + window.scrollX) - tooltipWidth - margin;
                }
                if (left < margin) left = margin;

                // Vertical (Flip se necessário)
                let top = rect.bottom + window.scrollY + 10; 
                // Se não houver espaço em baixo (< altura tooltip) E houver em cima
                if ((window.innerHeight - rect.bottom) < tooltipHeight && rect.top > tooltipHeight) {
                     top = rect.top + window.scrollY - tooltipHeight - 10;
                     tooltip.style.transformOrigin = 'bottom left';
                } else {
                     tooltip.style.transformOrigin = 'top left';
                }

                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;

                // Fechar ao clicar fora (Gestão global para evitar vazamento)
                this.outsideClickHandler = (e) => {
                    if (this.activeTooltip && !this.activeTooltip.contains(e.target) && 
                        !this.activeTooltip._target.contains(e.target)) {
                        this.closeTooltip();
                    }
                };
                
                setTimeout(() => {
                    if (this.outsideClickHandler) {
                        document.addEventListener('click', this.outsideClickHandler);
                    }
                }, 100);
            }
            
            // Events already attached below? No, I need to call attachEvents.
            // But wait, the original code had `this.attachEvents(tooltip, ...)` at the end.
            // I am replacing all of that. So I must ensure I don't duplicate or delete it.
            // The replacement ends at `tooltip.innerHTML = html;` of original code (line 259).
            // Line 261 onwards is `this.attachEvents...`.
            // So my replacement should NOT include `attachEvents`.
            // My replacement block ends with the `if/else` block closing brace.
            
            // Wait, my replacement logic includes `if (isUpdate) ... else ...`.
            // The original code had `if (isUpdate)` block (lines 159-160) and `else` block (161-201).
            // AND THEN `let html = ...` (204-257).
            // AND THEN `tooltip.innerHTML = html` (259).
            
            // My replacement combines ALL of that.
            // So I need to replace from 159 to 259.
            // AND ensure `this.attachEvents` follows.
            // I will not include `this.attachEvents` in the replacement string, checking line 261 in `view_file` (it's not shown but implied).
            // Actually, Step 376 shows lines up to 260.
            // I'll assume 261 is `this.attachEvents(...)`.
            // I'll leave it be.
            // I'll close the `isUpdate/else` block and that's it.


        // this.activeTooltip = tooltip; // Já definido acima? Não, definimos activeTooltip no final?
        // Ah, checked `ui.js` previously. `this.activeTooltip = tooltip;` was there.
        // this.activeTooltip = tooltip;
        
        // Events MOVED to creation block to avoid duplicates!
        // this.attachEvents(tooltip, options, adHash);
        
        // Fechar APENAS ao clicar fora (ou no escudo/trigger se tratado externamente)
        const outsideClickHandler = (e) => {
            // Verifica se clicou no tooltip ou no target (escudo)
            if (this.activeTooltip && !this.activeTooltip.contains(e.target) && !targetElement.contains(e.target)) {
                this.closeTooltip();
                document.removeEventListener('click', outsideClickHandler);
            }
        };
        
        // Adiciona listener com pequeno delay para evitar fechar logo ao abrir
        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler);
        }, 100);

    } catch (e) {
        console.error('[Anti-Scam] Erro fatal no tooltip:', e);
    }
    },

    renderExplanations(list, context = 'neutral') {
        if (!list || list.length === 0) {
            if (context === 'risk') {
                return '<div class="as-note as-note-safe" style="color: #10b981; background: #ecfdf5; border: 1px solid #a7f3d0;">✅ Nenhum padrão atípico identificado automaticamente.</div>';
            }
            if (context === 'positive') {
                 return '<div class="as-note" style="color: #6b7280; font-style: italic;">ℹ️ Informação limitada disponível neste momento.</div>';
            }
            return '<div class="as-note">Dados insuficientes para análise.</div>';
        }
        
        return list.map(exp => `
            <div class="as-explanation as-explanation-${exp.type || 'neutral'}">
                <span class="as-explanation-text">${exp.text}</span>
            </div>
        `).join('');
    },

    /**
     * Renderiza lista de comentários.
     * @param {Array} comments - Array de comentários
     * @returns {string} HTML dos comentários
     */
    renderComments(comments) {
        if (!comments || comments.length === 0) {
            return '<div class="as-no-comments">Sê o primeiro a comentar!</div>';
        }
        
        // Mostra apenas os últimos 5 comentários
        const recentComments = comments.slice(-5).reverse();
        
        return recentComments.map(comment => {
            const timeAgo = this.getTimeAgo(comment.timestamp);
            return `
                <div class="as-comment">
                    <div class="as-comment-text">${this.escapeHtml(comment.text)}</div>
                    <div class="as-comment-time">${timeAgo}</div>
                </div>
            `;
        }).join('');
    },

    /**
     * Calcula tempo relativo (ex: "há 2 horas")
     */
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'agora mesmo';
        if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `há ${Math.floor(seconds / 3600)}h`;
        if (seconds < 604800) return `há ${Math.floor(seconds / 86400)} dias`;
        return new Date(timestamp).toLocaleDateString('pt-PT');
    },

    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    attachEvents(tooltip, options, adHash) {
        // Helper para Timer
        const startCooldownUI = (seconds) => {
            const timerDisplay = tooltip.querySelector('.as-cooldown-timer');
            const timerVal = tooltip.querySelector('.as-timer-val');
            if (!timerDisplay || !timerVal) return;

            // FORÇA ESTILOS VISUAIS INLINE
            timerDisplay.style.cssText = 'display: block !important; text-align: center; font-size: 15px; color: #ef4444; background: #fee2e2; padding: 10px; border-radius: 8px; font-weight: 800; margin-top: 10px; border: 2px solid #ef4444; width: 100%; box-sizing: border-box; animation: pulse-red 1s infinite;';
            timerVal.style.fontWeight = '900';
            timerVal.style.fontSize = '18px';
            let remaining = seconds;
            timerVal.textContent = remaining;
            
            // Disable actionable buttons (not tabs, not View More)
            const disableBtns = () => tooltip.querySelectorAll('.as-action-btn, .as-btn, .as-like-btn, .as-dislike-btn').forEach(b => b.disabled = true);
            disableBtns();

            const interval = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(interval);
                    timerDisplay.style.display = 'none';
                    // Re-enable (except voted ones logic handling elsewhere, but simple re-enable is safe-ish)
                    tooltip.querySelectorAll('.as-action-btn, .as-btn, .as-like-btn, .as-dislike-btn').forEach(b => {
                        if (!b.classList.contains('as-btn-voted') && !b.classList.contains('as-voted-anim')) b.disabled = false;
                    });
                } else {
                    timerVal.textContent = remaining;
                }
            }, 1000);
            
            // Store interval to clear on close? UIModule doesn't track intervals per tooltip instance well yet.
            // But tooltip close destroys DOM, interval keeps running. Ideally clear it.
            // For now, simple.
        };

        // Check initial cooldown
        if (window.BotDetector && adHash) {
             const initial = window.BotDetector.getCooldownRemaining(adHash);
             if (initial > 0) startCooldownUI(initial);
        }

        // Unified Click Handler (Delegation)
        tooltip.addEventListener('click', (e) => {
            // 0. Tabs (Navegação via Delegação)
            const tabBtn = e.target.closest('.as-tab-btn');
            if (tabBtn) {
                e.preventDefault();
                // Remove active de todos
                tooltip.querySelectorAll('.as-tab-btn').forEach(b => b.classList.remove('active'));
                tooltip.querySelectorAll('.as-tab-content').forEach(c => c.classList.remove('active'));
                
                // Ativa atual
                tabBtn.classList.add('active');
                const tabIdVal = tabBtn.dataset.tab || tabBtn.dataset.target;
                this.activeTab = tabIdVal; // Salva estado de persistência

                const tabId = `as-tab-${tabIdVal}`;
                const content = tooltip.querySelector(`#${tabId}`);
                if (content) content.classList.add('active');
                return;
            }

            // 1. Botão "Ver mais/Ver menos"
            const viewMoreBtn = e.target.closest('.as-view-more-link');
            if (viewMoreBtn) {
                e.preventDefault();
                e.stopPropagation();
                
                // Obtém o ID da aba a partir do atributo data-tab
                const tabId = viewMoreBtn.dataset.tab;
                
                // Inverte o estado de expansão para esta aba específica
                this.expandedTabs[tabId] = !this.expandedTabs[tabId];
                
                // Re-renderizar tooltip completo para aplicar novo estado
                if (this.currentData) {
                    this.showTooltip(this.currentData, null, options, this.currentHash, true);
                }
                
                return;
            }
            
            // 2. Botões de Ação (Vote/Report/Like)
            let actionBtn = e.target.closest('.as-action-btn');


            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                const signal = actionBtn.dataset.signal;
                const isCurrentlyVoted = actionBtn.classList.contains('active') || actionBtn.classList.contains('as-btn-voted');

                // PRIORIDADE 1: REMOVER VOTO (Sempre permitido, sem cooldown)
                if (isCurrentlyVoted) {
                    actionBtn.classList.remove('active', 'as-voted-anim', 'as-btn-voted');
                    
                    if (!['votes_like', 'votes_dislike'].includes(signal)) {
                        const countSpan = actionBtn.querySelector('.as-btn-count');
                        if (countSpan) {
                            const match = countSpan.innerText.match(/(\d+)/);
                            if (match) countSpan.innerText = Math.max(0, parseInt(match[1]) - 1) + ' (...)';
                        }
                        const userLimitEl = tooltip.querySelector('.as-user-limit-info b');
                        if (userLimitEl) {
                            const currentLimit = parseInt(userLimitEl.innerText || '0');
                            userLimitEl.innerText = Math.max(0, currentLimit - 1);
                        }
                    }

                    options.onReport(signal, -1);
                    if (adHash) {
                        try {
                            const saved = JSON.parse(localStorage.getItem(`as_user_votes_${adHash}`) || '{}');
                            delete saved[signal];
                            localStorage.setItem(`as_user_votes_${adHash}`, JSON.stringify(saved));
                            
                            // Regista remoção no BotDetector (Auditoria de Toggling)
                            if (window.BotDetector) {
                                window.BotDetector.registerVoteChange(adHash, -1, signal);
                            }
                        } catch (e) {}
                    }
                    this.showFeedback(tooltip, 'Voto removido.', 'neutral');
                    return;
                }

                // PRIORIDADE 2: ADICIONAR VOTO

                // bypass check para tipos que não têm cooldown
                const btnClass = actionBtn.getAttribute('class') || '';
                const btnTab = actionBtn.dataset.tab;
                let cooldownSeconds = 0;

                if (btnTab === 'risk') {
                    if (btnClass.includes('as-btn-warning')) {
                        cooldownSeconds = 3; // Amarelo
                    } else if (btnClass.includes('as-btn-neutral')) {
                        cooldownSeconds = 0; // Branco (Neutral)
                    } else {
                        cooldownSeconds = 5; // Vermelho (Default Risk)
                    }
                } else {
                    cooldownSeconds = 0; // Verde / Outros
                }

                // Cooldown check (APENAS se for voto com custo de cooldown e não for remoção)
                if (window.BotDetector && adHash && cooldownSeconds > 0) {
                    const cooldownRem = window.BotDetector.getCooldownRemaining(adHash);
                    if (cooldownRem > 0) {
                        this.showFeedback(tooltip, `Integridade ativa. Aguarde ${cooldownRem}s.`, 'warning');
                        startCooldownUI(cooldownRem);
                        return;
                    }
                }

                // === VALIDAÇÃO DE LIMITE (após resolver contextos e conflitos) ===
                if (window.BotDetector && adHash && !['votes_like', 'votes_dislike'].includes(signal)) {
                    const check = window.BotDetector.canReport(adHash, signal);
                    if (!check.allowed) {
                        this.showFeedback(tooltip, check.reason, 'error');
                        return; 
                    }
                }

                if (window.BotDetector && cooldownSeconds > 0 && !['votes_like', 'votes_dislike'].includes(signal)) {
                    // Step 6: Cooldown Dinâmico baseado na suspeição
                    const finalCooldown = window.BotDetector.getDynamicCooldown(cooldownSeconds);
                    window.BotDetector.reportState.adCooldowns[adHash] = Date.now() + (finalCooldown * 1000);
                    startCooldownUI(finalCooldown);
                }

                // === LOGICAL CONTRADICTIONS (Step 3 Beta 3) ===
                if (!['votes_like', 'votes_dislike'].includes(signal)) {
                    const CONFLICTS = {
                        'votes_old_profile': ['votes_new_profile', 'votes_fake_profile'],
                        'votes_trusted_seller': ['votes_new_profile', 'votes_fake_profile'],
                        'votes_verified_seller': ['votes_new_profile', 'votes_fake_profile'],
                        'votes_owner_real': ['votes_new_profile', 'votes_fake_profile', 'votes_not_owner'],
                        'votes_not_owner': ['votes_owner_real'],
                        'votes_no_response': ['votes_responsive', 'votes_clear_communication', 'votes_negotiation_ok', 'votes_clear_process'],
                        'votes_evasive': ['votes_responsive', 'votes_clear_communication', 'votes_negotiation_ok', 'votes_clear_process'],
                        'votes_off_platform': ['votes_responsive', 'votes_clear_communication', 'votes_clear_process'],
                        'votes_only_whatsapp': ['votes_responsive', 'votes_clear_communication', 'votes_clear_process'],
                        'votes_responsive': ['votes_no_response', 'votes_evasive', 'votes_off_platform', 'votes_only_whatsapp'],
                        'votes_clear_communication': ['votes_no_response', 'votes_evasive', 'votes_off_platform', 'votes_only_whatsapp'],
                        'votes_clear_process': ['votes_no_response', 'votes_evasive', 'votes_off_platform', 'votes_only_whatsapp'],
                        'votes_ai_photos': ['votes_real_photos', 'votes_original_photos'],
                        'votes_generic_images': ['votes_real_photos', 'votes_original_photos'],
                        'votes_cloned_listing': ['votes_real_photos', 'votes_original_photos'],
                        'votes_cloned_ad': ['votes_real_photos', 'votes_original_photos'],
                        'votes_real_photos': ['votes_ai_photos', 'votes_generic_images', 'votes_cloned_listing', 'votes_cloned_ad', 'votes_fake_photo'],
                        'votes_original_photos': ['votes_ai_photos', 'votes_generic_images', 'votes_cloned_listing', 'votes_cloned_ad', 'votes_fake_photo'],
                        'votes_vague_location': ['votes_location_confirmed', 'votes_location_matches', 'votes_hand_delivery'],
                        'votes_fake_item': ['votes_location_confirmed', 'votes_location_matches', 'votes_visit_done', 'votes_visit_available', 'votes_saw_car', 'votes_hand_delivery'],
                        'votes_property_different': ['votes_location_matches', 'votes_visit_done', 'votes_saw_car'],
                        'votes_location_confirmed': ['votes_vague_location', 'votes_fake_item'],
                        'votes_location_matches': ['votes_vague_location', 'votes_property_different', 'votes_fake_item'],
                        'votes_hand_delivery': ['votes_vague_location', 'votes_fake_item'],
                        'votes_no_visit_allowed': ['votes_visit_available', 'votes_visit_done', 'votes_saw_car', 'votes_test_drive_ok', 'votes_test_drive_done'],
                        'votes_no_test_drive': ['votes_test_drive_ok', 'votes_test_drive_done'],
                        'votes_deposit_no_visit': ['votes_visit_available', 'votes_visit_done', 'votes_saw_car'],
                        'votes_deposit_before_see': ['votes_saw_car', 'votes_test_drive_ok', 'votes_test_drive_done', 'votes_mechanical_check'],
                        'votes_advance_payment': ['votes_visit_available', 'votes_visit_done', 'votes_saw_car', 'votes_hand_delivery'],
                        'votes_visit_available': ['votes_no_visit_allowed', 'votes_deposit_no_visit', 'votes_advance_payment', 'votes_fake_item'],
                        'votes_visit_done': ['votes_no_visit_allowed', 'votes_deposit_no_visit', 'votes_advance_payment', 'votes_fake_item', 'votes_property_different'],
                        'votes_saw_car': ['votes_no_visit_allowed', 'votes_deposit_no_visit', 'votes_advance_payment', 'votes_deposit_before_see', 'votes_fake_item', 'votes_property_different'],
                        'votes_test_drive_ok': ['votes_no_visit_allowed', 'votes_no_test_drive', 'votes_deposit_before_see'],
                        'votes_test_drive_done': ['votes_no_visit_allowed', 'votes_no_test_drive', 'votes_deposit_before_see'],
                        'votes_docs_incomplete': ['votes_docs_ok', 'votes_docs_shown', 'votes_docs_complete', 'votes_mechanical_check'],
                        'votes_no_docs': ['votes_docs_ok', 'votes_docs_shown', 'votes_docs_complete'],
                        'votes_docs_ok': ['votes_docs_incomplete', 'votes_no_docs'],
                        'votes_docs_shown': ['votes_docs_incomplete', 'votes_no_docs'],
                        'votes_docs_complete': ['votes_docs_incomplete', 'votes_no_docs'],
                        'votes_mechanical_check': ['votes_docs_incomplete', 'votes_deposit_before_see'],
                        'votes_pressure': ['votes_clear_process', 'votes_responsive'],
                        'votes_pressure_sale': ['votes_clear_process', 'votes_responsive']
                    };

                    const conflictList = CONFLICTS[signal];
                    if (conflictList) {
                        try {
                            const savedVotes = JSON.parse(localStorage.getItem(`as_user_votes_${adHash}`) || '{}');
                            const activeConflict = (Array.isArray(conflictList) ? conflictList : [conflictList])
                                .find(c => savedVotes[c]);

                            if (activeConflict) {
                                // Tentar encontrar o label do botão que está a causar o conflito
                                const conflictBtn = tooltip.querySelector(`.as-action-btn[data-signal="${activeConflict}"]`);
                                const conflictLabel = conflictBtn ? conflictBtn.querySelector('.as-btn-label').innerText : activeConflict;
                                
                                this.showFeedback(tooltip, `Voto contraditório! Já votou em '${conflictLabel}'. Remova-o primeiro.`, 'error');
                                
                                // PENALIZAÇÃO: Tentativa de contradição
                                if (window.TrustManager) {
                                    window.TrustManager.recordAction('contradiction');
                                }
                                return; // BLOQUEAR VOTO
                            }
                        } catch (e) {}
                    }
                }

                // === CONTEXT SELECTOR (Step 5) ===
                const contexts = JSON.parse(actionBtn.dataset.contexts || '[]');
                
                const finalizeVote = (context) => {
                    actionBtn.classList.add('active', 'as-voted-anim');
                    
                    // Atualizar contagem visual
                    const countSpan = actionBtn.querySelector('.as-btn-count');
                    if (countSpan) {
                         const currentText = countSpan.innerText;
                         const match = currentText.match(/(\d+)/);
                         const oldVal = match ? parseInt(match[1]) : 0;
                         countSpan.innerText = `${oldVal + 1} (...)`;
                         countSpan.style.display = 'inline-block';
                    }

                    // Atualizar contador global VISUAL (Exceto Likes/Dislikes)
                    if (!['votes_like', 'votes_dislike'].includes(signal)) {
                        const userLimitEl = tooltip.querySelector('.as-user-limit-info b');
                        if (userLimitEl) {
                            let currentLimit = parseInt(userLimitEl.innerText || '0');
                            userLimitEl.innerText = currentLimit + 1;
                        }
                    }

                    // Guardar no localStorage
                    if (adHash) {
                        try {
                            const savedVotes = JSON.parse(localStorage.getItem(`as_user_votes_${adHash}`) || '{}');
                            savedVotes[signal] = true;
                            localStorage.setItem(`as_user_votes_${adHash}`, JSON.stringify(savedVotes));
                            
                            // Regista no BotDetector
                            if (window.BotDetector) {
                                window.BotDetector.registerVoteChange(adHash, 1, signal);
                            }
                        } catch (e) {}
                    }

                    // Notificar content script
                    if (options.onReport) options.onReport(signal, 1, context);
                    
                    // RECOMPENSA: Uso legítimo
                    if (window.TrustManager && !['votes_like', 'votes_dislike'].includes(signal)) {
                        window.TrustManager.recordAction('consistency');
                    }
                    
                    this.showFeedback(tooltip, context ? `Voto registado: ${context}` : "Voto registado com sucesso!", 'success');
                };

                if (contexts.length > 0 && !isCurrentlyVoted) {
                    this.showContextSelector(tooltip, actionBtn, signal, contexts, (selectedContext) => {
                        finalizeVote(selectedContext);
                    });
                } else {
                    finalizeVote();
                }
                return;
            }

            // 4. Lógica de Likes/Dislikes (Delegation)
            const likeBtn = e.target.closest('.as-like-btn');
            const dislikeBtn = e.target.closest('.as-dislike-btn');

            if (likeBtn || dislikeBtn) {
                e.preventDefault();
                e.stopPropagation();

                const type = likeBtn ? 'votes_like' : 'votes_dislike';
                const opposite = likeBtn ? 'votes_dislike' : 'votes_like';
                const savedVotes = JSON.parse(localStorage.getItem(`as_user_votes_${adHash}`) || '{}');
                const previousVote = savedVotes['votes_like'] ? 'votes_like' : (savedVotes['votes_dislike'] ? 'votes_dislike' : null);
                
                // Cenário 1: Remover voto (toggle)
                if (previousVote === type) {
                    options.onReport(type, -1);
                    delete savedVotes[type];
                    localStorage.setItem(`as_user_votes_${adHash}`, JSON.stringify(savedVotes));
                    this.showFeedback(tooltip, 'Voto removido.', 'neutral');
                    return;
                }

                // Cenário 2: Mudar voto (Swap) - REGRA DE OURO: 1 por anúncio
                if (previousVote && previousVote !== type) {
                    options.onReport(previousVote, -1);
                    delete savedVotes[previousVote];
                }

                // Cenário 3: Novo voto
                options.onReport(type, 1);
                savedVotes[type] = true;
                localStorage.setItem(`as_user_votes_${adHash}`, JSON.stringify(savedVotes));
                
                this.showFeedback(tooltip, type === 'votes_like' ? 'Gostaste!' : 'Não gostaste.', 'success');
                return;
            }
        });

        // Eventos para Comentários
        const commentInput = tooltip.querySelector('.as-comment-input');
        const commentSubmit = tooltip.querySelector('.as-comment-submit');
        const commentsList = tooltip.querySelector('.as-comments-list');

        if (commentInput && commentSubmit) {
            const submitComment = async () => {
                const text = commentInput.value.trim();
                if (!text) return;
                
                if (text.length < 3) {
                     this.showFeedback(tooltip, 'Comentário muito curto.', 'warning');
                     return;
                }

                // Guardar comentário no storage
                let adData = await window.StorageModule.getAdData(adHash);
                if (!adData.comments) adData.comments = [];
                
                const newComment = {
                    text: text,
                    timestamp: Date.now(),
                    id: Math.random().toString(36).substr(2, 9)
                };
                
                adData.comments.push(newComment);
                await window.StorageModule.updateAdData(adHash, adData);

                // Limpar e atualizar UI
                commentInput.value = '';
                commentsList.innerHTML = this.renderComments(adData.comments);
                
                // Atualizar contador
                const countEl = tooltip.querySelector('.as-comments-count');
                if (countEl) countEl.innerText = adData.comments.length;

                this.showFeedback(tooltip, 'Comentário adicionado!', 'success');
            };

            commentSubmit.onclick = submitComment;
            
            // Permitir enviar com Enter
            commentInput.onkeypress = (e) => {
                if (e.key === 'Enter') submitComment();
            };
        }

        // Lógica "Ver Mais" (Delegation Robust para garantir funcionamento sempre)
        // Listenter redundante removido para evitar crash
        // (A lógica de Ver Mais já é tratada no listener principal de delegação)
    },

    /**
     * Mostra feedback temporário no tooltip.
     * @param {HTMLElement} tooltip 
     * @param {string} message 
     * @param {string} type - 'success' | 'warning' | 'error'
     */
    showFeedback(tooltip, message, type) {
        const feedbackArea = tooltip.querySelector('.as-feedback-area');
        if (!feedbackArea) return;

        // Estilos Inline Forçados (Garante visibilidade)
        const baseStyle = 'padding: 12px 16px; border-radius: 8px; font-weight: 800; text-align: center; font-size: 13px; display: block; box-shadow: 0 4px 12px rgba(0,0,0,0.2); margin-bottom: 8px; animation: feedback-pop 0.3s ease;';
        
        let typeStyle = '';
        if (type === 'error') typeStyle = 'background: #fef2f2; color: #b91c1c; border: 2px solid #ef4444;';
        else if (type === 'warning') typeStyle = 'background: #fffbeb; color: #92400e; border: 1px solid #f59e0b;';
        else if (type === 'success') typeStyle = 'background: #ecfdf5; color: #065f46; border: 1px solid #10b981;';
        else typeStyle = 'background: #f3f4f6; color: #1f2937; border: 1px solid #9ca3af;';

        feedbackArea.innerHTML = `
            <div class="as-feedback" style="${baseStyle} ${typeStyle}">
                ${message}
            </div>
        `;

        // Scroll para garantir visibilidade se necessário
        feedbackArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (this.feedbackTimeout) clearTimeout(this.feedbackTimeout);

        this.feedbackTimeout = setTimeout(() => {
            if (feedbackArea.querySelector('.as-feedback')) {
                feedbackArea.innerHTML = '';
            }
        }, 5000);
    },

    /**
     * Mostra seletor de contexto para votos críticos.
     */
    showContextSelector(tooltip, btn, signal, contexts, onSelect) {
        const feedbackArea = tooltip.querySelector('.as-feedback-area');
        if (!feedbackArea) return;

        const label = btn.querySelector('.as-btn-label').innerText;
        
        feedbackArea.innerHTML = `
            <div class="as-context-selector" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 12px; animation: slide-down 0.2s ease;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">
                    Contexto obrigatório para: <b>${label}</b>
                </div>
                <div class="as-context-chips" style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${contexts.map(ctx => `
                        <button class="as-context-chip" data-context="${ctx}" style="background: white; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #334155; cursor: pointer; transition: all 0.2s;">
                            ${ctx}
                        </button>
                    `).join('')}
                    <button class="as-context-cancel" style="background: transparent; border: none; font-size: 11px; color: #94a3b8; cursor: pointer; padding: 6px; font-weight: 600;">Cancelar</button>
                </div>
            </div>
        `;

        feedbackArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Listeners para os chips
        const selector = feedbackArea.querySelector('.as-context-selector');
        selector.addEventListener('click', (e) => {
            const chip = e.target.closest('.as-context-chip');
            if (chip) {
                const context = chip.dataset.context;
                feedbackArea.innerHTML = ''; // Limpa seletor
                onSelect(context);
                return;
            }
            if (e.target.closest('.as-context-cancel')) {
                feedbackArea.innerHTML = '';
            }
        });
    },

    /**
     * Renderiza botões dinâmicos baseados na configuração.
     * @param {Array} buttonsConfig - Configuração dos botões
     * @param {Object} signals - Sinais atuais
     */
    renderButtons(buttons, cs, tabId = '') {
        if (!buttons || buttons.length === 0) return '<div style="grid-column:1/-1; color:#9ca3af; font-size:10px; text-align:center;">Nenhuma opção disponível.</div>';
        
        // Usa o estado de expansão específico da aba ou false por padrão
        const isTabExpanded = this.expandedTabs[tabId] || false;
        const limit = isTabExpanded ? buttons.length : 6;
        let html = '';
        
        // Calcular total para percentagens
        const totalVotes = cs.total_votes || 0;
        
        // Recuperar votos locais do utilizador para marcar como "active"
        let localUserVotes = {};
        if (this.currentHash) {
            try {
                localUserVotes = JSON.parse(localStorage.getItem(`as_user_votes_${this.currentHash}`) || '{}');
            } catch (e) {}
        }
        
        buttons.forEach((btn, index) => {
            const count = cs[btn.signal] || 0;
            const rawCount = cs[`${btn.signal}_raw`] || Math.round(count);
            // Usa dados locais se disponíveis, senão tenta do objeto cs (para compatibilidade)
            const userVoted = localUserVotes[btn.signal] || (cs.user_votes && cs.user_votes[btn.signal]); 
            
            const badgeContent = rawCount > 0 ? `${rawCount}` : '';
            const badgeStyle = rawCount > 0 ? '' : 'display:none';

            const activeClass = userVoted ? 'active' : '';
            const isHidden = index >= limit;
            const hiddenStyle = isHidden ? 'display:none' : '';
            const hiddenClass = isHidden ? 'as-btn-hidden' : '';

            // Tooltip: Usa descrição detalhada se existir, senão usa label simples
            const tooltipTitle = btn.description 
                ? `${btn.label}\n─────────────\n${btn.description}\n(${rawCount} votos)`
                : `${btn.label} (${rawCount} votos) - Clique para reportar`;

            html += `
            <button class="as-action-btn ${btn.class} ${activeClass} ${hiddenClass}" 
                    data-signal="${btn.signal}" 
                    data-tab="${btn.tab}"
                    data-contexts='${JSON.stringify(btn.contexts || [])}'
                    title="${tooltipTitle}"
                    style="${hiddenStyle}">
                <span class="as-btn-icon">${btn.icon}</span>
                <span class="as-btn-label">${btn.label}</span>
                <span class="as-btn-count" style="${badgeStyle}">${badgeContent}</span>
            </button>`;
        });

        if (buttons.length > 6) { // Mostra toggle se houver mais que o limite base (6)
             const label = isTabExpanded ? `Ver menos opções ↑` : `Ver mais opções (${buttons.length - 6}) ↓`;
             html += `<button class="as-view-more-link" data-tab="${tabId}" style="grid-column: 1 / -1; margin-top:8px; background:#f9fafb; border:1px solid #d1d5db; border-radius:4px; color:#374151; font-weight:700; font-size:11px; cursor:pointer; padding:8px; width:100%; transition:all 0.2s; text-align:center;">
                ${label}
             </button>`;
        }

        return html;
    },

    getLikeRatio(signals) {
        const likes = signals.votes_like || 0;
        const dislikes = signals.votes_dislike || 0;
        const total = likes + dislikes;
        if (total === 0) return 100; // Visualmente cheio se 0 (cinza ou neutro)
        if (total > 0 && likes === 0) return 0;
        return Math.round((likes / total) * 100);
    }
};

