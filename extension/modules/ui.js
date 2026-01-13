/**
 * UI Module
 * Responsável por criar e gerenciar badges e tooltips.
 * ATUALIZADO: Tooltips com explicações semânticas e feedback anti-abuso.
 */

window.UIModule = {
    activeTooltip: null,
    isClickLocked: false, // Estado global: tooltip fixo por clique

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
        if (data.risk_score >= 80) {
            riskBadge.classList.add('as-badge-safe');
            // Escudo com Check
            iconContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`;
        } else if (data.risk_score >= 40) {
            riskBadge.classList.add('as-badge-warning');
            // Escudo com Exclamação
            iconContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
        } else {
            riskBadge.classList.add('as-badge-danger');
            // Escudo com X (Raio/Alerta)
            iconContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`; // Modificado para cruz simples dentro do escudo ou similar
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

        container.title = `Risco: ${data.risk_score} | Qualidade: ${data.quality_score}`;
        
        // Interaction Logic: Hover (temporário) vs Click (fixo)
        let hoverTimeout;

        const showIt = (fromClick = false) => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            
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
            
            onClick(); // Chama showTooltip
        };

        const hideIt = () => {
            // Só fecha se não estiver fixo por clique
            if (this.isClickLocked) return;
            
            hoverTimeout = setTimeout(() => {
                this.closeTooltip();
            }, 300); // 300ms delay para permitir mover para o tooltip
        };

        container.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            showIt(true); // true = veio de clique
        });

        container.addEventListener('mouseenter', () => showIt(false)); // false = veio de hover
        container.addEventListener('mouseleave', hideIt);

        return container;
    },

    closeTimer: null,

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
     * Renderiza o tooltip com dois eixos.
     */
    showTooltip(data, targetElement, options = {}, adHash = null, isUpdate = false) {
        if (!isUpdate && this.activeTooltip) this.closeTooltip();
        if (isUpdate && !this.activeTooltip) return;

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
            
            const totalVotes = (cs.votes_legit || 0) + (cs.votes_no_response || 0) + 
                              (cs.votes_external_contact || 0) + (cs.votes_advance_payment || 0) + 
                              (cs.votes_fake_item || 0);
            
            const getPercent = (votes) => {
                if (totalVotes === 0) return 0;
                return Math.round((votes / totalVotes) * 100);
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

            // Nível de Confiança (Beta 3 Step 2)
            let confLevel = 'Baixa';
            let confIcon = '🔹';
            const sigs = data.analysis?.signals || {};
            const tVotes = cs.total_votes || 0;
            
            if ((sigs.textLength > 300 && sigs.photoCount >= 3) || tVotes > 2) {
                confLevel = 'Moderada';
                confIcon = '🔸';
            }
            if (tVotes > 10 || (sigs.textLength > 800 && sigs.photoCount > 8)) {
                confLevel = 'Alta';
                confIcon = '⭐';
            }

            // Score Handling (Beta 3.1)
            const rawScore = data.score || data.risk_score;
            // Se score for muito baixo (0-5) e confiança não for Alta, assumimos dados insuficientes/instáveis
            const isScoreUnreliable = (rawScore <= 5 && confLevel !== 'Alta');
            const scoreDisplay = isScoreUnreliable ? '<span style="font-size:20px; line-height:40px;">?</span>' : rawScore;
            // Ajustar cor do anel para cinzento se não for fiável
            const finalRingColor = isScoreUnreliable ? '#d1d5db' : riskColor; 
            const finalRingBg = isScoreUnreliable ? '#f3f4f6' : finalRingColor;
            const finalRingText = isScoreUnreliable ? '#9ca3af' : 'white';

            // Subtitle Handling (Evitar undefined)
            const subtitleText = explanation.subtitle || 'Anúncio recente · Padrões em análise';

            // Construção do HTML (Movido para antes da lógica de posicionamento)
            const html = `
                <div class="as-tooltip-header">
                    <span class="as-tooltip-title">Análise de Padrões do Anúncio</span>
                </div>
                
                 <div class="as-header-content">
                    <div class="as-score-ring" title="Indicador Global" style="background: ${finalRingBg}; color: ${finalRingText}; display:flex; align-items:center; justify:center; width: 40px; height: 40px; border-radius:50%; font-weight:bold; border: 2px solid ${finalRingColor}; box-sizing:border-box;">${scoreDisplay}</div>
                    <div class="as-header-text" style="margin-left: 10px;">
                        <span class="as-label-mini" style="display:block; font-size:9px; text-transform:uppercase; color:#9ca3af; font-weight:600;">Indicador Global</span>
                        <span class="as-title" style="display:block; font-weight:700;">${explanation.title || 'Análise de Anúncio'}</span>
                        <span class="as-subtitle" style="font-size:11px; color:#666;">
                            ${subtitleText} <span style="opacity:0.6; margin-left:4px;">· Preliminar</span>
                        </span>
                        <div class="as-confidence-level" style="font-size:10px; color:#6b7280; margin-top:2px;">
                            ${confIcon} Confiança <b>${confLevel}</b>
                        </div>
                    </div>
                </div>

                <!-- FEEDBACK AREA (para alertas de limite, sucesso, erro) -->
                <div class="as-feedback-area"></div>

                <!-- TABS NAVIGATION -->
                <div class="as-tabs-nav">
                    <button class="as-tab-btn active" data-tab="risk">⚠️ Padrões</button>
                    <button class="as-tab-btn" data-tab="positive">✅ Sinais</button>
                </div>

                <!-- LIKES GLOBALS (Top Position) -->
                <div class="as-likes-section as-likes-top">
                    <!-- ... unchanged likes section ... -->
                    <div class="as-likes-container-center">
                        <div class="as-likes-container">
                            <button class="as-like-btn" title="Gosto disto">
                                <svg viewBox="0 0 24 24" class="as-icon-like"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/></svg>
                                <span class="as-like-count">${cs.votes_like || 0}</span>
                            </button>
                            <div class="as-like-bar-container">
                                 <div class="as-like-bar" style="width: ${getLikeRatio(cs)}%"></div>
                            </div>
                            <button class="as-dislike-btn" title="Não gosto disto">
                                <svg viewBox="0 0 24 24" class="as-icon-dislike"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
                                <span class="as-dislike-count">${cs.votes_dislike || 0}</span>
                            </button>
                        </div>
                    </div>
                    <div class="as-total-votes-label">
                        <span title="Pessoas que participaram">👥 ${cs.users_count || (cs.total_votes > 0 ? 1 : 0)}</span>
                        <span style="opacity:0.5; margin:0 4px;">|</span>
                        <span title="Total de reações">💬 ${cs.total_votes || 0}</span>
                    </div>
                    <div class="as-user-limit-info">Interações registadas: <b>${userVotes}</b></div>
                    <div class="as-cooldown-timer" style="display:none">Próximo voto em: <span class="as-timer-val">30</span>s</div>
                </div>

                <!-- TAB CONTENT: RISK -->
                <div class="as-tab-content as-tab-risk active" id="as-tab-risk">
                    <div class="as-section-title-mini" style="font-size:10px; font-weight:700; color:#9ca3af; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">⚙️ Padrões do Sistema</div>
                    <div class="as-section-content">
                        ${this.renderExplanations(explanation.explanations.filter(e => e.kind !== 'quality'), 'risk')}
                    </div>

                    <div class="as-separator" style="height:1px; background:#f3f4f6; margin:12px 0;"></div>

                    <div class="as-section-title-mini" style="font-size:10px; font-weight:700; color:#9ca3af; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">👥 Interações Registadas</div>
                    <div class="as-dynamic-buttons as-grid-buttons">
                        ${this.renderButtons(riskButtons, cs)}
                    </div>
                </div>

                <!-- TAB CONTENT: POSITIVE -->
                <div class="as-tab-content as-tab-positive" id="as-tab-positive">
                    <div class="as-section-title-mini" style="font-size:10px; font-weight:700; color:#9ca3af; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">⚙️ Padrões do Sistema</div>
                    <div class="as-section-content">
                        ${this.renderExplanations(explanation.explanations.filter(e => e.kind === 'quality'), 'positive')}
                    </div>

                    <div class="as-separator" style="height:1px; background:#f3f4f6; margin:12px 0;"></div>

                    <div class="as-section-title-mini" style="font-size:10px; font-weight:700; color:#9ca3af; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">👥 Interações Registadas</div>
                    <div class="as-dynamic-buttons as-grid-buttons">
                        ${this.renderButtons(positiveButtons, cs)}
                    </div>
                </div>
                
                <!-- FOOTER -->
                <div class="as-disclaimer" style="font-size:10px; color:#9ca3af; text-align:center; padding:8px 12px; border-top:1px solid #e5e7eb; margin-top:auto; background:#f9fafb;">
                    Esta análise identifica padrões observáveis. Não verifica identidade, legitimidade ou intenção.
                </div>
            `;

            let tooltip;

            if (isUpdate) {
                tooltip = this.activeTooltip;
                tooltip.innerHTML = html;
            } else {
                tooltip = document.createElement('div');
                tooltip.className = 'as-tooltip';
                tooltip._target = targetElement;
                tooltip.innerHTML = html; // Define conteúdo ANTES de append para ter altura

                document.body.appendChild(tooltip);
                this.activeTooltip = tooltip;

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

                // Fechar ao clicar fora
                const outsideClickHandler = (e) => {
                    if (this.activeTooltip && !this.activeTooltip.contains(e.target) && !targetElement.contains(e.target)) {
                        this.closeTooltip();
                        document.removeEventListener('click', outsideClickHandler);
                    }
                };
                
                setTimeout(() => {
                    document.addEventListener('click', outsideClickHandler);
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
        this.activeTooltip = tooltip;

        // Events
        this.attachEvents(tooltip, options, adHash);
        
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
            
            // Disable actionable buttons (not tabs)
            const disableBtns = () => tooltip.querySelectorAll('.as-btn, .as-like-btn, .as-dislike-btn').forEach(b => b.disabled = true);
            disableBtns();

            const interval = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(interval);
                    timerDisplay.style.display = 'none';
                    // Re-enable (except voted ones logic handling elsewhere, but simple re-enable is safe-ish)
                    tooltip.querySelectorAll('.as-btn, .as-like-btn, .as-dislike-btn').forEach(b => {
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
            // 1. Botões de Ação (Vote/Report) - TOGGLE SYSTEM
            const actionBtn = e.target.closest('.as-action-btn');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();

                const signal = actionBtn.dataset.signal;
                const isCurrentlyVoted = actionBtn.classList.contains('active');
                
                // Cooldown check (entre ações, não limite total)
                if (window.BotDetector && adHash) {
                    const cooldownRem = window.BotDetector.getCooldownRemaining(adHash);
                    if (cooldownRem > 0) {
                        this.showFeedback(tooltip, `Aguarda ${cooldownRem}s antes da próxima ação.`, 'warning');
                        startCooldownUI(cooldownRem);
                        return;
                    }
                    // NOTA: O registo do cooldown foi movido para baixo para evitar penalizar cliques inválidos (conflitos)
                }

                // TOGGLE LOGIC
                if (isCurrentlyVoted) {
                    // === REMOVER VOTO ===
                    // Trigger cooldown on remove? Usually yes to prevent toggle spam.
                    if (window.BotDetector) {
                        window.BotDetector.reportState.adCooldowns[adHash] = Date.now();
                        startCooldownUI(30);
                    }

                    actionBtn.classList.remove('active', 'as-voted-anim');
                    
                    // Atualizar contagem visual (percentagem vai recalcular no refresh)
                    const countSpan = actionBtn.querySelector('.as-btn-count');
                    if (countSpan) {
                        countSpan.textContent = ''; // Limpa contador visual
                        countSpan.style.display = 'none';
                    }

                    // Atualizar contador global
                    const userLimitEl = tooltip.querySelector('.as-user-limit-info b');
                    if (userLimitEl) {
                        let currentLimit = parseInt(userLimitEl.innerText || '0');
                        userLimitEl.innerText = Math.max(0, currentLimit - 1);
                    }

                    // Remover do localStorage
                    if (adHash) {
                        try {
                            const savedVotes = JSON.parse(localStorage.getItem(`as_user_votes_${adHash}`) || '{}');
                            delete savedVotes[signal];
                            localStorage.setItem(`as_user_votes_${adHash}`, JSON.stringify(savedVotes));
                        } catch (e) {
                            console.warn('[Anti-Scam] Erro ao remover voto:', e);
                        }
                    }

                    // Chamar onReport com delta negativo
                    options.onReport(signal, -1);
                    this.showFeedback(tooltip, 'Voto removido.', 'neutral');
                    
                } else {
                    // === CHECK CONFLICTS (NOVO) ===
                    if (adHash) {
                        const CONFLICTING_VOTES = {
                            'votes_new_profile': { conflict: 'votes_old_profile', label: 'Perfil antigo' },
                            'votes_old_profile': { conflict: 'votes_new_profile', label: 'Perfil recente' },
                            'votes_evasive': { conflict: 'votes_clear_answers', label: 'Respostas claras' },
                            'votes_clear_answers': { conflict: 'votes_evasive', label: 'Respostas evasivas' },
                            'votes_generic_images': { conflict: 'votes_original_photos', label: 'Fotos originais' },
                            'votes_original_photos': { conflict: 'votes_generic_images', label: 'Imagens genéricas' },
                            'votes_location_vague': { conflict: 'votes_location_confirmed', label: 'Local confirmado' },
                            'votes_location_confirmed': { conflict: 'votes_location_vague', label: 'Localização vaga' }
                        };

                        const conflictData = CONFLICTING_VOTES[signal];
                        if (conflictData) {
                            try {
                                const savedVotes = JSON.parse(localStorage.getItem(`as_user_votes_${adHash}`) || '{}');
                                if (savedVotes[conflictData.conflict]) {
                                    this.showFeedback(tooltip, `❌ Contradiz voto anterior: "${conflictData.label}"`, 'error');
                                    // Efeito visual de erro (Shake)
                                    actionBtn.animate([
                                        { transform: 'translateX(0)' },
                                        { transform: 'translateX(-5px)' },
                                        { transform: 'translateX(5px)' },
                                        { transform: 'translateX(0)' }
                                    ], { duration: 300 });
                                    // NÃO APLICA COOLDOWN AQUI
                                    return; // IMPEDE O VOTO
                                }
                            } catch (e) {
                                console.warn('[Conflict Check Error]', e);
                            }
                        }
                    }

                    // === SUCESSO: APLICA COOLDOWN AGORA ===
                     if (window.BotDetector && adHash) {
                        window.BotDetector.reportState.adCooldowns[adHash] = Date.now();
                        startCooldownUI(30);
                    }

                    // === ADICIONAR VOTO ===
                    actionBtn.classList.add('as-voted-anim', 'active');
                    
                    // Atualizar contagem visual
                    const countSpan = actionBtn.querySelector('.as-btn-count');
                    if (countSpan) {
                        countSpan.textContent = '✓';
                        countSpan.style.display = 'inline-block';
                    }

                    // Atualizar contador global
                    const userLimitEl = tooltip.querySelector('.as-user-limit-info b');
                    if (userLimitEl) {
                        let currentLimit = parseInt(userLimitEl.innerText || '0');
                        userLimitEl.innerText = currentLimit + 1;
                    }

                    // Guardar no localStorage
                    if (adHash) {
                        try {
                            const savedVotes = JSON.parse(localStorage.getItem(`as_user_votes_${adHash}`) || '{}');
                            savedVotes[signal] = true;
                            localStorage.setItem(`as_user_votes_${adHash}`, JSON.stringify(savedVotes));
                        } catch (e) {
                            console.warn('[Anti-Scam] Erro ao guardar voto:', e);
                        }
                    }

                    // Chamar onReport com delta positivo
                    options.onReport(signal, +1);
                    this.showFeedback(tooltip, 'Voto registado!', 'success');
                }
                
                return;
            }


            // 2. Botão 'Ver Mais'
            const viewMoreBtn = e.target.closest('.as-view-more-link');
            if (viewMoreBtn) {
                e.preventDefault();
                e.stopPropagation();
                const container = viewMoreBtn.parentElement;
                container.querySelectorAll('.as-btn-hidden').forEach(b => {
                    b.style.display = 'flex';
                    b.classList.remove('as-btn-hidden');
                    b.style.animation = 'fadeIn 0.3s ease';
                });
                viewMoreBtn.remove();
                return;
            }
        });

        // Eventos para Comentários
        const commentInput = tooltip.querySelector('.as-comment-input');
        const commentSubmit = tooltip.querySelector('.as-comment-submit');
        const commentsList = tooltip.querySelector('.as-comments-list');

        // Lógica de Tabs v2.0
        tooltip.querySelectorAll('.as-tab-btn').forEach(btn => {
            btn.onclick = () => {
                // Remove active de tudo
                tooltip.querySelectorAll('.as-tab-btn').forEach(b => b.classList.remove('active'));
                tooltip.querySelectorAll('.as-tab-content').forEach(c => c.classList.remove('active'));
                
                // Ativa atual
                btn.classList.add('active');
                const tabId = `as-tab-${btn.dataset.tab}`;
                const content = tooltip.querySelector(`#${tabId}`);
                if (content) content.classList.add('active');
            };
        });

        // Lógica de Likes/Dislikes
        const likeBtn = tooltip.querySelector('.as-like-btn');
        const dislikeBtn = tooltip.querySelector('.as-dislike-btn');

        if (likeBtn && dislikeBtn) {
            // Ler estado inicial do utilizador
            const storageKey = `as_vote_${adHash}`;
            const currentVote = localStorage.getItem(storageKey); // 'votes_like' | 'votes_dislike' | null

            // Atualiza UI inicial
            if (currentVote === 'votes_like') likeBtn.classList.add('as-btn-voted');
            if (currentVote === 'votes_dislike') dislikeBtn.classList.add('as-btn-voted');

            const handleVote = (type) => {
                const previousVote = localStorage.getItem(storageKey);
                
                // Cenário 1: Remover voto (toggle)
                if (previousVote === type) {
                    options.onReport(type, -1);
                    localStorage.removeItem(storageKey);
                    
                    if (type === 'votes_like') likeBtn.classList.remove('as-btn-voted', 'as-voted-anim');
                    if (type === 'votes_dislike') dislikeBtn.classList.remove('as-btn-voted', 'as-voted-anim');
                    
                    this.showFeedback(tooltip, 'Voto removido.', 'neutral');
                    return;
                }

                // Cenário 2: Mudar voto (Swap)
                if (previousVote && previousVote !== type) {
                    // Remove anterior
                    options.onReport(previousVote, -1);
                    if (previousVote === 'votes_like') likeBtn.classList.remove('as-btn-voted');
                    if (previousVote === 'votes_dislike') dislikeBtn.classList.remove('as-btn-voted');
                }

                // Cenário 3: Novo voto (ou continuação do swap)
                options.onReport(type, 1);
                localStorage.setItem(storageKey, type);

                // UI Updates
                if (type === 'votes_like') {
                    likeBtn.classList.add('as-btn-voted', 'as-voted-anim');
                    dislikeBtn.classList.remove('as-btn-voted'); // Safety
                }
                if (type === 'votes_dislike') {
                    dislikeBtn.classList.add('as-btn-voted', 'as-voted-anim');
                    likeBtn.classList.remove('as-btn-voted'); // Safety
                }
                
                this.showFeedback(tooltip, type === 'votes_like' ? 'Gostaste deste anúncio!' : 'Não gostaste deste anúncio.', 'success');
            };

            likeBtn.onclick = () => handleVote('votes_like');
            dislikeBtn.onclick = () => handleVote('votes_dislike');
        }

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
        tooltip.addEventListener('click', (e) => {
            const btn = e.target.closest('.as-view-more-link');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                
                const container = btn.parentElement;
                container.querySelectorAll('.as-btn-hidden').forEach(b => {
                    b.style.display = 'flex'; // Restaura display original
                    b.classList.remove('as-btn-hidden');
                    b.style.animation = 'fadeIn 0.3s ease';
                });
                
                btn.remove(); // Remove o botão "Ver mais"
            }
        });
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
            feedbackArea.innerHTML = '';
        }, 5000);
    },

    /**
     * Renderiza botões dinâmicos baseados na configuração.
     * @param {Array} buttonsConfig - Configuração dos botões
     * @param {Object} signals - Sinais atuais
     */
    renderButtons(buttons, cs) {
        if (!buttons || buttons.length === 0) return '<div style="grid-column:1/-1; color:#9ca3af; font-size:10px; text-align:center;">Nenhuma opção disponível.</div>';
        
        const limit = 6;
        let html = '';
        
        // Calcular total para percentagens
        const totalVotes = cs.total_votes || 0;
        
        buttons.forEach((btn, index) => {
            const count = cs[btn.signal] || 0;
            const userVoted = (cs.user_votes && cs.user_votes[btn.signal]); 
            
            // Percentagem
            const percent = (totalVotes > 0) ? Math.round((count / totalVotes) * 100) : 0;
            const badgeContent = count > 0 ? `${percent}%` : '';
            const badgeStyle = count > 0 ? '' : 'display:none';

            const activeClass = userVoted ? 'active' : '';
            const isHidden = index >= limit;
            const hiddenStyle = isHidden ? 'display:none' : '';
            const hiddenClass = isHidden ? 'as-btn-hidden' : '';

            // Tooltip mostra contagem absoluta
            const tooltipTitle = `${btn.label} (${count} votos) - Clique para reportar`;

            html += `
            <button class="as-action-btn ${btn.class} ${activeClass} ${hiddenClass}" 
                    data-signal="${btn.signal}" 
                    data-tab="${btn.tab}"
                    title="${tooltipTitle}"
                    style="${hiddenStyle}">
                <span class="as-btn-icon">${btn.icon}</span>
                <span class="as-btn-label">${btn.label}</span>
                <span class="as-btn-count" style="${badgeStyle}">${badgeContent}</span>
            </button>`;
        });

        if (buttons.length > limit) {
             html += `<button class="as-view-more-link" style="grid-column: 1 / -1; margin-top:8px; background:#f9fafb; border:1px solid #d1d5db; border-radius:4px; color:#374151; font-weight:700; font-size:11px; cursor:pointer; padding:8px; width:100%; transition:all 0.2s; text-align:center;">
                Ver mais opções (${buttons.length - limit}) ↓
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

