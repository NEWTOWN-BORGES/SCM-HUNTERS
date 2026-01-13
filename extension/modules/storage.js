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
                
                // Merge campos restantes
                entry = { ...entry, ...data, last_seen: Date.now() };

                // Recalcula scores (Eixo Duplo)
                const scores = this.calculateScores(entry);
                entry.risk_score = scores.risk;
                entry.quality_score = scores.quality;

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
                total_votes: 0,
                last_sync: 0
            },
            // Comentários da comunidade
            comments: [],  // Array de { text, timestamp, id }
            // Dados Nativos do Site (Views, Saves)
            native_signals: {
                views: 0,
                saves: 0
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
            // 1. Calcular Risco (Começa em 100 e desce)
            let riskScore = this.CONFIG.INITIAL_RISK_SCORE;
            
            // Check de integridade
            if (typeof this.calculateRiskPenalties !== 'function') {
                console.error("Anti-Scam Critical: calculateRiskPenalties missing!");
                return { risk: 50, quality: 0 }; // Fallback "Unknown"
            }

            const riskPenalties = this.calculateRiskPenalties(entry);
            riskScore -= riskPenalties;
            
            riskScore = Math.max(this.CONFIG.MIN_RISK_SCORE, Math.min(this.CONFIG.MAX_RISK_SCORE, riskScore));

            // 2. Calcular Qualidade 
            let qualityScore = 0;
            
            // Camouflage Rule
            if (riskScore >= this.CONFIG.RISK_THRESHOLD_FOR_QUALITY) {
                if (typeof this.calculateQualityScore === 'function') {
                    qualityScore = this.calculateQualityScore(entry);
                }
            }

            return { risk: riskScore, quality: qualityScore };

        } catch (e) {
            console.error("Anti-Scam Scoring Error:", e);
            // Fallback seguro: nem bom nem mau
            return { risk: 50, quality: 0 };
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

        // 1. Sinais do Anúncio (AdAnalyzer)
        if (ad.score_adjustment !== undefined) {
            penalties -= ad.score_adjustment;
        }

        // 2. Sinais do Utilizador (Reports Locais - Legado/User Action)
        if (user.advance_payment > 0) penalties += 50;
        if (user.external_contact > 0) penalties += 30;

        // 3. Sinais da Comunidade (V2.0 COMPLETO)
        
        // --- RISCO CRÍTICO ---
        if (community.votes_advance_payment > 0) penalties += (community.votes_advance_payment * 40);
        if (community.votes_off_platform > 0) penalties += (community.votes_off_platform * 35);
        if (community.votes_fake_item > 0) penalties += (community.votes_fake_item * 30);
        
        // --- RISCO MÉDIO ---
        if (community.votes_inconsistent > 0) penalties += (community.votes_inconsistent * 20);
        if (community.votes_unrealistic_price > 0) penalties += (community.votes_unrealistic_price * 20);
        if (community.votes_repost > 0) penalties += (community.votes_repost * 15);
        if (community.votes_new_profile > 0) penalties += (community.votes_new_profile * 15);
        if (community.votes_conditions_changed > 0) penalties += (community.votes_conditions_changed * 15);

        // --- RISCO LEVE ---
        if (community.votes_evasive > 0) penalties += (community.votes_evasive * 10);
        if (community.votes_location_vague > 0) penalties += (community.votes_location_vague * 10);
        if (community.votes_generic_images > 0) penalties += (community.votes_generic_images * 10);
        if (community.votes_vague_desc > 0) penalties += (community.votes_vague_desc * 5);
        if (community.votes_pressure > 0) penalties += (community.votes_pressure * 10);
        if (community.votes_missing_details > 0) penalties += (community.votes_missing_details * 5);

        // 4. Sinais Comportamentais (Agregados)
        if (behavior.total_visits > 5) {
            const abandonRate = behavior.abandon_fast_count / behavior.total_visits;
            if (abandonRate > 0.6) penalties += 15;
            else if (abandonRate > 0.4) penalties += 5;
        }

        return penalties;
    },

    /**
     * Calcula score de qualidade (Interesse da Comunidade).
     */
    calculateQualityScore(entry) {
        let quality = 0;
        const behavior = entry.behavior_signals || {};
        const community = entry.community_signals || {};
        const native = entry.native_signals || {};
        
        // 1. Sinais Nativos do Site
        if (native.saves > 0) quality += Math.min(50, native.saves * 5);
        if (native.views > 1000) quality += 10;

        // 2. Votos da Comunidade (V2.0 POSITIVOS)
        
        // --- SINAIS FORTES ---
        if (community.votes_visit_available > 0) quality += (community.votes_visit_available * 30);
        if (community.votes_location_confirmed > 0) quality += (community.votes_location_confirmed * 25);
        if (community.votes_docs_shown > 0) quality += (community.votes_docs_shown * 20);

        // --- SINAIS MÉDIOS ---
        if (community.votes_old_profile > 0) quality += (community.votes_old_profile * 15);
        if (community.votes_original_photos > 0) quality += (community.votes_original_photos * 15);
        if ((community.votes_legit || 0) > 0) quality += (community.votes_legit * 15); // Legado

        // --- SINAIS LEVES ---
        if (community.votes_clear_answers > 0) quality += (community.votes_clear_answers * 10);
        if (community.votes_normal_interaction > 0) quality += (community.votes_normal_interaction * 10);
        
        // --- LIKES (Geral) ---
        if (community.votes_like > 0) {
             quality += (community.votes_like * 5);
        }

        // 3. Comportamento Local
        if (behavior.total_visits > 0) {
            const scrollRate = behavior.scroll_complete_count / behavior.total_visits;
            if (scrollRate > 0.4) quality += 20;
            
            const contactRate = behavior.contact_open_count / behavior.total_visits;
            if (contactRate > 0.15) quality += 30; 
            else if (contactRate > 0.05) quality += 10;
        }

        if (behavior.copy_contact_count > 0) {
             quality += Math.min(40, behavior.copy_contact_count * 10);
        }

        if (behavior.avg_time_on_page > 45000) quality += 10;

        // Se SÓ tiver views (sem interação ou favoritos), não sobe muito
        if (quality === 0 && native.views > 0 && community.total_votes === 0) return 0;

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
            explanations,
            confidence: totalVisits > 5 ? 'high' : (totalVisits > 2 ? 'medium' : 'low')
        };
    }
};

// Export para uso global
window.StorageModule = StorageModule;
 
