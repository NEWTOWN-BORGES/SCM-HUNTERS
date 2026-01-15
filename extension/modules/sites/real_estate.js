window.SiteConfigs = window.SiteConfigs || [];
window.SiteConfigs.push(
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
        check: () => window.location.hostname.includes('imovirtual.com') && window.location.href.includes('/anuncio/'),
        selectors: {
            container: 'body', 
            title: 'h1, [data-cy="adPageAdTitle"]',
            price: '[data-cy="adPageAdPrice"], [data-cy="adPageHeaderPrice"], strong[aria-label="Preço"], .css-1wws9er, .css-u0t81v, .elm6lnc1, strong', 
            description: '[data-cy="adPageAdDescription"], section[id="description"]',
            insertTarget: 'a[href="#map"], a[class*="e1aypsbg1"]',
            insertPosition: 'afterend' 
        },
        getId: (node) => window.location.href,
        isDetailPage: true,
        buttonsKey: 'default'
    },
    {
        name: 'imovirtual',
        check: () => {
            return window.location.hostname.includes('imovirtual.com') && 
                   !window.location.href.includes('/anuncio/') && 
                   (window.location.pathname.includes('/arrendar/') || 
                    window.location.pathname.includes('/venda/') ||
                    window.location.pathname.includes('/comprar/') ||
                    window.location.pathname.includes('/resultados/'));
        },
        selectors: {
            container: 'article[data-sentry-component="AdvertCard"], article[class*="e1wy4jvd0"], div[data-cy="l-card"]', 
            title: '[data-cy="listing-item-title"], h3[class*="title"], span[data-cy="listing-item-title"]',
            price: '[data-cy="listing-item-price"], span[class*="price"], .css-1wws9er',
            description: '[data-cy="listing-description"]',
            insertTarget: '.css-u0t81v, [data-cy="listing-item-price"]',
            insertPosition: 'afterend'
        },
        getId: (node) => {
            const link = node.querySelector('a[href*="/anuncio/"]');
            return link ? link.href : (node.href && node.href.includes('/anuncio/') ? node.href : null);
        },
        isDetailPage: false,
        buttonsKey: 'default'
    },
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
        buttonsKey: 'default'
    },
    {
        name: 'teemo-property',
        check: () => window.location.hostname.includes('teemo.pt') || window.location.hostname.includes('teemo.com'), 
        selectors: {
            container: '.property-card, .listing-item', 
            title: '.property-title, h2',
            price: '.property-price, .price',
            insertTarget: '.property-price, .price',
            insertPosition: 'afterend'
        },
        getId: (node) => node.dataset.id || (node.querySelector('a') ? node.querySelector('a').href : null),
        isDetailPage: false,
        buttonsKey: 'teemo'
    }
);
