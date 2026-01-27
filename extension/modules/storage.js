/**
 * Anti-Scam Storage Module
 * Gerencia persistência local de scores e sinais.
 * ATUALIZADO: Suporta dados comportamentais agregados e cálculo híbrido.
 */

const StorageModule = {
    // Configurações
    // Configurações
    CONFIG: {
        // Definições de Risco (0-100, 100 = Seguro)
        INITIAL_RISK_SCORE: 100,
        MIN_RISK_SCORE: 0,
        MAX_RISK_SCORE: 100,
        RISK_THRESHOLD_FOR_QUALITY: 60, // Só mostra qualidade se risco > 60

        // Definições de Qualidade (0-100, 100 = Excelente)
        INITIAL_QUALITY_SCORE: 0,
        MAX_QUALITY_SCORE: 100,
    },

    /**
     * Gera um hash único para o anúncio baseado em título + preço.
     * @param {string} text - String concatenada
     * @returns {Promise<string>} - Hash SHA-256
     */
    async generateHash(text) {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Salva ou atualiza um anúncio no storage local.
     * @param {string} hash - Hash único do anúncio
     * @param {Object} data - Dados parciais para atualizar
     */
    async updateAdData(hash, data) {
        return new Promise((resolve) => {
            chrome.storage.local.get([hash], (result) => {
                let entry = result[hash] || this.createDefaultEntry();
                
                // Merge profundo para dados aninhados
                if (data.behavior_signals) {
                    entry.behavior_signals = { ...entry.behavior_signals, ...data.behavior_signals };
                    delete data.behavior_signals;
                }
                if (data.ad_signals) {
                    entry.ad_signals = { ...entry.ad_signals, ...data.ad_signals };
                    delete data.ad_signals;
                }
                if (data.user_signals) {
                    entry.user_signals = { ...entry.user_signals, ...data.user_signals };
                    delete data.user_signals;
                }
                // CRÍTICO: Merge profundo para community_signals (evita perder votos anteriores)
                if (data.community_signals) {
                    entry.community_signals = { ...entry.community_signals, ...data.community_signals };
                    delete data.community_signals;
                }
                
                // Merge campos restantes
                entry = { ...entry, ...data, last_seen: Date.now() };

                // Recalcula scores (Eixo Duplo + Confiança)
            const scores = this.calculateScores(entry);
            entry.risk_score = scores.risk;
            entry.quality_score = scores.quality;
            entry.confidence_score = scores.confidence;

                // Salva
                chrome.storage.local.set({ [hash]: entry }, () => {
                   resolve(entry);
                });
            });
        });
    },

    /**
     * Atualiza sinais comportamentais agregados.
     * @param {string} hash - Hash do anúncio
     * @param {Object} metrics - Métricas da sessão do BehaviorTracker
     */
    async updateBehaviorSignals(hash, metrics) {
        const entry = await this.getAdData(hash);
        if (!entry) return null;

        const behavior = entry.behavior_signals;
        
        // Incrementar contadores agregados
        behavior.total_visits++;
        
        if (metrics.isFastAbandon) behavior.abandon_fast_count++;
        if (metrics.hasOpenedContact) behavior.contact_open_count++;
        if (metrics.hasCopiedContact) behavior.copy_contact_count++;
        if (metrics.hasCompletedScroll) behavior.scroll_complete_count++;
        
        // Média móvel do tempo na página
        const prevTotal = behavior.avg_time_on_page * (behavior.total_visits - 1);
        behavior.avg_time_on_page = Math.round((prevTotal + metrics.timeOnPage) / behavior.total_visits);

        return this.updateAdData(hash, { behavior_signals: behavior });
    },

    /**
     * Recupera dados de um anúncio.
     * @param {string} hash 
     * @returns {Promise<Object>}
     */
    async getAdData(hash) {
        return new Promise((resolve) => {
            chrome.storage.local.get([hash], (result) => {
                resolve(result[hash] || null);
            });
        });
    },

    createDefaultEntry() {
        return {
            first_seen: Date.now(),
            last_seen: Date.now(),
            risk_score: this.CONFIG.INITIAL_RISK_SCORE,
            quality_score: this.CONFIG.INITIAL_QUALITY_SCORE,
            
            // Reports explícitos dos utilizadores (Sinais de Risco)
            user_signals: {
                no_response: 0,        // Não responde a mensagens
                external_contact: 0,   // Pede contacto fora da plataforma
                advance_payment: 0,    // Pede pagamento adiantado
                copy_paste_text: 0     // Texto genérico/repetido
            },
            // Sinais da Comunidade (Simulação de Base de Dados Partilhada)
            community_signals: {
                votes_no_response: 0,
                votes_external_contact: 0,
                votes_advance_payment: 0,
                votes_fake_item: 0,
                votes_legit: 0,       // "Respondeu" / "Parece OK"
                total_votes: 0,       // Mantido para compatibilidade, será o WEIGHTED
                total_votes_raw: 0,   // Inteiro (Pessoas reais)
                total_votes_weighted: 0, // Soma dos pesos
                last_sync: 0
            },
            // Comentários da comunidade
            comments: [],  // Array de { text, timestamp, id }
            // Dados Nativos do Site (Views, Saves)
            native_signals: {
                views: 0,
                saves: 0,
                created_at: Date.now()
            },
            // Dados comportamentais agregados (Mistura de Risco e Qualidade)
            behavior_signals: {
                total_visits: 0,
                abandon_fast_count: 0,      // Risco
                contact_open_count: 0,      // Qualidade
                copy_contact_count: 0,      // Qualidade (Forte)
                scroll_complete_count: 0,   // Qualidade
                avg_time_on_page: 0         // Qualidade/Risco (depende do valor)
            },
            // Análise estrutural do anúncio
            ad_signals: {
                text_length: 0,
                photo_count: 0,
                price_is_round: false,
                text_quality: 'unknown',
                suspicious_keywords: [],
                score_adjustment: 0
            }
        };
    },

    /**
     * Simula sincronização com servidor central (Mock ou Real via API).
     * @param {string} hash
     * @param {Object} adData 
     * @returns {Object}
     */
    async syncWithServer(hash, adData) {
        // Integração com APIModule se disponível
        if (window.APIModule && window.APIModule.ENABLED) {
            try {
                const syncedData = await window.APIModule.syncAdData(hash, adData);
                return syncedData;
            } catch (e) {
                console.warn('[Storage] API Sync failed, using local', e);
            }
        }
        return adData;
    },

    /**
     * Calcula scores de Risco e Qualidade.
     */
    calculateScores(entry) {
        try {
            const riskScore = Math.max(this.CONFIG.MIN_RISK_SCORE, Math.min(this.CONFIG.MAX_RISK_SCORE, this.CONFIG.INITIAL_RISK_SCORE - this.calculateRiskPenalties(entry)));
            const qualityScore = riskScore >= this.CONFIG.RISK_THRESHOLD_FOR_QUALITY ? this.calculateQualityScore(entry) : 0;
            const confidenceScore = this.calculateConfidenceScore(entry);

            return { 
                risk: riskScore, 
                quality: qualityScore, 
                confidence: confidenceScore 
            };

        } catch (e) {
            console.error("Anti-Scam Scoring Error:", e);
            return { risk: 50, quality: 0, confidence: 0 };
        }
    },

    /**
     * Calcula penalizações de risco baseadas em sinais acumulados.
     * @param {Object} entry 
     * @returns {number} Penalização total (positivo = mau)
     */
    calculateRiskPenalties(entry) {
        let penalties = 0;
        const ad = entry.ad_signals || {};
        const user = entry.user_signals || {};
        const community = entry.community_signals || {};
        const behavior = entry.behavior_signals || {};

        // 1. Sinais do Anúncio (AdAnalyzer - Mantém absoluto pois é análise IA única)
        if (ad.score_adjustment !== undefined) {
            penalties -= ad.score_adjustment;
        }

        // 2. Sinais do Utilizador (Legacy - Mantém absoluto)
        if (user.advance_payment > 0) penalties += 50;
        if (user.external_contact > 0) penalties += 30;

        // 3. Sinais da Comunidade (PERCENTAGE BASED)
        const total = community.total_votes_weighted || community.total_votes || 0;

        if (total > 0) {
            // Helper para calcular impacto
            // count: nº de votos nesse botão
            // maxImpact: quanto afeta o score (0-100) se 100% das pessoas votarem nisto
            const calcImpact = (count, maxImpact) => {
                if (!count) return 0;
                const ratio = count / total;
                return ratio * maxImpact;
            };

            // --- RISCO CRÍTICO (Impacto 100% - Se todos disserem isto, é SCAM garantido) ---
            penalties += calcImpact(community.votes_no_response, 100);
            penalties += calcImpact(community.votes_external_contact, 100);
            penalties += calcImpact(community.votes_advance_payment, 100);
            penalties += calcImpact(community.votes_fake_item, 100);
            penalties += calcImpact(community.votes_deposit_no_visit, 100);
            penalties += calcImpact(community.votes_bad_quality, 100);
            penalties += calcImpact(community.votes_off_platform, 100);
            
            // Novos Sinais Críticos (Real Estate/General)
            penalties += calcImpact(community.votes_not_owner, 100);
            penalties += calcImpact(community.votes_no_visit_allowed, 100); // Recusa visita
            penalties += calcImpact(community.votes_cloned_listing, 100);
            penalties += calcImpact(community.votes_property_different, 100);
            
            // Novos Sinais Críticos (OLX/Facebook/Auto)
            penalties += calcImpact(community.votes_mbway_scam, 100);
            penalties += calcImpact(community.votes_fake_proof, 100);
            penalties += calcImpact(community.votes_sms_code, 100);
            penalties += calcImpact(community.votes_foreign_shipping, 100);
            penalties += calcImpact(community.votes_suspicious_link, 100);
            penalties += calcImpact(community.votes_cloned_ad, 100); // Alias
            penalties += calcImpact(community.votes_fake_profile, 100);
            penalties += calcImpact(community.votes_deposit_before_see, 100);
            penalties += calcImpact(community.votes_fake_payment_proof, 100);
            penalties += calcImpact(community.votes_abroad_car, 100);
            penalties += calcImpact(community.votes_accident_hidden, 100);
            penalties += calcImpact(community.votes_debts_hidden, 100);

            penalties += calcImpact(community.votes_fake_courier, 100);
            penalties += calcImpact(community.votes_phishing, 100);
            penalties += calcImpact(community.votes_external_payment, 100);

            // --- RISCO MÉDIO/AMARELO (Impacto 40%) ---
            penalties += calcImpact(community.votes_price_too_good, 40);
            penalties += calcImpact(community.votes_unrealistic_price, 40);
            penalties += calcImpact(community.votes_repost, 40);
            penalties += calcImpact(community.votes_conditions_changed, 40);
            penalties += calcImpact(community.votes_pressure, 40);
            penalties += calcImpact(community.votes_evasive, 40);
            penalties += calcImpact(community.votes_location_vague, 40);
            penalties += calcImpact(community.votes_generic_images, 40);
            penalties += calcImpact(community.votes_new_profile, 40);
            penalties += calcImpact(community.votes_inconsistent, 40);
            
            // Novos Sinais Amarelos
            penalties += calcImpact(community.votes_too_cheap, 40);
            penalties += calcImpact(community.votes_ai_photos, 40);
            penalties += calcImpact(community.votes_targets_foreigners, 40);
            penalties += calcImpact(community.votes_bad_portuguese, 40);
            penalties += calcImpact(community.votes_address_fishing, 40);
            penalties += calcImpact(community.votes_only_whatsapp, 40); 
            penalties += calcImpact(community.votes_km_suspect, 40);
            penalties += calcImpact(community.votes_no_test_drive, 40);
            penalties += calcImpact(community.votes_docs_incomplete, 40);
            penalties += calcImpact(community.votes_pressure_sale, 40);

            // --- RISCO LEVE (Impacto 20%) ---
            penalties += calcImpact(community.votes_vague_desc, 20);
            penalties += calcImpact(community.votes_missing_details, 20);
            penalties += calcImpact(community.votes_poor_description, 20);
            penalties += calcImpact(community.votes_sold_item, 20);
        }
        
        // Penalidade por Dislikes (Separado do Rácio Democrático)
        const dislikes = community.votes_dislike || 0;
        if (dislikes > 0) {
            // 3 pontos por dislike, capado a 15 (feedback leve)
            penalties += Math.min(15, dislikes * 3);
        }

        // NOTA: O Silêncio (Análise Passiva) e Comportamento foi movido 
        // para o nível de Confiança, para evitar penalizar score falsamente.

        // FLAG: Consistência Excessiva (Positive Shield Defense)
        // Se temos muitos votos e 100% positivos, pode ser um ataque de validação.
        const totalVotes = community.total_votes || 0;
        const positiveVotes = (community.votes_legit || 0) + (community.votes_visit_available || 0);
        if (totalVotes > 8 && positiveVotes === totalVotes) {
            // Não penaliza o score, mas reduzirá a confiança na "perfeição"
            // ou será usado no Qualitative State.
            entry.as_excessive_consensus = true;
        }

        return penalties;
    },

    /**
     * Calcula o nível de confiança/maturidade dos dados.
     * Resolve o "Ponto Cego" do silêncio vs burla.
     */
    calculateConfidenceScore(entry) {
        let confidence = 0;
        const community = entry.community_signals || {};
        const native = entry.native_signals || {};
        const behavior = entry.behavior_signals || {};
        const totalVotes = community.total_votes_raw || community.total_votes || 0;
        const views = native.views || 0;

        // 1. Volume de Votos (Base Sólida)
        if (totalVotes > 10) confidence += 60;
        else if (totalVotes > 3) confidence += 30;
        else if (totalVotes > 0) confidence += 10;

        // 2. Volume de Visualizações (Exposição)
        if (views > 1000) confidence += 20;
        else if (views > 300) confidence += 10;

        // 3. Comportamento (Tempo de permanência médio alto dá confiança na análise)
        if (behavior.avg_time_on_page > 40000) confidence += 20;

        return Math.min(100, confidence);
    },

    /**
     * Calcula score de qualidade (Interesse da Comunidade).
     * REINVENTADO: Sistema Democrático por Percentagem
     */
    calculateQualityScore(entry) {
        let quality = 0;
        const community = entry.community_signals || {};
        const native = entry.native_signals || {};
        const total = community.total_votes || 0;

        // 1. Sinais Nativos do Site (Base Absoluta - Bonus)
        if (native.saves > 0) quality += Math.min(20, native.saves * 2);
        if (native.views > 1000) quality += 5;

        // 2. Votos da Comunidade (PERCENTAGE BASED)
        if (total > 0) {
            const calcImpact = (count, maxImpact) => {
                if (!count) return 0;
                const ratio = count / total;
                return ratio * maxImpact;
            };

            // --- SINAIS FORTES (Prova Física/Transação Real) - Impacto 80% ---
            quality += calcImpact(community.votes_visit_available, 80);
            quality += calcImpact(community.votes_visit_done, 80);
            quality += calcImpact(community.votes_saw_car, 80);
            quality += calcImpact(community.votes_test_drive_ok, 80);
            quality += calcImpact(community.votes_mechanic_check, 80);
            quality += calcImpact(community.votes_hand_delivery, 80);
            quality += calcImpact(community.votes_product_ok, 80);
            quality += calcImpact(community.votes_mail_ok, 80);
            
            // Documentos e Localização Forte - Impacto 60%
            quality += calcImpact(community.votes_docs_shown, 60);
            quality += calcImpact(community.votes_docs_ok, 60);
            quality += calcImpact(community.votes_docs_complete, 60);
            quality += calcImpact(community.votes_location_confirmed, 60);
            quality += calcImpact(community.votes_location_matches, 60);
            quality += calcImpact(community.votes_real_owner, 60);
            quality += calcImpact(community.votes_owner_real, 60);

            // --- SINAIS MÉDIOS (Reputação/Comunicação) - Impacto 40% ---
            quality += calcImpact(community.votes_old_profile, 40);
            quality += calcImpact(community.votes_legit_profile, 40);
            quality += calcImpact(community.votes_trusted_seller, 40);
            quality += calcImpact(community.votes_trusted_stand, 40);
            quality += calcImpact(community.votes_history_clear, 40);
            
            quality += calcImpact(community.votes_original_photos, 30);
            quality += calcImpact(community.votes_real_photos, 30);
            quality += calcImpact(community.votes_legit, 30);

            // --- SINAIS LEVES (Comunicação) - Impacto 20% ---
            quality += calcImpact(community.votes_clear_answers, 20);
            quality += calcImpact(community.votes_clear_communication, 20);
            quality += calcImpact(community.votes_communication, 20);
            quality += calcImpact(community.votes_normal_interaction, 20);
            quality += calcImpact(community.votes_responsive, 20);
            quality += calcImpact(community.votes_clear_process, 20);
            quality += calcImpact(community.votes_fair_price, 20);

        }

        // Bonus por Likes (Separado do Rácio Democrático)
        const likes = community.votes_like || 0;
        if (likes > 0) {
            // 2 pontos por like, capado a 10
            quality += Math.min(10, likes * 2);
        }

        return Math.min(100, quality);
    },

    /**
     * Gera explicação textual para UI.
     * @param {Object} entry 
     * @returns {Object}
     */
    getScoreExplanation(entry) {
        const explanations = [];
        const behavior = entry.behavior_signals || {};
        const totalVisits = behavior.total_visits || 0;

        // Explicações de Risco
        const abandonRate = totalVisits > 0 ? (behavior.abandon_fast_count / totalVisits) : 0;
        if (abandonRate > 0.5) {
            explanations.push({ type: 'warning', text: 'Alta taxa de rejeição' });
        }
        
        if (entry.user_signals) {
            const r = entry.user_signals;
            if (r.advance_payment > 0) explanations.push({ kind: 'risk', text: 'Reportado: Pagamento adiantado' });
            if (r.external_contact > 0) explanations.push({ kind: 'risk', text: 'Reportado: Contacto externo' });
        }

        // 5. Silêncio Suspeito e Antiguidade
        const community = entry.community_signals || {};
        const totalVotes = community.total_votes || 0;
        const native = entry.native_signals || {};
        const positiveVotes = (community.votes_legit || 0) + (community.votes_visit_available || 0) + (community.votes_good_quality || 0);
        const views = native.views || 0;
        const createdAt = native.created_at || Date.now();
        const ageInDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

        if (views > 800 && positiveVotes < 2) {
            explanations.push({ 
                kind: 'caution', 
                text: 'Exposição atípica: Muitas visualizações face à ausência de interação comunitária.' 
            });
        }
        
        if (ageInDays > 5 && totalVotes === 0) {
            explanations.push({ 
                kind: 'caution', 
                text: 'Registo limitado: Anúncio com visibilidade sem feedback comunitário registado.' 
            });
        }

        // Explicações de Qualidade (Só se houver score de qualidade)
        if (entry.quality_score > 0) {
            const contactRate = totalVisits > 0 ? (behavior.contact_open_count / totalVisits) : 0;
            if (contactRate > 0.10) {
                explanations.push({ kind: 'quality', text: 'Interesse frequente nos contactos' });
            }
            if (behavior.avg_time_on_page > 40000) {
                explanations.push({ kind: 'quality', text: 'Tempo de leitura acima da média' });
            }
        }

        return {
            risk_score: entry.risk_score,
            quality_score: entry.quality_score,
            confidence_score: entry.confidence_score,
            explanations,
            confidence: entry.confidence_score > 70 ? 'high' : (entry.confidence_score > 30 ? 'medium' : 'low'),
            state: this.getQualitativeState(entry)
        };
    },

    /**
     * Retorna o estado qualitativo do anúncio (Veredito Humano).
     * Substitui o score absoluto por 4 estados de maturidade e risco.
     * @param {Object} entry 
     * @returns {Object} { label, color, description, class }
     */
    getQualitativeState(entry) {
        const community = entry.community_signals || {};
        const totalVotes = community.total_votes || 0;
        const risk = entry.risk_score;
        const confidence = entry.confidence_score || 0;
        const native = entry.native_signals || {};
        
        // 1. Alertas Relevantes (Só se Risco for BAIXO)
        // Prioridade máxima: Há registos diretos de irregularidades
        const criticalSignals = [
            'votes_advance_payment', 'votes_fake_item', 'votes_deposit_no_visit',
            'votes_external_contact', 'votes_no_visit_allowed', 'votes_cloned_listing',
            'votes_mbway_scam', 'votes_phishing'
        ];
        const hasCritical = criticalSignals.some(sig => community[sig] > 0);

        if (risk < 60 || hasCritical) {
            return {
                label: 'Atenção Requerida',
                color: '#f87171',
                description: 'Foram reportadas divergências significativas pela comunidade.',
                class: 'as-state-critical'
            };
        }

        // 2. Não Validado / Poucos Dados (Volume insuficiente para qualquer conclusão)
        if (confidence < 30) {
            return {
                label: 'Pendente de Validação',
                color: '#94a3b8',
                description: 'Ainda não existem registos comunitários suficientes para uma análise conclusiva.',
                class: 'as-state-neutral'
            };
        }

        // 3. Padrões Consistentes (Risco Alto/Bom + Confiança Média/Alta)
        if (risk >= 85 && confidence >= 50) {
            // Defesa contra Positive Shield: Se é perfeito demais, suspeitamos.
            if (entry.as_excessive_consensus) {
                return {
                    label: 'Sob Observação',
                    color: '#fbbf24',
                    description: 'Padrão estatístico atípico: Consenso excessivo detetado. Recomenda-se cautela adicional.',
                    class: 'as-state-warning'
                };
            }

            return {
                label: 'Padrão Consistente',
                color: '#34d399',
                description: 'Este anúncio apresenta um histórico de interações coerente com as normas da plataforma.',
                class: 'as-state-safe'
            };
        }

        // 4. Análise em Observação (Mistos ou Exposição sem Validação)
        let description = 'Existem registos limitados ou divergências nos dados comunitários.';
        const views = native.views || 0;
        
        if (views > 1000 && totalVotes < 3) {
            description = 'Exposição elevada com baixo feedback: Recomenda-se precaução na análise dos detalhes.';
        }

        return {
            label: 'Sob Observação',
            color: '#fbbf24',
            description: description,
            class: 'as-state-warning'
        };
    }
};

// Export para uso global
window.StorageModule = StorageModule;
 
