/**
 * Anti-Scam Content Script
 * Orquestra a leitura da página e injeção de UI.
 */

const App = {
    // Configurações de seletores por domínio
    siteConfigs: [
        {
            name: 'demo-site',
            check: () => document.title.includes('Demo Imóveis'),
            selectors: {
                container: '.ad-card',
                title: '.ad-title',
                price: '.ad-price',
                // insertTarget: Onde o badge será inserido. Se null, append no title
                insertTarget: '.ad-title', 
                insertPosition: 'afterend' 
            },
            getId: (node) => node.dataset.id || null // Extract logic
        },
        {
            name: 'idealista-detail',
            // Detecta se é pagina de detalhe pela URL
            check: () => window.location.hostname.includes('idealista.pt') && window.location.pathname.includes('/imovel/'),
            selectors: {
                // Container único para evitar duplicados
                container: 'main', 
                title: 'h1, span.main-info__title-main',
                price: 'span.info-data-price, span.txt-bold', // txt-bold as fallback
                insertTarget: 'span.info-data-price, h1', // Se não achar preço, põe no titulo
                insertPosition: 'afterend'
            },
            getId: (node) => {
                // Extrai ID da própria URL (ex: /imovel/12345/)
                const match = window.location.pathname.match(/\/imovel\/(\d+)\//);
                return match ? match[1] : null;
            }
        },
        {
            name: 'idealista',
            check: () => window.location.hostname.includes('idealista.pt'),
            selectors: {
                container: 'article.item', 
                title: 'a.item-link',
                price: '.item-price',
                insertTarget: '.item-price', // No idealista, ao lado do preço fica bom
                insertPosition: 'afterend'
            },
            getId: (node) => {
                // Extrai ID do link do anúncio (ex: /imovel/12345/)
                const link = node.querySelector('a.item-link');
                if (link && link.href) {
                    const match = link.href.match(/\/imovel\/(\d+)\//);
                    return match ? match[1] : null;
                }
                return node.dataset.adid || null; // Fallback
            }
        },
        {
            name: 'imovirtual',
            check: () => window.location.hostname.includes('imovirtual.com'),
            selectors: {
                // Imovirtual usa <article> para itens de lista. 
                // data-cy pode variar, então usamos article genérico como container base.
                container: 'article', 
                // Tenta seletor específico, senão vai pelo H3 (título comum)
                title: 'span[data-cy="listing-item-title"], h3',
                // Tenta seletor específico ou classe de preço comum
                price: 'span[data-cy="listing-item-price"], li.offer-item-price',
                insertTarget: 'span[data-cy="listing-item-price"], li.offer-item-price',
                insertPosition: 'afterend'
            },
            getId: (node) => {
                const link = node.querySelector('a[href*="/anuncio/"]');
                return link ? link.href : null;
            }
        },
        {
            name: 'olx',
            check: () => window.location.hostname.includes('olx.pt'),
            selectors: {
                // Estratégia mais robusta: Encontrar links de anúncios e subir para o container
                // A maioria dos cards tem um link para /d/anuncio/
                container: 'a[href*="/d/anuncio/"]', 
                title: 'h6', 
                price: 'p[data-testid="ad-price"]',
                insertTarget: 'h6', // Tenta inserir titulo
                insertPosition: 'afterend'
            },
            getId: (node) => node.href || null // O próprio node é o link nesta estratégia
        }
    ],

    currentConfig: null,

    init() {
        // Detecta qual site estamos
        this.currentConfig = this.siteConfigs.find(config => config.check());

        if (this.currentConfig) {
            console.log(`[Anti-Scam] Site detectado: ${this.currentConfig.name}`);
            if (window.BotDetector) window.BotDetector.init(); // Inicia monitoramento de bot
            
            // Inicia scanner e observa mudanças no DOM (SPA support basic)
            this.runScanner();
            this.observeDOM();
        } else {
            console.log("[Anti-Scam] Site não suportado ou inativo.");
        }
    },

    observeDOM() {
        // Observer para carregar anúncios em scroll infinito ou navegação SPA
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) shouldScan = true;
            }
            if (shouldScan) this.runScanner();
        });

        observer.observe(document.body, { childList: true, subtree: true });
    },

    async runScanner() {
        if (!this.currentConfig) return;
        const config = this.currentConfig.selectors;

        const ads = document.querySelectorAll(config.container);
        // console.log(`[Anti-Scam] Scan: ${ads.length} anúncios encontrados.`);

        for (const adNode of ads) {
            await this.processAd(adNode, this.currentConfig);
        }
    },

    async processAd(node, siteConfig) {
        if (node.dataset.asProcessed) return;
        
        // Extrai elementos
        const selectors = siteConfig.selectors;
        const titleEl = node.querySelector(selectors.title);
        const priceEl = node.querySelector(selectors.price);
        
        if (!titleEl || !priceEl) return;
        
        // Marca como processado
        node.dataset.asProcessed = "true";

        const title = titleEl.innerText.trim();
        const price = priceEl.innerText.trim();
        
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
            // Regra Demo
            if (siteConfig.name === 'demo-site' && price.includes('45.000')) {
                adData.score = 20;
                adData.status = 'suspicious';
            }
            await StorageModule.updateAdData(uniqueId, adData);
        }

        // Renderiza UI
        this.injectUI(node, selectors, adData, uniqueId);
    },

    injectUI(containerNode, selectors, data, hash) {
        // Local de inserção
        const targetEl = containerNode.querySelector(selectors.insertTarget) || containerNode.querySelector(selectors.title);
        if (!targetEl) return;

        const badge = UIModule.createBadge(data.score, (e) => {
            UIModule.showTooltip(data, badge, {
                onReport: async (signalType) => {
                    const weight = window.BotDetector ? window.BotDetector.getWeightMultiplier() : 1.0;
                    
                    // Incrementa o sinal específico
                    if (!data.user_signals[signalType]) data.user_signals[signalType] = 0;
                    data.user_signals[signalType] += (1 * weight);
                    
                    const newData = await StorageModule.updateAdData(hash, data);
                    
                    UIModule.closeTooltip();
                    badge.remove();
                    this.injectUI(containerNode, selectors, newData, hash); 
                },
                onReset: () => {}
            });
        });

        // Posicionamento
        if (selectors.insertPosition === 'afterend') {
            targetEl.parentNode.insertBefore(badge, targetEl.nextSibling);
        } else {
            targetEl.appendChild(badge);
        }
        
        // Visual
        if (data.score < 30) {
            containerNode.style.border = '2px solid #e74c3c';
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
