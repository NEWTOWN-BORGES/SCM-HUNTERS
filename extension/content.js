/**
 * Anti-Scam Content Script
 * Orquestra a leitura da página e injeção de UI.
 * ATUALIZADO: Integra tracking comportamental e análise de anúncios.
 */

const App = {
    // Configurações de Botões (Templates)
    buttonTemplates: {
        default: [
            // TAB: RISCO (Negativos)
            { tab: 'risk', signal: 'votes_advance_payment', label: 'Pagamento antecipado', icon: '💸', class: 'as-btn-risk' },
            { tab: 'risk', signal: 'votes_off_platform', label: 'Sair da plataforma', icon: '📞', class: 'as-btn-risk' },
            { tab: 'risk', signal: 'votes_evasive', label: 'Respostas evasivas', icon: '⏳', class: 'as-btn-warning' },
            { tab: 'risk', signal: 'votes_inconsistent', label: 'Info inconsistente', icon: '🧾', class: 'as-btn-warning' },
            { tab: 'risk', signal: 'votes_location_vague', label: 'Localização vaga', icon: '📍', class: 'as-btn-warning' },
            { tab: 'risk', signal: 'votes_generic_images', label: 'Imagens genéricas', icon: '🖼️', class: 'as-btn-warning' },
            { tab: 'risk', signal: 'votes_repost', label: 'Anúncio repetido', icon: '🔁', class: 'as-btn-warning' },
            { tab: 'risk', signal: 'votes_new_profile', label: 'Perfil recente', icon: '🌱', class: 'as-btn-warning' },
            { tab: 'risk', signal: 'votes_unrealistic_price', label: 'Preço fora do padrão observado', icon: '🤷', class: 'as-btn-risk' },
            { tab: 'risk', signal: 'votes_vague_desc', label: 'Descrição com pouca informação', icon: '📄', class: 'as-btn-neutral' },
            { tab: 'risk', signal: 'votes_pressure', label: 'Pressão decisão', icon: '⏱️', class: 'as-btn-risk' },
            { tab: 'risk', signal: 'votes_conditions_changed', label: 'Mudou condições', icon: '❓', class: 'as-btn-warning' },
            { tab: 'risk', signal: 'votes_missing_details', label: 'Falta detalhes', icon: '🧩', class: 'as-btn-neutral' },
            { tab: 'risk', signal: 'votes_fake_item', label: 'Padrão suspeito recorrente', icon: '🚫', class: 'as-btn-risk' },

            // TAB: POSITIVOS
            { tab: 'positive', signal: 'votes_visit_available', label: 'Visita presencial disponível', icon: '🏠', class: 'as-btn-positive' },
            { tab: 'positive', signal: 'votes_docs_shown', label: 'Documentação apresentada', icon: '📄', class: 'as-btn-positive' },
            { tab: 'positive', signal: 'votes_location_confirmed', label: 'Local confirmado', icon: '📍', class: 'as-btn-positive' },
            { tab: 'positive', signal: 'votes_original_photos', label: 'Fotos originais', icon: '🖼️', class: 'as-btn-positive' },
            { tab: 'positive', signal: 'votes_old_profile', label: 'Perfil antigo', icon: '🏅', class: 'as-btn-positive' },
            { tab: 'positive', signal: 'votes_clear_answers', label: 'Respostas claras', icon: '📩', class: 'as-btn-positive' },
            { tab: 'positive', signal: 'votes_normal_interaction', label: 'Interação normal', icon: '🤝', class: 'as-btn-positive' }
        ],
        olx: [
             // OLX: Foco em fraudes de pagamento e envio
             { tab: 'risk', signal: 'votes_advance_payment', label: 'Pede MBWay/Sinal', icon: '💸', class: 'as-btn-risk' },
             { tab: 'risk', signal: 'votes_off_platform', label: 'Pede WhatsApp', icon: '📞', class: 'as-btn-risk' },
             { tab: 'risk', signal: 'votes_fake_item', label: 'Preço Muito Baixo', icon: '🚫', class: 'as-btn-risk' },
             { tab: 'risk', signal: 'votes_evasive', label: 'Esquiva-se', icon: '⏳', class: 'as-btn-warning' },
             { tab: 'risk', signal: 'votes_new_profile', label: 'Conta Recente', icon: '🌱', class: 'as-btn-warning' },
             
             // OLX: Menos positivos (geralmente troca rápida)
             { tab: 'positive', signal: 'votes_visit_available', label: 'Entrega em Mão', icon: '🤝', class: 'as-btn-positive' },
             { tab: 'positive', signal: 'votes_clear_answers', label: 'Responde Rápido', icon: '📩', class: 'as-btn-positive' }
        ],
        teemo: [
             // Teemo: Similar ao Default
             { tab: 'risk', signal: 'votes_fake_item', label: 'Propriedade Falsa', icon: '🚫', class: 'as-btn-risk' },
             { tab: 'risk', signal: 'votes_advance_payment', label: 'Sinal sem Visita', icon: '💸', class: 'as-btn-risk' },
             { tab: 'risk', signal: 'votes_unrealistic_price', label: 'Renda Irreal', icon: '🤷', class: 'as-btn-warning' },
             
             { tab: 'positive', signal: 'votes_visit_available', label: 'Aceita Visita', icon: '🏠', class: 'as-btn-positive' },
             { tab: 'positive', signal: 'votes_docs_shown', label: 'Senhorio Verificado', icon: '📄', class: 'as-btn-positive' }
        ]
    },

    // Configurações de seletores por domínio
    siteConfigs: [
        {
            name: 'demo-site',
            check: () => document.title.includes('Demo Imóveis'),
            selectors: {
                container: 'article.item', 
                title: 'a.item-link, .item-info-container a',
                price: '.item-price, span.item-price',
                description: '.item-description',
                views: '.stat-views', 
                saves: '.stat-saves', 
                insertTarget: '.item-price, .price-row',
                insertPosition: 'afterend'
            },
            getId: (node) => {
                const link = node.querySelector('a.item-link') || node.querySelector('a');
                if (link && link.href) {
                    const match = link.href.match(/\/imovel\/(\d+)\//);
                    return match ? match[1] : null;
                }
                return node.dataset.adid || null;
            },
            isDetailPage: false,
            // Usa getter para aceder ao template (this.buttonTemplates não estaria acessível fácil aqui sem bind, 
            // então vamos definir 'buttons' string e resolver depois ou hardcode references)
            buttonsKey: 'default'
        },
        {
            name: 'idealista-detail',
            check: () => window.location.hostname.includes('idealista.pt') && window.location.pathname.includes('/imovel/'),
            selectors: {
                container: 'main', 
                title: 'h1, span.main-info__title-main',
                price: 'span.info-data-price, span.txt-bold',
                description: '.comment, .adCommentsLanguage',
                insertTarget: 'span.info-data-price, h1',
                insertPosition: 'afterend'
            },
            getId: (node) => {
                const match = window.location.pathname.match(/\/imovel\/(\d+)\//);
                return match ? match[1] : null;
            },
            isDetailPage: true,
            buttonsKey: 'default'
        },
        {
            name: 'idealista',
            check: () => window.location.hostname.includes('idealista.pt'),
            selectors: {
                container: 'article.item', 
                title: 'a.item-link',
                price: '.item-price',
                description: '.item-description',
                insertTarget: '.item-price',
                insertPosition: 'afterend'
            },
            getId: (node) => {
                const link = node.querySelector('a.item-link');
                if (link && link.href) {
                    const match = link.href.match(/\/imovel\/(\d+)\//);
                    return match ? match[1] : null;
                }
                return node.dataset.adid || null;
            },
            isDetailPage: false,
            buttonsKey: 'default'
        },
        {
            name: 'imovirtual-detail',
            check: () => window.location.hostname.includes('imovirtual.com') && (window.location.href.includes('/anuncio/') || document.querySelector('h1')),
            selectors: {
                container: 'body', // Fallback container
                title: 'h1, [data-cy="adPageAdTitle"]',
                price: '[data-cy="adPageAdPrice"], [data-cy="adPageHeaderPrice"], strong[aria-label="Preço"], .css-1wws9er', 
                description: '[data-cy="adPageAdDescription"], section[id="description"]',
                insertTarget: '[data-cy="adPageAdPrice"], [data-cy="adPageHeaderPrice"], strong[aria-label="Preço"], h1',
                insertPosition: 'appendChild'
            },
            getId: (node) => window.location.href,
            isDetailPage: true,
            buttonsKey: 'default'
        },
        {
            name: 'imovirtual',
            check: () => window.location.hostname.includes('imovirtual.com'),
            selectors: {
                // Tenta apanhar containers principais. Removemos classes específicas do link para evitar "vision tunnel"
                container: 'article, li, div[data-cy="l-card"]', 
                title: '[data-cy="listing-item-title"], h3, h6, .offer-item-title, .css-135367, p',
                // Adicionado 'p' e 'div' e classes parciais
                price: '[data-cy="listing-item-price"], li.offer-item-price, .offer-item-price, span[aria-label="Preço"], .css-1wws9er, [class*="price"], p',
                description: '[data-cy="listing-description"]',
                insertTarget: '[data-cy="listing-item-price"], .offer-item-price, [data-cy="listing-item-title"], p',
                insertPosition: 'appendChild' 
            },
            getId: (node) => {
                const link = node.querySelector('a[href*="/anuncio/"]');
                return link ? link.href : (node.href && node.href.includes('/anuncio/') ? node.href : null);
            },
            isDetailPage: false,
            buttonsKey: 'default'
        },
        {
            name: 'olx',
            check: () => window.location.hostname.includes('olx.pt'),
            selectors: {
                container: 'a[href*="/d/anuncio/"]', 
                title: 'h6', 
                price: 'p[data-testid="ad-price"]',
                insertTarget: 'h6',
                insertPosition: 'afterend'
            },
            getId: (node) => node.href || null,
            isDetailPage: false,
            buttonsKey: 'olx'
        },
        {
            name: 'teemo',
            check: () => window.location.hostname.includes('teemo.pt') || window.location.hostname.includes('teemo.com'), // Exemplo
            selectors: {
                container: '.property-card, .listing-item', // Seletores genéricos/exemplo
                title: '.property-title, h2',
                price: '.property-price, .price',
                insertTarget: '.property-price, .price',
                insertPosition: 'afterend'
            },
            getId: (node) => node.dataset.id || (node.querySelector('a') ? node.querySelector('a').href : null),
            isDetailPage: false,
            buttonsKey: 'teemo'
        }
    ],

    currentConfig: null,

    init() {
        // Detecta qual site estamos
        this.currentConfig = this.siteConfigs.find(config => config.check());

        if (this.currentConfig) {
            console.log(`[Anti-Scam] Site detectado: ${this.currentConfig.name}`);
            
            // Resolve buttons config
            this.currentConfig.buttons = this.buttonTemplates[this.currentConfig.buttonsKey || 'default'];

            // Inicia módulos
            if (window.BotDetector) window.BotDetector.init();
            
            // Inicia scanner e observa mudanças no DOM
            this.runScanner();
            this.observeDOM();

            // Se estamos numa página de detalhe, inicia tracking comportamental
            if (this.currentConfig.isDetailPage) {
                this.initBehaviorTracking();
            }
        }
    },

    initBehaviorTracking() {
        if (!window.BehaviorTracker) return;

        // Inicia tracker
        window.BehaviorTracker.init();

        // Envia sinais periodicamente para o storage
        setInterval(async () => {
            const signals = window.BehaviorTracker.getSignals();
            if (!signals) return;

            // Precisamos do ID do anúncio. Como estamos no detalhe, pegamos do config
            // Nota: getId espera um nodo, mas na pagina de detalhe o container é 'main' ou document body
            const container = document.querySelector(this.currentConfig.selectors.container);
            if (!container) return;

            // Estratégia simples para ID na pagina de detalhe
            let uniqueId = this.currentConfig.getId(container);
            if (!uniqueId) return; // Se não conseguir ID, não salva

            let adData = await StorageModule.getAdData(uniqueId);
            if (adData) {
                adData.behavior_signals = signals;
                await StorageModule.updateAdData(uniqueId, adData);
            }
        }, 5000); // Atualiza a cada 5s
    },

    runScanner() {
        if (!this.currentConfig) return;
        const selector = this.currentConfig.selectors.container;
        const nodes = document.querySelectorAll(selector);
        
        nodes.forEach(node => {
            this.processAd(node, this.currentConfig);
        });
    },

    observeDOM() {
        // Debounce scanner to avoid performance hits
        let timeout;
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            
            for (const mutation of mutations) {
                // Ignore internal changes
                if (mutation.target.closest && (
                    mutation.target.closest('.as-badge-container') || 
                    mutation.target.closest('.as-tooltip')
                )) continue;

                if (mutation.addedNodes.length > 0) {
                    shouldScan = true;
                    break;
                }
            }

            if (shouldScan) {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.runScanner(), 500); // 500ms debounce
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    async processAd(node, siteConfig) {
        if (node.dataset.asProcessed) return;
        
        const selectors = siteConfig.selectors;
        const titleEl = node.querySelector(selectors.title);
        let priceEl = node.querySelector(selectors.price);
        
        // HEURÍSTICA DE PREÇO (Fallback)
        if (!priceEl) {
             // Procura qualquer elemento filho que tenha €
             const candidates = node.querySelectorAll('*');
             for (const el of candidates) {
                 if (el.innerText && (el.innerText.includes('€') || el.innerText.includes('EUR')) && el.innerText.length < 20) {
                     priceEl = el;
                     break;
                 }
             }
        }

        if (!titleEl || !priceEl) {
            if (siteConfig.name.includes('imovirtual')) {
                 // Marca como falha para não tentar sempre processar o mesmo
                 node.dataset.asProcessed = "failed"; 
                 console.warn('[Anti-Scam] Falha ao encontrar Title ou Price no container', node);
            }
            return;
        }
        
        node.dataset.asProcessed = "true";

        const title = titleEl.innerText.trim();
        const price = priceEl.innerText.trim();
        
        // Extrai descrição se disponível
        const descEl = selectors.description ? node.querySelector(selectors.description) : null;
        const description = descEl ? descEl.innerText.trim() : '';

        // Extrai métricas nativas (Views/Saves)
        let nativeViews = 0;
        let nativeSaves = 0;

        // Só tenta extrair se configurado (evita erros em outros sites)
        if (selectors.views) {
            const viewsEl = node.querySelector(selectors.views);
            if (viewsEl) nativeViews = parseInt(viewsEl.innerText.replace(/\D/g, '')) || 0;
        }
        if (selectors.saves) {
            const savesEl = node.querySelector(selectors.saves);
            if (savesEl) nativeSaves = parseInt(savesEl.innerText.replace(/\D/g, '')) || 0;
        }

        // Estratégia de ID
        let uniqueId = siteConfig.getId(node);
        if (!uniqueId) {
            uniqueId = await StorageModule.generateHash(title + price);
        } else {
            uniqueId = uniqueId.toString();
        }

        // Recupera dados
        let adData = await StorageModule.getAdData(uniqueId);

        if (!adData) {
            adData = StorageModule.createDefaultEntry();
            
            // Regra Demo (manter compatibilidade)
            if (siteConfig.name === 'demo-site' && price.includes('45.000')) {
                adData.score = 20;
            }
        }
        
        // Atualiza Sinais Nativos
        if (!adData.native_signals) adData.native_signals = { views: 0, saves: 0 };
        adData.native_signals.views = nativeViews;
        adData.native_signals.saves = nativeSaves;

        // Análise estrutural do anúncio (se AdAnalyzer disponível)
        if (window.AdAnalyzer) {
            const adAnalysis = window.AdAnalyzer.analyze({
                title,
                description,
                price,
                photoCount: node.querySelectorAll('img').length
            });

            // Atualiza sinais de anúncio
            adData.ad_signals = {
                text_length: description.length,
                photo_count: adAnalysis.signals.photoCount,
                price_is_round: adAnalysis.signals.priceIsRound,
                text_quality: adAnalysis.signals.textQuality,
                suspicious_keywords: adAnalysis.signals.suspiciousKeywords,
                score_adjustment: adAnalysis.scoreAdjustment
            };
        }

        // Simula sync com servidor (Crowd Data)
        adData = StorageModule.syncWithServer(adData);

        // Guarda dados atualizados
        adData = await StorageModule.updateAdData(uniqueId, adData);

        // Renderiza UI
        this.injectUI(node, selectors, adData, uniqueId);
    },

    injectUI(containerNode, selectors, data, hash) {
        const targetEl = containerNode.querySelector(selectors.insertTarget) || containerNode.querySelector(selectors.title);
        if (!targetEl) return;

        // Remove badge existente se houver (para update)
        const existingContainer = containerNode.querySelector('.as-badge-container');
        if (existingContainer) existingContainer.remove();

        const badgeContainer = UIModule.createBadge(data, (e) => {
            const tooltipOptions = {
                buttons: this.currentConfig.buttons || [],
                onReport: async (signalType, delta = 1) => {
                    const weight = window.BotDetector ? window.BotDetector.getWeightMultiplier() : 1.0;
                    
                    // Atualiza sinais da comunidade (localmente, simulação de envio)
                    if (!data.community_signals) data.community_signals = {};
                    if (!data.community_signals[signalType]) data.community_signals[signalType] = 0;
                    
                    data.community_signals[signalType] += delta; 
                    // Garante que não fica negativo
                    if (data.community_signals[signalType] < 0) data.community_signals[signalType] = 0;

                    // Atualiza total
                    data.community_signals.total_votes = (data.community_signals.total_votes || 0) + delta;
                    if (data.community_signals.total_votes < 0) data.community_signals.total_votes = 0;

                    // Atualiza contagem de participantes únicos (Heurística: 1º voto registado do user)
                    const userVotes = window.BotDetector ? window.BotDetector.getUserVoteCount(hash) : 0;
                    // Se userVotes == 1, significa que é o primeiro report deste user neste anúncio
                    if (userVotes === 1 && delta > 0) {
                         data.community_signals.users_count = (data.community_signals.users_count || 0) + 1;
                    }

                    // ATUALIZAÇÃO: Regista interação no BotDetector para incrementar contador do utilizador e verificar limites
                    if (delta > 0 && window.BotDetector) {
                        window.BotDetector.registerReport(hash);
                    }
                    


                    const newData = await StorageModule.updateAdData(hash, data);
                    
                    // UPDATE TOOLTIP (Não fecha)
                    UIModule.showTooltip(newData, null, tooltipOptions, hash, true);
                    
                    // Atualiza Badge (re-inject)
                    this.injectUI(containerNode, selectors, newData, hash); 
                }
            };

            // Passa o hash para UI verificar cooldowns
            UIModule.showTooltip(data, badgeContainer, tooltipOptions, hash);
        });

        // Posicionamento
        if (selectors.insertPosition === 'afterend') {
            targetEl.parentNode.insertBefore(badgeContainer, targetEl.nextSibling);
        } else {
            targetEl.appendChild(badgeContainer);
        }
        
        // Visual para scores de RISCO baixos
        if (data.risk_score < 30) {
            containerNode.style.border = '2px solid #e74c3c';
            containerNode.style.borderRadius = '4px';
        } else if (data.risk_score < 50) {
            containerNode.style.border = '1px solid #f1c40f';
            containerNode.style.borderRadius = '4px';
        }
    }
};

// === LISTENERS GLOBAIS ===

// Escuta por mensagens do Popup (Reset)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'RESET_DATA') {
        console.log('[Anti-Scam] Resetting local data...');
        // Limpa chaves do LocalStorage (Votos do utilizador)
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('as_')) {
                localStorage.removeItem(key);
            }
        });
        
        // Opcional: Limpa dados do BotDetector se expostos
        if (window.BotDetector) {
            window.BotDetector.metrics = { lastClickTime: 0, clickCount: 0, scrollEvents: 0, mouseDistance: 0, lastMousePos: {x:0, y:0}, sessionStart: Date.now() };
        }

        alert('Anti-Scam: Memória limpa com sucesso.\nA página será recarregada.');
        window.location.reload();
    }
});

// Inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

    // Expose for debugging
    window.AntiScamApp = App;
