/**
 * Ad Analyzer Module
 * Analisa sinais estruturais do próprio anúncio para detetar fraudes.
 * Funciona localmente sem depender de APIs externas.
 */

window.AdAnalyzer = {
    // Configuração de thresholds e pesos
    CONFIG: {
        MIN_TEXT_LENGTH: 100,           // Textos muito curtos são suspeitos
        MIN_PHOTOS: 3,                  // Menos de 3 fotos é suspeito
        ROUND_PRICE_PENALTY: true,      // Preços redondos são mais comuns em fraudes
        SIMILARITY_THRESHOLD: 0.7       // Limite para considerar textos similares
    },

    // Keywords de ALTO RISCO (Penalização severa imediata)
    // Estas expressões são quase exclusivas de burlas de arrendamento
    HIGH_RISK_KEYWORDS: [
        // Chave e Distância (O clássico "envio a chave")
        'chave pelo correio', 'envio da chave', 'envio a chave', 
        'chaves pelo correio', 'entregar a chave via', 'custos de envio',
        
        // Senhorio Ausente (Desculpa para não visitar)
        'não estou em portugal', 'estou no estrangeiro', 'trabalho fora do país',
        'encontro no estrangeiro', 'voltei para o meu país', 
        'não posso mostrar', 'visita não é possível', 
        'visita apenas após', 'visita só depois',
        
        // Plataformas usadas como "Garantia" falsa
        'pagamento via airbnb', 'reserva pelo airbnb',
        'transação pelo tripadvisor', 'proteção do tripadvisor',
        'booking.com para gerir', 'garantia bancária',
        
        // Pressão / Esquemas
        'apenas para quem pagar', 'primeiro a reservar',
        'western union', 'moneygram' 
    ],

    // Keywords suspeitas (Red flags que somam pontos mas podem ser legítimas sozinhas)
    SUSPICIOUS_KEYWORDS: [
        // Urgência
        'urgente', 'urgentíssimo', 'só hoje', 'última oportunidade',
        'aproveite já', 'não perca', 'oportunidade única',
        
        // Pagamento / Condições
        'transferência', 'pagamento adiantado',  'pagamento em bitcoin',
        'depósito prévio', 'sinal de reserva', 'caução por transferência',
        
        // Contacto / Comunicação
        'contactar fora', 'apenas por mensagem', 'não atendo chamadas',
        'contactar apenas por email', 'responderei por email',
        
        // Genéricos
        'sem visita', 'chave na mão', 'dono direto', 'particular',
        'abaixo do mercado', 'só aceito entrada imediata'
        // Falsos positivos removidos: mbway, whatsapp, preço negociável, tudo incluído
    ],

    // Keywords positivas (indicam legitimidade)
    POSITIVE_KEYWORDS: [
        'certificado energético', 'escritura', 'registo predial',
        'condomínio', 'garagem', 'arrecadação', 'varanda',
        'remodelado', 'construção', 'área bruta', 'área útil',
        'agência', 'remax', 'era', 'century21', 'comprovativo',
        'licença ami', 'ami', 'recibos', 'passo recibo', 
        'com contrato', 'contrato registado', 'fiador', 
        'senhorio no local', 'visita presencial', 'videochamada'
    ],

    /**
     * Analisa um anúncio e retorna sinais estruturais.
     * @param {Object} adData - Dados extraídos do anúncio
     * @returns {Object} Análise com sinais e score adjustment
     */
    analyze(adData) {
        const signals = {
            textLength: 0,
            photoCount: 0,
            priceIsRound: false,
            highRiskKeywords: [], // NOVO
            suspiciousKeywords: [],
            positiveKeywords: [],
            hasInconsistencies: false,
            textQuality: 'unknown'
        };

        // 1. Analisar comprimento do texto
        if (adData.description) {
            signals.textLength = adData.description.length;
            signals.textQuality = this.assessTextQuality(adData.description);
        }

        // 2. Contar fotos
        if (adData.photoCount !== undefined) {
            signals.photoCount = adData.photoCount;
        }

        // 3. Verificar se preço é redondo
        if (adData.price) {
            signals.priceIsRound = this.isPriceRound(adData.price);
        }

        // 4. Detetar keywords
        const textToAnalyze = `${adData.title || ''} ${adData.description || ''}`.toLowerCase();
        
        signals.highRiskKeywords = this.findKeywords(textToAnalyze, this.HIGH_RISK_KEYWORDS);
        signals.suspiciousKeywords = this.findKeywords(textToAnalyze, this.SUSPICIOUS_KEYWORDS);
        signals.positiveKeywords = this.findKeywords(textToAnalyze, this.POSITIVE_KEYWORDS);

        // 5. Verificar inconsistências básicas
        signals.hasInconsistencies = this.checkInconsistencies(adData);

        // Calcular ajuste de score
        const scoreAdjustment = this.calculateScoreAdjustment(signals);

        return {
            signals,
            scoreAdjustment,
            summary: this.generateSummary(signals),
            explanations: this.generateExplanations(signals)
        };
    },

    generateExplanations(signals) {
        const list = [];
        
        // High Risk
        if (signals.highRiskKeywords.length > 0) {
            list.push({ text: `⚠️ Padrão de risco elevado: "${signals.highRiskKeywords[0]}"`, kind: 'risk', type: 'critical' });
        }
        
        // Suspicious
        signals.suspiciousKeywords.forEach(kw => {
             list.push({ text: `Termo pouco comum: "${kw}"`, kind: 'risk', type: 'warning' });
        });
        
        if (signals.textQuality === 'poor') list.push({ text: 'Descrição com pouca informação objetiva', kind: 'risk', type: 'warning' });
        if (signals.photoCount < 3) list.push({ text: 'Galeria com menos de 3 fotos', kind: 'risk', type: 'warning' });
        if (signals.priceIsRound) list.push({ text: 'Preço arredondado (padrão atípico)', kind: 'risk', type: 'info' });
        if (signals.hasInconsistencies) list.push({ text: 'Relação preço/tipologia fora do comum', kind: 'risk', type: 'warning' });
        
        // POSITIVES (Step 4 Alive)
        if (signals.positiveKeywords.length > 0) {
             signals.positiveKeywords.forEach(kw => {
                 list.push({ text: `✅ Menção útil: "${kw}"`, kind: 'quality', type: 'success' });
             });
        }
        
        // Implicit Positives (Step 4 - Garantindo que a tab Positive nunca morre)
        if (signals.textLength > 300) list.push({ text: 'Descrição detalhada e informativa', kind: 'quality', type: 'success' });
        if (signals.photoCount >= 5) list.push({ text: 'Galeria de fotos abrangente', kind: 'quality', type: 'success' });
        if (!signals.priceIsRound && signals.textQuality !== 'poor') list.push({ text: 'Formatação de preço padrão', kind: 'quality', type: 'neutral' });

        return list;
    },

    /**
     * Avalia qualidade do texto.
     * @param {string} text 
     * @returns {string} 'poor' | 'average' | 'good'
     */
    assessTextQuality(text) {
        if (!text || text.length < 50) return 'poor';
        if (text.length < this.CONFIG.MIN_TEXT_LENGTH) return 'average';
        
        // Verificar se tem informações estruturadas
        const hasNumbers = /\d+\s*(m²|m2|quartos?|wc|assoalhadas?)/.test(text.toLowerCase());
        const hasLocation = /rua|avenida|bairro|zona|metro|próximo/.test(text.toLowerCase());
        
        if (hasNumbers && hasLocation && text.length > 200) return 'good';
        if (hasNumbers || text.length > 150) return 'average';
        
        return 'poor';
    },

    /**
     * Verifica se o preço é um número redondo (mais comum em fraudes).
     * @param {string|number} price 
     * @returns {boolean}
     */
    isPriceRound(price) {
        // Extrair número do preço
        const numericPrice = typeof price === 'string' 
            ? parseInt(price.replace(/[^\d]/g, ''), 10) 
            : price;
        
        if (isNaN(numericPrice) || numericPrice === 0) return false;
        
        // Preços como 100000, 150000, 200000 são redondos
        // Verificar se termina em pelo menos 3 zeros ou é múltiplo de 5000
        if (numericPrice >= 10000) {
            return numericPrice % 5000 === 0;
        }
        // Para preços menores (rendas), verificar múltiplos de 50
        return numericPrice % 50 === 0;
    },

    /**
     * Encontra keywords numa string.
     * @param {string} text 
     * @param {string[]} keywords 
     * @returns {string[]}
     */
    findKeywords(text, keywords) {
        return keywords.filter(kw => text.includes(kw.toLowerCase()));
    },

    /**
     * Verifica inconsistências no anúncio.
     * @param {Object} adData 
     * @returns {boolean}
     */
    checkInconsistencies(adData) {
        const inconsistencies = [];

        // Preço muito baixo para a tipologia mencionada
        if (adData.price && adData.title) {
            const price = parseInt(String(adData.price).replace(/[^\d]/g, ''), 10);
            const title = adData.title.toLowerCase();
            
            // T3+ por menos de 50k em venda ou <400 em arrendamento é suspeito
            // Assumindo que o preço pode ser venda ou renda, é dificil sem mais contexto
            // Mas T3 < 500 euros é muito suspeito hoje em dia
            if ((title.includes('t3') || title.includes('t4') || title.includes('t5')) && price > 0) {
                 if (price < 400) inconsistencies.push('price_too_low_rent');
                 if (price > 1000 && price < 50000) inconsistencies.push('price_too_low_sale');
            }
        }

        return inconsistencies.length > 0;
    },

    /**
     * Calcula ajuste de score baseado nos sinais.
     * @param {Object} signals 
     * @returns {number} Ajuste (-100 a +10)
     */
    calculateScoreAdjustment(signals) {
        let adjustment = 0;

        // **HIGH RISK - KILL SWITCH**
        // Se detetar conversa de burlão "hardcore", penaliza massivamente
        if (signals.highRiskKeywords.length > 0) {
            return -80; // (Almost) Instant Red Flag
        }

        // Penalizações Normais
        if (signals.textQuality === 'poor') adjustment -= 5;
        if (signals.photoCount < this.CONFIG.MIN_PHOTOS) adjustment -= 5;
        if (signals.priceIsRound) adjustment -= 3;
        
        // Keywords suspeitas (máximo -15 agora)
        adjustment -= Math.min(signals.suspiciousKeywords.length * 4, 15);

        // Inconsistências
        if (signals.hasInconsistencies) adjustment -= 5;

        // Bónus
        if (signals.textQuality === 'good') adjustment += 5;
        if (signals.photoCount >= 5) adjustment += 3;
        
        // Keywords positivas (máximo +10)
        adjustment += Math.min(signals.positiveKeywords.length * 2, 10);

        // Limitar range (agora permite ir até -80)
        return Math.max(-80, Math.min(15, adjustment));
    },

    /**
     * Gera resumo legível para UI.
     * @param {Object} signals 
     * @returns {string}
     */
    generateSummary(signals) {
        const issues = [];
        
        // Prioridade MÁXIMA para High Risk
        if (signals.highRiskKeywords.length > 0) {
            return `⚠️ ALERTA CRÍTICO: Padrões de burla (${signals.highRiskKeywords[0]})`;
        }

        if (signals.textQuality === 'poor') {
            issues.push('Descrição muito vazia');
        }
        if (signals.photoCount < 3) {
            issues.push('Poucas fotografias');
        }
        if (signals.suspiciousKeywords.length > 0) {
            issues.push(`Termos suspeitos: ${signals.suspiciousKeywords.slice(0, 2).join(', ')}`);
        }
        if (signals.priceIsRound) {
            issues.push('Preço arredondado');
        }
        if (signals.hasInconsistencies) {
            issues.push('Preço anormalmente baixo');
        }

        if (issues.length === 0) {
            if (signals.positiveKeywords.length > 0) {
                return 'Anúncio detalhado e credível';
            }
            return 'Sem alertas de conteúdo';
        }

        return issues.join(' • ');
    },

    /**
     * Extrai dados do anúncio a partir do DOM.
     * @param {HTMLElement} container - Container do anúncio
     * @param {Object} selectors - Seletores do site
     * @returns {Object} Dados extraídos
     */
    extractFromDOM(container, selectors) {
        const data = {
            title: '',
            description: '',
            price: '',
            photoCount: 0
        };

        // Título
        const titleEl = container.querySelector(selectors.title);
        if (titleEl) data.title = titleEl.innerText.trim();

        // Preço
        const priceEl = container.querySelector(selectors.price);
        if (priceEl) data.price = priceEl.innerText.trim();

        // Descrição (tentar vários seletores comuns)
        const descSelectors = [
            '.description', '.ad-description', '[class*="description"]',
            '.text-description', '.comment', 'p.text', '.adCommentsLanguage'
        ];
        for (const sel of descSelectors) {
            const descEl = container.querySelector(sel) || document.querySelector(sel);
            if (descEl) {
                data.description = descEl.innerText.trim();
                break;
            }
        }

        // Contar fotos
        const photoSelectors = [
            'img[class*="photo"]', 'img[class*="image"]', '.gallery img',
            '[class*="carousel"] img', '.photos img', '.main-image_first'
        ];
        for (const sel of photoSelectors) {
            const photos = container.querySelectorAll(sel) || document.querySelectorAll(sel);
            if (photos.length > 0) {
                data.photoCount = photos.length;
                break;
            }
        }

        return data;
    }
};

