window.SiteConfigs = window.SiteConfigs || [];
window.SiteConfigs.push(
    {
        name: 'temu-detail',
        check: () => window.location.hostname.includes('temu.') && (window.location.href.includes('goods_id') || /g-\d+/.test(window.location.href) || document.querySelector('[id="goods_price"]')),
        selectors: {
            container: 'body',
            title: 'h1, div[class*="good-name"], [class*="goods-title"]', 
            price: '[id="goods_price"], div[class*="price-banner"] span', 
            insertTarget: '[id="goods_price"]', 
            insertPosition: 'append'
        },
        getId: (node) => window.location.href.split('?')[0],
        isDetailPage: true,
        buttonsKey: 'chinashops'
    },
    {
        name: 'shein-detail',
        check: () => window.location.hostname.includes('shein.') && (window.location.href.includes('/p-') || document.querySelector('.productPriceContainer')),
        selectors: {
            container: 'body',
            title: 'h1, .product-intro__head-name', 
            price: '.bsc-price-elem, .productPriceContainer, div[class*="price"]', 
            insertTarget: '.bsc-price-elem', 
            insertPosition: 'afterend' 
        },
        getId: (node) => window.location.href.split('?')[0],
        isDetailPage: true,
        buttonsKey: 'chinashops'
    },
    {
        name: 'aliexpress-detail',
        check: () => window.location.hostname.includes('aliexpress.') && window.location.pathname.includes('/item/'),
        selectors: {
            container: 'body',
            title: 'h1, .product-title-text, [class*="title-text"], [class*="pdp-info"]', 
            price: '[class*="price-default--priceWrap"], [class*="price-default--bannerWrap"], .product-price-value, [class*="price-current"]', 
            insertTarget: '[class*="price-default--priceWrap"], [class*="price-default--bannerWrap"], .product-price-value',
            insertPosition: 'afterend'
        },
        getId: (node) => window.location.href.split('?')[0],
        isDetailPage: true,
        buttonsKey: 'chinashops'
    },
    {
        name: 'aliexpress',
        check: () => window.location.hostname.includes('aliexpress.') && !window.location.pathname.includes('/item/'),
        selectors: {
            container: 'div[class*="mf_cz"], div[class*="18_ib"], div[class*="search-item-card"], div[class*="product-card"], a[class*="search--itemCard"]', 
            title: '[class*="mf_p"], [class*="mf_mk"], h3, h1, a[title], div[class*="title"]', 
            price: '[class*="mf_mk"], div[class*="price"], span[class*="price"], [class*="price-current"]', 
            insertTarget: '[class*="mf_mk"], div[class*="price"], span[class*="price"]',
            insertPosition: 'afterend'
        },
        getId: (node) => {
            const link = node.querySelector('a');
            return link ? link.href.split('?')[0] : null;
        },
        isDetailPage: false,
        buttonsKey: 'chinashops'
    },
    {
        name: 'temu',
        check: () => window.location.hostname.includes('temu.'),
        selectors: {
            container: 'div[class*="goods-item"], div[class*="good-item"], div[class*="product-card"], div[data-id], div[data-goods-id], div[data-tooltip-title]', 
            title: 'h3, a[title], div[class*="title"], [class*="goods-title"], [class*="good-title"], [data-tooltip-title]', 
            price: 'div[class*="price"], span[class*="price"], [class*="sale-price"], [class*="current-price"]', 
            insertTarget: 'div[class*="price"], span[class*="price"], [class*="sale-price"], [class*="current-price"]',
            insertPosition: 'afterend'
        },
        getId: (node) => {
            const link = node.querySelector('a');
            if (link && link.href) return link.href.split('?')[0];
            return node.getAttribute('data-goods-id') || node.getAttribute('data-id');
        },
        isDetailPage: false,
        buttonsKey: 'chinashops'
    },
    {
        name: 'shein',
        check: () => window.location.hostname.includes('shein.'),
        selectors: {
            container: 'section[class*="product-list"] > div, div.S-product-item, div[class*="product-card"], article, div.product-list__item', 
            title: 'a[class*="title"], div[class*="goods-title"], div[class*="product-loc"], [class*="product-title"]', 
            price: 'div[class*="price"], span[class*="price"], p[class*="price"], [class*="product-price"]', 
            insertTarget: 'div[class*="price"], span[class*="price"], p[class*="price"], [class*="product-price"]',
            insertPosition: 'afterend'
        },
        getId: (node) => {
            const link = node.querySelector('a');
            return link ? link.href.split('?')[0] : null;
        },
        isDetailPage: false,
        buttonsKey: 'chinashops'
    }
);
