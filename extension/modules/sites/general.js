window.SiteConfigs = window.SiteConfigs || [];
window.SiteConfigs.push(
    {
        name: 'olx-detail',
        check: () => window.location.hostname.includes('olx.') && window.location.pathname.includes('/d/'),
        selectors: {
            container: '#root, #__next, div[class*="main"], main, body', 
            title: '[data-cy="ad_title"], [data-testid="ad_title"], h1', 
            price: '[data-testid="ad-price-container"] h3, [data-testid="ad-price-container"], [data-testid="ad-price"], h3', 
            description: 'div[data-cy="ad_description"], [data-testid="ad-description"]',
            insertTarget: '[data-testid="ad-price-container"], [data-testid="ad-price"], h1',
            insertPosition: 'afterend'
        },
        getId: (node) => window.location.href.split('?')[0], 
        isDetailPage: true,
        buttonsKey: 'olx'
    },
    {
        name: 'olx',
        check: () => window.location.hostname.includes('olx.') && !window.location.pathname.includes('/d/anuncio/'),
        selectors: {
            container: '[data-cy="l-card"], [data-testid="l-card"], [data-testid="listing-ad"], li[data-testid="listing-ad"]', 
            title: 'h6, h2, h4, a[href*="/d/"], a[href*="/ads/"], a[href*="standvirtual"], a[href*="imovirtual"]', 
            price: '[data-testid="ad-price"], .price, [class*="price"]',
            insertTarget: '[data-testid="priceBlock"]', 
            insertPosition: 'afterend'
        },
        getId: (node) => {
            const link = node.querySelector('a');
            return link ? link.href.split('.html')[0] : null;
        },
        isDetailPage: false,
        buttonsKey: 'olx'
    }
);
