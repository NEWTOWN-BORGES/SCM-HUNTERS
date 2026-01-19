window.SiteConfigs = window.SiteConfigs || [];
window.SiteConfigs.push(
    {
        name: 'standvirtual-detail',
        check: () => (window.location.hostname.includes('standvirtual.')) && 
                    (window.location.pathname.includes('/anuncio/') || document.querySelector('[data-testid="ad-price-container"], .offer-price__number')),
        selectors: {
            container: 'div#root, main, body', 
            title: 'h1, h2[class*="title"]', 
            price: '[data-testid="ad-price-container"] h3, .offer-price__number, h3[class*="price"], div[class*="Price"]', 
            description: '[data-testid="ad-description"], .offer-description__description, section[class*="description"]',
            views: 'span[data-testid="ad-views"], .offer-meta__item:contains("Visualizações")', 
            insertTarget: '[data-testid="ad-price-container"], .offer-price__number, h1',
            insertPosition: 'afterend'
        },
        getId: (node) => window.location.href.split('?')[0], 
        isDetailPage: true,
        buttonsKey: 'standvirtual'
    },
    {
        name: 'standvirtual',
        check: () => window.location.hostname.includes('standvirtual.') && !window.location.pathname.includes('/anuncio/'),
        selectors: {
            container: 'div[data-testid="listing-ad"], div[class*="offer-item"], div[data-testid="main-page-promoted-ad"], div[class*="promoted-ad"], li[data-testid*="ad-"], div.oa-item, div[class*="ooa-"][data-testid="search-results"] > div, article[class*="ooa-"], a[href*="/anuncio/"]:not([class*="reference"]), div[class*="grid-item"]', 
            title: 'h1, h2, h3, h4, a[class*="title"], span[class*="title"], a', 
            price: '[data-testid="ad-price"], [data-testid="ad-card-price"], section[aria-label="Price"], span[class*="price"], div[class*="Price"], span.oa-price, span[data-testid="price"], div[class*="offer-price"], p[class*="ooa-"][class*="15sm3kk"], p[class*="ooa-"][class*="price"], p:last-child, div[class*="price"]', 
            views: '[data-testid="ad-views"]',
            insertTarget: '[data-testid="ad-price"], [data-testid="ad-card-price"], section[aria-label="Price"], span[class*="price"], div[class*="Price"], span.oa-price, span[data-testid="price"], div[class*="offer-price"], p[class*="ooa-"][class*="15sm3kk"], p[class*="ooa-"][class*="price"], p:last-child, div[class*="price"]',
            insertPosition: 'afterend'
        },
        getId: (node) => {
             const link = node.querySelector('a');
             return link ? link.href.split('?')[0] : null;
        },
        isDetailPage: false,
        buttonsKey: 'standvirtual'
    }
);
