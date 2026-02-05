/**
 * Anti-Scam Content Script
 * Orquestra a leitura da página e injeção de UI.
 * ATUALIZADO: Integra tracking comportamental e análise de anúncios.
 */

// Carrega o UIModule globalmente
const UIModule = window.UIModule || {};

// Verifica se o módulo foi carregado
if (!window.UIModule) {
    console.warn('SCM HUNTERS: UIModule não detectado no objeto window. Verifique a ordem de carregamento no manifest.');
}

// Verifica se o CSS foi injetado (Log informativo apenas)
console.log('SCM HUNTERS: Inicializando...');
const hasOurCSS = Array.from(document.querySelectorAll('link, style')).some(el => 
    (el.href && el.href.includes('content.css')) || 
    (el.id === 'as-styles')
);
if (!hasOurCSS) {
    console.debug('SCM HUNTERS: CSS não detectado por href. Isto é normal em alguns sites se injetado via manifest isolated world.');
}

const App = {
    // Configurações de Botões (Templates)
    buttonTemplates: {
        default: [
            // ========== SINAIS DE RISCO - FINANCEIROS ==========
            { tab: 'risk', signal: 'votes_deposit_no_visit', label: 'Caução sem visita', icon: '💸', class: 'as-btn-risk',
              contexts: ["Antes da visita", "Reserva p/ MBWay", "Sinal via IBAN"],
              description: 'Pede caução, sinal ou reserva ANTES de visitar o imóvel. Tática #1 de burla segundo PSP.' },
            { tab: 'risk', signal: 'votes_external_payment', label: 'Link pagamento externo', icon: '🔗', class: 'as-btn-risk',
              description: 'Enviou link para site de pagamento/reserva fora da plataforma. Pode ser phishing.' },
            { tab: 'risk', signal: 'votes_conditions_changed', label: 'Mudou condições', icon: '💱', class: 'as-btn-warning',
              description: 'Alterou preço, requisitos ou condições depois do contacto inicial.' },
            
            // ========== SINAIS DE RISCO - LEGITIMIDADE ==========
            { tab: 'risk', signal: 'votes_not_owner', label: 'Não é o dono', icon: '🎭', class: 'as-btn-risk',
              description: 'Suspeita de sublocação fraudulenta. Aluga imóvel e "subarrenda" a vítimas.' },
            { tab: 'risk', signal: 'votes_no_visit_allowed', label: 'Recusa visita', icon: '🚫', class: 'as-btn-risk',
              contexts: ["Diz que está fora", "Exige pagamento prévio", "Incontactável"],
              description: 'Não permite visita presencial antes de pagamento. NUNCA pague sem ver!' },
            { tab: 'risk', signal: 'votes_off_platform', label: 'Só por WhatsApp', icon: '📞', class: 'as-btn-warning',
              description: 'Insiste em falar fora da plataforma para evitar monitorização.' },
            
            // ========== SINAIS DE RISCO - ANÚNCIO ==========
            { tab: 'risk', signal: 'votes_too_cheap', label: 'Preço bom demais', icon: '🤷', class: 'as-btn-risk',
              description: 'Preço muito abaixo do mercado. Se parece bom demais, provavelmente é burla.' },
            { tab: 'risk', signal: 'votes_ai_photos', label: 'Fotos IA/Stock', icon: '🤖', class: 'as-btn-warning',
              description: 'Imagens parecem de IA, catálogo ou outro anúncio. PSP alerta para uso de IA.' },
            { tab: 'risk', signal: 'votes_vague_location', label: 'Morada vaga', icon: '📍', class: 'as-btn-warning',
              description: 'Não indica localização exata. Imóvel pode não existir.' },
            { tab: 'risk', signal: 'votes_cloned_listing', label: 'Anúncio copiado', icon: '📋', class: 'as-btn-risk',
              description: 'Já vi este anúncio noutro site ou com preço diferente.' },
            { tab: 'risk', signal: 'votes_poor_description', label: 'Descrição fraca', icon: '📝', class: 'as-btn-neutral',
              description: 'Pouca informação, texto genérico. Pode não conhecer o imóvel.' },
            
            // ========== SINAIS DE RISCO - COMPORTAMENTO ==========
            { tab: 'risk', signal: 'votes_pressure', label: 'Cria urgência', icon: '⏱️', class: 'as-btn-warning',
              description: '"Muitos interessados!", "Decida já!". Tática de pressão.' },
            { tab: 'risk', signal: 'votes_evasive', label: 'Evita perguntas', icon: '⏳', class: 'as-btn-warning',
              description: 'Não responde diretamente ou desvia assuntos.' },
            { tab: 'risk', signal: 'votes_targets_foreigners', label: 'Visa estrangeiros', icon: '✈️', class: 'as-btn-warning',
              description: 'Foca em quem não pode visitar (estudantes, trabalhadores estrangeiros).' },
            { tab: 'risk', signal: 'votes_new_profile', label: 'Perfil novo', icon: '🌱', class: 'as-btn-neutral',
              description: 'Conta criada recentemente, sem histórico.' },
            { tab: 'risk', signal: 'votes_property_different', label: 'Imóvel diferente', icon: '🏚️', class: 'as-btn-risk',
              description: 'Visitei e não corresponde às fotos, ou já está ocupado.' },

            // ========== SINAIS POSITIVOS ==========
            { tab: 'positive', signal: 'votes_visit_done', label: 'Visitei pessoalmente', icon: '🏠', class: 'as-btn-positive',
              description: 'Fiz visita presencial e corresponde ao anunciado.' },
            { tab: 'positive', signal: 'votes_docs_ok', label: 'Vi documentos', icon: '📄', class: 'as-btn-positive',
              description: 'Caderneta predial, contrato ou prova de propriedade.' },
            { tab: 'positive', signal: 'votes_owner_real', label: 'Dono confirmado', icon: '✅', class: 'as-btn-positive',
              description: 'Confirmei que é o proprietário ou agente autorizado.' },
            { tab: 'positive', signal: 'votes_location_matches', label: 'Local correto', icon: '📍', class: 'as-btn-positive',
              description: 'Morada existe e imóvel corresponde às fotos.' },
            { tab: 'positive', signal: 'votes_real_photos', label: 'Fotos originais', icon: '🖼️', class: 'as-btn-positive',
              description: 'Fotos reais do imóvel, não de catálogo.' },
            { tab: 'positive', signal: 'votes_old_profile', label: 'Perfil experiente', icon: '🏅', class: 'as-btn-positive',
              description: 'Conta antiga com histórico ou avaliações positivas.' },
            { tab: 'positive', signal: 'votes_clear_process', label: 'Processo claro', icon: '🤝', class: 'as-btn-positive',
              description: 'Comunicação transparente, contrato formal, sem pressão.' },
            { tab: 'positive', signal: 'votes_responsive', label: 'Responde bem', icon: '📩', class: 'as-btn-positive',
              description: 'Respostas rápidas, claras e profissionais.' }
        ],
        olx: [
             // ========== SINAIS DE RISCO (Baseado em padrões reais de burla PT) ==========
             // Financeiros
             { tab: 'risk', signal: 'votes_mbway_scam', label: 'Pagamento via MBWay', icon: '💸', class: 'as-btn-risk',
               contexts: ["Pediu código SMS", "Pediu ida ao Multibanco", "Simulou pagamento"],
               description: 'O vendedor/comprador solicitou o uso de MBWay de forma atípica, como gerar referências ou associar números externos.' },
             { tab: 'risk', signal: 'votes_fake_proof', label: 'Comprovativo Atípico', icon: '📧', class: 'as-btn-risk',
               description: 'Recebeu um registo de pagamento que requer confirmação de veracidade junto da entidade bancária.' },
             { tab: 'risk', signal: 'votes_sms_code', label: 'Pediu Código SMS', icon: '🔐', class: 'as-btn-risk',
               description: 'Pediram um código que recebeu por SMS. NUNCA partilhe códigos - podem roubar a sua conta WhatsApp ou banco.' },
             
             // Comportamentais
             { tab: 'risk', signal: 'votes_foreign_shipping', label: 'Envio p/ Estrangeiro', icon: '🌍', class: 'as-btn-risk',
               description: 'Insiste em enviar o artigo para fora de Portugal. Comum em burlas porque dificulta recuperar o dinheiro.' },
             { tab: 'risk', signal: 'votes_pressure', label: 'Muita Pressa', icon: '⏩', class: 'as-btn-warning',
               description: 'Cria urgência artificial: "Pago já!", "Preciso urgente!", "Último dia!". Tática para não pensar bem.' },
             { tab: 'risk', signal: 'votes_bad_portuguese', label: 'Português Estranho', icon: '🤖', class: 'as-btn-warning',
               description: 'Mensagens com erros de tradução automática ou frases estranhas. Pode indicar burlão estrangeiro.' },
             { tab: 'risk', signal: 'votes_suspicious_link', label: 'Enviou Link', icon: '🔗', class: 'as-btn-risk',
               description: 'Enviou um link para um site externo. Pode ser phishing ou página falsa de pagamento.' },
             { tab: 'risk', signal: 'votes_cloned_ad', label: 'Anúncio Clonado', icon: '📋', class: 'as-btn-risk',
               description: 'Este anúncio parece copiado de outro. Burlões clonam anúncios reais para enganar compradores.' },
             { tab: 'risk', signal: 'votes_address_fishing', label: 'Solicitação de Morada', icon: '📍', class: 'as-btn-warning',
               description: 'O vendedor solicitou a morada completa ou dados sensíveis precocemente.' },
             { tab: 'risk', signal: 'votes_no_response', label: 'Sem Resposta', icon: '👁️', class: 'as-btn-neutral',
               description: 'O anunciante não respondeu às suas mensagens ou desapareceu após contacto inicial.' },
             
             // ========== SINAIS POSITIVOS ==========
             { tab: 'positive', signal: 'votes_hand_delivery', label: 'Entrega em Mão OK', icon: '🤝', class: 'as-btn-positive',
               description: 'O vendedor aceitou encontro presencial para troca. Sinal positivo de legitimidade.' },
             { tab: 'positive', signal: 'votes_mail_ok', label: 'Envio Correio OK', icon: '📦', class: 'as-btn-positive',
               description: 'Recebi o artigo por CTT/correio e corresponde ao anunciado. Envio seguro comprovado.' },
             { tab: 'positive', signal: 'votes_clear_communication', label: 'Comunicação Clara', icon: '📩', class: 'as-btn-positive',
               description: 'Respondeu de forma rápida, clara e profissional. Sem pressão ou comportamento estranho.' },
             { tab: 'positive', signal: 'votes_product_ok', label: 'Produto Conforme', icon: '✅', class: 'as-btn-positive',
               description: 'O artigo corresponde à descrição e fotos do anúncio. Transação concluída com sucesso.' },
             { tab: 'positive', signal: 'votes_trusted_seller', label: 'Vendedor Experiente', icon: '🏅', class: 'as-btn-positive',
               description: 'Conta antiga com histórico de vendas ou avaliações positivas.' },
             { tab: 'positive', signal: 'votes_docs_shown', label: 'Mostrou Documentos', icon: '📄', class: 'as-btn-positive',
               description: 'Apresentou faturas, garantias ou certificados do artigo. Aumenta confiança.' }
        ],
        teemo: [
             // Teemo: Similar ao Default
             { tab: 'risk', signal: 'votes_fake_item', label: 'Propriedade Falsa', icon: '🚫', class: 'as-btn-risk' },
             { tab: 'risk', signal: 'votes_advance_payment', label: 'Sinal sem Visita', icon: '💸', class: 'as-btn-risk' },
             { tab: 'risk', signal: 'votes_unrealistic_price', label: 'Renda Irreal', icon: '🤷', class: 'as-btn-warning' },
             
             { tab: 'positive', signal: 'votes_visit_available', label: 'Aceita Visita', icon: '🏠', class: 'as-btn-positive' },
             { tab: 'positive', signal: 'votes_docs_shown', label: 'Senhorio Verificado', icon: '📄', class: 'as-btn-positive' }
        ],
        standvirtual: [
             // ========== SINAIS DE RISCO - VEÍCULOS USADOS (Dados PSP/Standvirtual 2024) ==========
             // Financeiros
             { tab: 'risk', signal: 'votes_deposit_before_see', label: 'Pede sinal s/ ver', icon: '💸', class: 'as-btn-risk',
               description: 'Exige depósito ou sinal ANTES de ver o carro. NUNCA pague sem inspecionar pessoalmente!' },
             { tab: 'risk', signal: 'votes_fake_payment_proof', label: 'Comprovativo falso', icon: '📧', class: 'as-btn-risk',
               description: 'Mostrou comprovativo de transferência/pagamento que parece falso. Espere confirmação do banco.' },
             { tab: 'risk', signal: 'votes_abroad_car', label: 'Artigo no Estrangeiro', icon: '✈️', class: 'as-btn-risk',
               description: 'O anunciante indica que o artigo se encontra fora do país exigindo pagamento antecipado. Padrão de risco identificado.' },
             
             // Legitimidade
             { tab: 'risk', signal: 'votes_cloned_ad', label: 'Anúncio clonado', icon: '📋', class: 'as-btn-risk',
               description: 'Já vi este anúncio com outro preço ou noutro site. Burlões copiam anúncios reais (PSP alerta).' },
             { tab: 'risk', signal: 'votes_too_cheap', label: 'Preço bom demais', icon: '🤷', class: 'as-btn-risk',
               description: 'Preço muito abaixo do mercado para o modelo/ano. Se parece bom demais, é burla.' },
             { tab: 'risk', signal: 'votes_only_whatsapp', label: 'Só comunica WhatsApp', icon: '📞', class: 'as-btn-warning',
               description: 'Recusa usar chat da plataforma. Burlões evitam rastreio usando WhatsApp.' },
             
             // Estado do Veículo
             { tab: 'risk', signal: 'votes_km_suspect', label: 'Km parecem adulterados', icon: '🔢', class: 'as-btn-warning',
               description: 'Quilometragem suspeita (muito baixa para idade, desgaste não corresponde).' },
             { tab: 'risk', signal: 'votes_accident_hidden', label: 'Sinistro oculto', icon: '💥', class: 'as-btn-risk',
               description: 'Sinais de acidente que o vendedor não mencionou (pintura, painéis, estrutura).' },
             { tab: 'risk', signal: 'votes_debts_hidden', label: 'Penhora/dívida oculta', icon: '⚖️', class: 'as-btn-risk',
               description: 'O carro pode ter penhoras, dívidas ou reserva de propriedade não declarada.' },
             { tab: 'risk', signal: 'votes_no_test_drive', label: 'Recusa test drive', icon: '🚫', class: 'as-btn-warning',
               description: 'Não permite test drive ou inspecção por mecânico. O que esconde?' },
             { tab: 'risk', signal: 'votes_docs_incomplete', label: 'Documentos incompletos', icon: '📝', class: 'as-btn-warning',
               description: 'Falta DUA, IPO, ou outros documentos importantes. Pode haver problemas legais.' },
             
             // Comportamento
             { tab: 'risk', signal: 'votes_pressure_sale', label: 'Pressiona venda', icon: '⏱️', class: 'as-btn-warning',
               description: '"Tenho outro interessado!", "É agora ou nunca!". Tática para não pesquisar.' },
             { tab: 'risk', signal: 'votes_evasive', label: 'Evita perguntas', icon: '⏳', class: 'as-btn-warning',
               description: 'Não responde a perguntas sobre historial, mecânica ou documentação.' },
             { tab: 'risk', signal: 'votes_new_profile', label: 'Perfil novo', icon: '🌱', class: 'as-btn-neutral',
               description: 'Conta criada recentemente, sem histórico de vendas.' },
             
             // ========== SINAIS POSITIVOS ==========
             { tab: 'positive', signal: 'votes_saw_car', label: 'Vi pessoalmente', icon: '👁️', class: 'as-btn-positive',
               description: 'Inspeccionei o carro e corresponde ao anunciado.' },
             { tab: 'positive', signal: 'votes_test_drive_ok', label: 'Test drive OK', icon: '🚗', class: 'as-btn-positive',
               description: 'Fiz test drive, mecânica parece em ordem.' },
             { tab: 'positive', signal: 'votes_mechanic_check', label: 'Mecânico aprovou', icon: '🔧', class: 'as-btn-positive',
               description: 'Levei a um mecânico de confiança e passou a inspecção.' },
             { tab: 'positive', signal: 'votes_docs_complete', label: 'Documentos OK', icon: '📄', class: 'as-btn-positive',
               description: 'DUA, IPO, e toda a documentação em ordem. Chassis confere.' },
             { tab: 'positive', signal: 'votes_history_clear', label: 'Historial limpo', icon: '📊', class: 'as-btn-positive',
               description: 'Verifiquei historial: sem acidentes graves, serviços em dia.' },
             { tab: 'positive', signal: 'votes_real_owner', label: 'Dono confirmado', icon: '✅', class: 'as-btn-positive',
               description: 'Confirmei que é o proprietário no DUA ou procuração válida.' },
             { tab: 'positive', signal: 'votes_trusted_stand', label: 'Stand conhecido', icon: '🏅', class: 'as-btn-positive',
               description: 'Stand com loja física, NIF verificável, boas avaliações.' },
             { tab: 'positive', signal: 'votes_fair_price', label: 'Preço justo', icon: '💰', class: 'as-btn-positive',
               description: 'Preço dentro do mercado para o modelo, ano e estado.' }
        ],
        facebook: [
             // ========== SINAIS DE RISCO - FACEBOOK MARKETPLACE (2024) ==========
             { tab: 'risk', signal: 'votes_fake_courier', label: 'Estafeta Falso', icon: '🚚', class: 'as-btn-risk',
               description: 'Comprador diz que envia estafeta (CTT/UPS/GLS) recolher e pede seguro/MBWay. FALSO!' },
             { tab: 'risk', signal: 'votes_mbway_scam', label: 'Burla MBWay', icon: '🏧', class: 'as-btn-risk',
               description: 'Pede para ir ao Multibanco ou associar nº de telemóvel à conta. Golpistas limpam a conta.' },
             { tab: 'risk', signal: 'votes_phishing', label: 'Link Phishing', icon: '🎣', class: 'as-btn-risk',
               description: 'Envia links estranhos para "receber pagamento" ou "ver fotos". Rouba dados bancários.' },
             { tab: 'risk', signal: 'votes_fake_profile', label: 'Perfil Fantasma', icon: '👻', class: 'as-btn-risk',
               description: 'Perfil criado este ano, sem amigos, fotos roubadas ou localização estranha.' },
             { tab: 'risk', signal: 'votes_sold_item', label: 'Já Vendido', icon: '📦', class: 'as-btn-neutral',
               description: 'Vendedor diz que já vendeu mas mantém anúncio ativo (iscard).' },
             { tab: 'risk', signal: 'votes_pressure', label: 'Pressão', icon: '⏱️', class: 'as-btn-warning',
               description: '"Tenho muita gente interessada", força decisão rápida.' },

             // Positivos
             { tab: 'positive', signal: 'votes_legit_profile', label: 'Perfil Real', icon: '👤', class: 'as-btn-positive',
               description: 'Conta antiga, atividade visível, amigos reais.' },
             { tab: 'positive', signal: 'votes_hand_delivery', label: 'Entrega em Mão', icon: '🤝', class: 'as-btn-positive',
               description: 'Aceita encontro presencial em local público e seguro.' },
             { tab: 'positive', signal: 'votes_communication', label: 'Comunicação Boa', icon: '💬', class: 'as-btn-positive',
               description: 'Português correto, respostas claras, sem scripts.' }
        ],
        chinashops: [
             // ========== TEMU & SHEIN (User-Centric) ==========
             { tab: 'risk', signal: 'votes_bad_quality', label: 'Má Qualidade', icon: '🧵', class: 'as-btn-risk',
               description: 'Tecido fino, transparente, costuras fracas. Nada a ver com a foto.' },
             { tab: 'risk', signal: 'votes_wrong_size', label: 'Tamanho Errado', icon: '📏', class: 'as-btn-risk',
               description: 'Tamanhos muito pequenos (ex: XL que serve a S) ou medidas erradas.' },
             { tab: 'risk', signal: 'votes_fake_photo', label: 'Foto Falsa', icon: '📸', class: 'as-btn-risk',
               description: 'A foto é de estúdio/marca famosa, o produto é uma cópia barata.' },
             { tab: 'risk', signal: 'votes_fake_promo', label: 'Promo Falsa', icon: '💸', class: 'as-btn-warning',
               description: 'Preço original inflacionado para fingir desconto de 90%. Gamificação abusiva.' },
             { tab: 'risk', signal: 'votes_never_arrived', label: 'Nunca Chegou', icon: '📦', class: 'as-btn-risk',
               description: 'Encomenda perdida, ficou na alfândega ou suporte não resolve.' },
             { tab: 'risk', signal: 'votes_hard_return', label: 'Devolução Difícil', icon: '🔄', class: 'as-btn-neutral',
               description: 'Custos de devolução superiores ao valor do artigo ou processo complexo.' },

             // Positivos
             { tab: 'positive', signal: 'votes_good_quality', label: 'Boa Qualidade', icon: '✨', class: 'as-btn-positive',
               description: 'O material surpreendeu pela positiva, corresponde ao preço.' },
             { tab: 'positive', signal: 'votes_true_size', label: 'Tamanho Real', icon: '✅', class: 'as-btn-positive',
               description: 'Medidas correspondem à tabela de tamanhos.' },
             { tab: 'positive', signal: 'votes_fast_shipping', label: 'Chegou Rápido', icon: '🚀', class: 'as-btn-positive',
               description: 'Entrega antes do prazo previsto.' }
        ],
        chinashops: [
             // ========== TEMU & SHEIN (User-Centric) ==========
             { tab: 'risk', signal: 'votes_bad_quality', label: 'Má Qualidade', icon: '🧵', class: 'as-btn-risk',
               description: 'Tecido fino, transparente, costuras fracas. Nada a ver com a foto.' },
             { tab: 'risk', signal: 'votes_wrong_size', label: 'Tamanho Errado', icon: '📏', class: 'as-btn-risk',
               description: 'Tamanhos muito pequenos (ex: XL que serve a S) ou medidas erradas.' },
             { tab: 'risk', signal: 'votes_fake_photo', label: 'Foto Falsa', icon: '📸', class: 'as-btn-risk',
               description: 'A foto é de estúdio/marca famosa, o produto é uma cópia barata.' },
             { tab: 'risk', signal: 'votes_fake_promo', label: 'Promo Falsa', icon: '💸', class: 'as-btn-warning',
               description: 'Preço original inflacionado para fingir desconto de 90%. Gamificação abusiva.' },
             { tab: 'risk', signal: 'votes_never_arrived', label: 'Nunca Chegou', icon: '📦', class: 'as-btn-risk',
               description: 'Encomenda perdida, ficou na alfândega ou suporte não resolve.' },
             { tab: 'risk', signal: 'votes_hard_return', label: 'Devolução Difícil', icon: '🔄', class: 'as-btn-neutral',
               description: 'Custos de devolução superiores ao valor do artigo ou processo complexo.' },

             // Positivos
             { tab: 'positive', signal: 'votes_good_quality', label: 'Boa Qualidade', icon: '✨', class: 'as-btn-positive',
               description: 'O material surpreendeu pela positiva, corresponde ao preço.' },
             { tab: 'positive', signal: 'votes_true_size', label: 'Tamanho Real', icon: '✅', class: 'as-btn-positive',
               description: 'Medidas correspondem à tabela de tamanhos.' },
             { tab: 'positive', signal: 'votes_fast_shipping', label: 'Chegou Rápido', icon: '🚀', class: 'as-btn-positive',
               description: 'Entrega antes do prazo previsto.' }
        ]
    },

    // Configurações de seletores por domínio
    siteConfigs: [
        {
            name: 'temu-detail',
            // Detalhe: Temu URLs têm 'goods_id' ou padrão '-g-' seguido de numeros
            check: () => window.location.hostname.includes('temu.') && (window.location.href.includes('goods_id') || /g-\d+/.test(window.location.href) || document.querySelector('[id="goods_price"]')),
            selectors: {
                container: 'body', // Scanner global
                title: 'h1, div[class*="good-name"], [class*="goods-title"]', 
                price: '[id="goods_price"], div[class*="price-banner"] span', 
                insertTarget: '[id="goods_price"]', // Target preciso
                insertPosition: 'append' // Inserir DENTRO (para ficar colado ao texto no flex)
            },
            getId: (node) => window.location.href.split('?')[0],
            isDetailPage: true,
            buttonsKey: 'chinashops'
        },
        {
            name: 'shein-detail',
            // Detalhe: Shein URLs têm /p- (product) ou padrão específico
            check: () => window.location.hostname.includes('shein.') && (window.location.href.includes('/p-') || document.querySelector('.productPriceContainer')),
            selectors: {
                container: 'body',
                title: 'h1, .product-intro__head-name', 
                price: '.bsc-price-elem, .productPriceContainer, div[class*="price"]', 
                insertTarget: '.bsc-price-elem', // Elemento do preço específico (não o container flex)
                insertPosition: 'afterend' // Inserir DEPOIS do preço, não dentro do container
            },
            getId: (node) => window.location.href.split('?')[0],
            isDetailPage: true,
            buttonsKey: 'chinashops'
        },
        {
            name: 'aliexpress-detail',
            // Detalhe: AliExpress URLs têm /item/ seguido de ID
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
            // Lista: Qualquer aliexpress que não seja detalhe
            check: () => window.location.hostname.includes('aliexpress.') && !window.location.pathname.includes('/item/'),
            selectors: {
                // Seletores baseados nos prints (mf_cz, 18_ib, etc.)
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
                // Seletores agressivos para Temu (Atualizado V2)
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
                // Seletores agressivos para Shein
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
            // Usa getter para aceder ao template (this.buttonTemplates não estaria acessível fácil aqui sem bind, 
            // então vamos definir 'buttons' string e resolver depois ou hardcode references)
            buttonsKey: 'default'
        },
        // Idealista e Imovirtual (RESTAURADO)
        {
            name: 'idealista-detail',
            check: () => window.location.hostname.includes('idealista.pt') && window.location.pathname.includes('/imovel/'),
            selectors: {
                container: 'main', 
                title: 'h1, span.main-info__title-main',
                price: 'span.info-data-price, span.txt-bold',
                description: '.comment, .adCommentsLanguage',
                views: '#stats .stats-info b, .ad-views',
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
                views: '.item-stats, [data-testid="ad-views"]',
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
                views: '[data-cy="adPageAdStats"], span[data-testid="ad-views"]',
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
            name: 'standvirtual-detail',
            // Check mais permissivo: URL tem /anuncio/ OU existe um container de preço típico de detalhe
            check: () => (window.location.hostname.includes('standvirtual.')) && 
                        (window.location.pathname.includes('/anuncio/') || document.querySelector('[data-testid="ad-price-container"], .offer-price__number')),
            selectors: {
                container: 'div#root, main, body', // Container genérico para garantir match
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
            // Check: é standvirtual e NÃO é detalhe
            check: () => window.location.hostname.includes('standvirtual.') && !window.location.pathname.includes('/anuncio/'),
            selectors: {
                // Seletores ABRANGENTES para Homepage, Destaques e Listas de Motos/Barcos
                // Seletores UNIVERSAIS para Standvirtual (Listas, Grids, Destaques, Motos, Barcos)
                container: 'article, div[data-testid="listing-ad"], div[class*="offer-item"], div[data-testid="main-page-promoted-ad"], div[class*="promoted-ad"], li[data-testid*="ad-"], div.oa-item, div[class*="ooa-"][data-testid="search-results"] > div, article[class*="ooa-"], a[href*="/anuncio/"]:not([class*="reference"]), div[class*="grid-item"]', 
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
        },
        {
            name: 'olx-detail',
            // Suporte Global: Aceita olx.pt, olx.br, olx.pl, olx.ro, etc.
            check: () => window.location.hostname.includes('olx.') && window.location.pathname.includes('/d/'),
            selectors: {
                container: '#root, #__next, div[class*="main"], main, [class*="AdPage"], body', 
                title: '[data-cy="ad_title"], [data-testid="ad_title"], [class*="title"], h1', 
                price: '[data-testid="ad-price-container"] h3, [data-testid="ad-price-container"], [data-testid="ad-price"], [class*="price-container"] h3, [class*="PriceContainer"] h3, h3', 
                description: 'div[data-cy="ad_description"], [data-testid="ad-description"], [class*="description"]',
                views: 'span[data-testid="ad-views"], .css-17it79k, [class*="views"]', 
                insertTarget: '[data-testid="ad-price-container"], [data-testid="ad-price"], [class*="price-container"], [class*="PriceContainer"], h1',
                insertPosition: 'afterend'
            },
            getId: (node) => window.location.href.split('?')[0], 
            isDetailPage: true,
            buttonsKey: 'olx'
        },
        {
            name: 'olx',
            // Suporte Global: Qualquer olx.* que NÃO seja detalhe (/d/anuncio ou /d/...)
            // Nota: Alguns OLX usam /d/ para tudo, o detail check acima deve capturar primeiro se for mais específico
            check: () => window.location.hostname.includes('olx.') && !window.location.pathname.includes('/d/anuncio/'),
            selectors: {
                // Cards de listagem do OLX (React Global)
                container: '[data-cy="l-card"], [data-testid="l-card"], [data-testid="listing-ad"], li[data-testid="listing-ad"], div[class*="ad-card"]', 
                // Títulos globais + Parceiros (Standvirtual, Imovirtual)
                title: 'h6, h2, h4, a[href*="/d/"], a[href*="/ads/"], a[href*="standvirtual"], a[href*="imovirtual"], [class*="title"]', 
                price: '[data-testid="ad-price"], .price, [class*="price"]',
                insertTarget: '[data-testid="ad-price"], .price, [class*="price"]', 
                insertPosition: 'afterend'
            },
            getId: (node) => {
                const link = node.querySelector('a');
                return link ? link.href.split('.html')[0] : null;
            },
            isDetailPage: false,
            buttonsKey: 'olx'
        },
        {
            name: 'teemo',
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
    ],

    currentConfig: null,

    init() {
        console.log('[Anti-Scam] Init chamado. URL atual:', window.location.href);
        console.log('[Anti-Scam] ✅ v5.0 - VERSÃO CORRIGIDA CARREGADA');

        // CONFIGURAÇÃO MONOLÍTICA (Sem módulos externos)
        // Apenas usa o array local siteConfigs
        
        // Detecta qual site estamos
        this.currentConfig = this.siteConfigs.find(config => config.check());

        if (!this.currentConfig) {
             console.warn('[Anti-Scam] Nenhum site configurado detectado para esta URL.');
             // Tenta forçar Imovirtual Detail se parecer um anúncio mas o check falhou
             if (window.location.hostname.includes('imovirtual.com') && document.querySelector('.css-7r17ig')) {
                 console.log('[Anti-Scam] Forçando config imovirtual-detail por deteção de elemento CSS');
                 this.currentConfig = this.siteConfigs.find(c => c.name === 'imovirtual-detail');
             }
        }
        if (this.currentConfig) {
            console.log(`[Anti-Scam] Site detectado e ATIVO: ${this.currentConfig.name}`);
            
            // Resolve buttons config
            this.currentConfig.buttons = this.buttonTemplates[this.currentConfig.buttonsKey || 'default'];

            // Inicia observação do DOM IMEDIATAMENTE (mesmo sem body ainda)
            this.observeDOM();

            // Inicia módulos
            if (window.BotDetector) window.BotDetector.init();
            
            // Scanner inicial imediato (se o body já existir)
            if (document.body) {
                console.log('[Anti-Scam] Iniciando Scanner Global...');
                this.runScanner();
            }
            
            // Páginas de detalhe precisam de mais tentativas (conteúdo dinâmico)
            if (this.currentConfig.isDetailPage) {
                setTimeout(() => this.runScanner(), 100);
                setTimeout(() => this.runScanner(), 300);
                setTimeout(() => this.runScanner(), 600);
            } else {
                // Listagem: menos tentativas
                setTimeout(() => this.runScanner(), 100);
            }

            // Se estamos numa página de detalhe, inicia tracking comportamental
            if (this.currentConfig.isDetailPage) {
                this.initBehaviorTracking();
            }

            // NOVO: Scanning periódico para lojas chinesas (SPA agressivas)
            const chinashopsNames = ['temu', 'temu-detail', 'shein', 'shein-detail', 'aliexpress', 'aliexpress-detail'];
            if (chinashopsNames.includes(this.currentConfig.name)) {
                console.log('[Anti-Scam] Ativando Interval Scanner para SPA:', this.currentConfig.name);
                setInterval(() => {
                    this.runScanner();
                }, 2000);
            }
        }
    },

    initBehaviorTracking() {
        // Função placeholder para evitar erros. O BehaviorTracker deve ser iniciado por anúncio no processAd se desejado.
        // Anteriormente causava erro "BehaviorTracker.init is not a function"
        if (window.BehaviorTracker) {
            console.log('[Anti-Scam] Módulo BehaviorTracker carregado.');
        }
    },

    runScanner() {
        if (!this.currentConfig) return;
        const selector = this.currentConfig.selectors.container;
        const nodes = document.querySelectorAll(selector);
        
        // Debug: Log para saber se estamos a encontrar items
        // if (this.currentConfig.name.includes('olx')) {
        //      console.log(`[Anti-Scam SCANNER] (${this.currentConfig.name}) Procurando por: ${selector}`);
        //      console.log(`[Anti-Scam SCANNER] (${this.currentConfig.name}) Items encontrados: ${nodes.length}`);
             
        //      // Diagnóstico EXTRA para detalhe se falhar
        //      if (this.currentConfig.name === 'olx-detail' && nodes.length === 0) {
        //          console.warn('[Anti-Scam SCANNER] ALERTA: Container #root não encontrado no detalhe OLX!');
        //      }
        // }

        if (nodes.length === 0) {
            // FALLBACK: Se o seletor principal falhou, tenta o scanner heurístico (Temu/Shein)
            if (this.runHeuristicScanner) {
                this.runHeuristicScanner();
            }
        }

        nodes.forEach(node => {
            this.processAd(node, this.currentConfig);
        });
    },

    observeDOM() {
        // Debounce scanner 
        let timeout;
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            
            for (const mutation of mutations) {
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
                timeout = setTimeout(() => {
                    this.runScanner();
                    this.runHeuristicScanner();
                    this.runLinkScanner(); // Link Scanner também no observer
                }, 150);
            }
        });

        observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
        });
    },

    // Novo Método V3: Scanner baseado em Links (Mais robusto para AliExpress/Temu)
    runLinkScanner() {
        if (!this.currentConfig) return;
        const isAli = this.currentConfig.name.includes('aliexpress');
        const isTemu = this.currentConfig.name.includes('temu');
        const isShein = this.currentConfig.name.includes('shein');

        if (!isAli && !isTemu && !isShein) return;

        // console.log('[Anti-Scam] Running Link Scanner V3...');
        
        // Define padrão de link
        let linkSelector = '';
        if (isAli) linkSelector = 'a[href*="/item/"]';
        else if (isTemu) linkSelector = 'a[href*="goods_id"], a[href*="g-"]';
        else if (isShein) linkSelector = 'a[href*="/p-"], a[href*=".html"]';

        const links = document.querySelectorAll(linkSelector);

        links.forEach(link => {
            // Evita processar links já tratados ou muito pequenos/invisíveis
            if (link.dataset.asLinkProcessed) return;
            if (link.offsetWidth < 20 || link.offsetHeight < 20) return;

            // Sobe para encontrar o container do produto
            // Geralmente é um LI, ou DIV com classe de 'item' ou 'card'
            let container = link.closest('div[class*="item"], div[class*="card"], li, div[class*="product"]');
            
            // Fallback: sobe alguns niveis se não achar classe obvia
            if (!container) {
                let current = link.parentElement;
                let depth = 0;
                while (current && depth < 5) {
                    if (current.querySelector('img') && current.innerText.length > 20) {
                        container = current;
                        break;
                    }
                    current = current.parentElement;
                    depth++;
                }
            }

            if (container && !container.dataset.asProcessed) {
                // ANTI-DUPLICADOS: Verifica se já existe badge VISUALMENTE
                if (container.querySelector('.as-badge-container')) {
                    container.dataset.asProcessed = "true";
                    return;
                }

                // Procura preço DENTRO do container
                // Regex: Procura simbolo de moeda ou digitos seguidos de moeda
                const priceRegex = /[\€\$\£\¥]|eur|usd|brl|\d+[\.,]\d{2}/i;
                
                // Função helper para encontrar nodo de texto de preço
                const findPriceNode = (root) => {
                    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
                    let node;
                    while(node = walker.nextNode()) {
                        if (priceRegex.test(node.textContent) && node.textContent.length < 30) {
                            return node.parentElement; // Retorna o elemento pai do texto
                        }
                    }
                    return null;
                };

                const priceNode = findPriceNode(container);

                if (priceNode) {
                    // console.log('[Anti-Scam] LinkScanner achou produto:', container);
                    link.dataset.asLinkProcessed = "true";
                    container.dataset.asProcessed = "true";

                    // Extrai ID
                    let uniqueId = link.href.split('?')[0];
                    
                    // Extrai Título
                    let title = "Produto Detectado";
                    const titleEl = container.querySelector('h1, h3, .title, [class*="title"], [class*="name"]');
                    if (titleEl) title = titleEl.innerText.trim();

                    // Prepara Callback
                    const onBadgeClick = (e) => {
                        if (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                        }
                        console.log('[Anti-Scam] Click no LinkShield V3. Abrindo:', uniqueId);
                        this.openShield(uniqueId, { 
                            title: title, 
                            price: priceNode.innerText, 
                            link: link.href 
                        }, e ? e.currentTarget : null); // Passa o alvo (badge)
                    };

                    // Cria e insere Badge
                    // Score 85 = Verde (Safe)
                    const heuristicData = { risk_score: 85, quality_score: 0 };
                    const badge = UIModule.createBadge(heuristicData, onBadgeClick);
                    
                    // Inserção inteligente
                    priceNode.parentNode.insertBefore(badge, priceNode.nextSibling);
                }
            }
        });
    },

    // Novo Método V2: Scanner Heurístico (Reverse Lookup por Preço)
    runHeuristicScanner() {
        // AliExpress removido daqui para usar apenas o LinkScanner (V3) e evitar conflitos
        if (!this.currentConfig || !['temu', 'shein', 'facebook-marketplace'].includes(this.currentConfig.name)) return;

        // console.log('[Anti-Scam] Executando Heuristic Scanner (Busca por Preço)...');
        
        // 1. Encontrar elementos com Preço
        // XPath para encontrar texto contendo € ou eur 
        const currencySymbols = ['€', 'EUR', 'R$', 'zł'];
        
        // Procura profunda em todos os elementos visíveis
        const allElements = document.body.querySelectorAll('span, div, p, strong, b');
        
        allElements.forEach(el => {
             if (el.dataset.asProcessed) return; // Já processado
             
             const text = el.innerText;
             if (!text) return;
             
             // Verifica se tem símbolo de moeda E números
             const hasCurrency = currencySymbols.some(s => text.includes(s));
             const hasNumber = /\d/.test(text); // Contém números (ignora espaços)
             
             if (hasCurrency && hasNumber && text.length < 25) { 
                  // É um potencial preço! Vamos subir para achar o container
                  this.findContainerFromPrice(el);
             }
        });
    },

    findContainerFromPrice(priceNode) {
        let current = priceNode.parentElement;
        let depth = 0;
        const maxDepth = 12; // Aumentado para 12 níveis

        while (current && depth < maxDepth) {
            const hasLink = current.tagName === 'A' || current.querySelector('a');
            const hasImage = current.querySelector('img');
            const hasTooltipData = current.hasAttribute('data-tooltip-title') || current.querySelector('[data-tooltip-title]');
            
            // Verifica se não é o próprio body ou main container gigante
            const isTooBig = current.offsetHeight > 1000 && current.offsetWidth > 800; 

            // Se tem imagem E (link OU tooltip OU classes indicativas), é um bom candidato
            if (hasImage && (hasLink || hasTooltipData) && !isTooBig) {
                 if (!current.dataset.asProcessed) {
                     // console.log('[Anti-Scam] Heuristic Scanner (V2) encontrou container:', current);
                     
                     current.dataset.asProcessed = 'true';
                     
                     // Extrai ID 
                     let itemId = 'item_' + Math.random().toString(36).substr(2, 9);
                     const link = current.tagName === 'A' ? current : current.querySelector('a');
                     if (link && link.href) itemId = link.href.split('?')[0];

                     // Título 
                     let title = "Produto Detectado";
                     const tooltipNode = current.getAttribute('data-tooltip-title') ? current : current.querySelector('[data-tooltip-title]');
                     if (tooltipNode) title = tooltipNode.getAttribute('data-tooltip-title');
                     else {
                         const potentialTitle = current.querySelector('h3, h2, a[title], div[class*="name"], [class*="title"], [class*="desc"]'); // Adicionado 'desc'
                         if (potentialTitle) title = potentialTitle.innerText;
                     }

                     // Callback corrigido com contexto
                     const onBadgeClick = (e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         console.log('[Anti-Scam] Click no escudo heurístico. Abrindo:', itemId);
                         this.openShield(itemId, { title: title, price: priceNode.innerText, link: link ? link.href : window.location.href });
                     };

                     // Cria Badge (heuristicamente score neutro 50)
                     // Score 85 = Verde (Safe) para não assustar o user em itens novos/desconhecidos
                     const heuristicData = { risk_score: 85, quality_score: 0 }; 
                     const badge = UIModule.createBadge(heuristicData, onBadgeClick); // Cria o elemento badge

                     // Inserir badge PERTO DO PREÇO
                     if (priceNode.parentNode) {
                        // Tenta inserir after
                        priceNode.parentNode.insertBefore(badge, priceNode.nextSibling);
                     }
                     return;
                 }
            }
            current = current.parentElement;
            depth++;
            depth++;
        }
    },

    async openShield(uniqueId, initialDetails = {}, targetElement = null) {
        // Recupera dados ou cria novos
        let adData = await StorageModule.getAdData(uniqueId);
        
        if (!adData) {
            console.log('[Anti-Scam] Criando dados iniciais para item Heurístico:', uniqueId);
            adData = {
                risk_score: 85, // Verde inicial (Safe)
                quality_score: 0,
                votes: {},
                community_signals: { total_votes: 0 },
                scanned_at: Date.now(),
                url: initialDetails.link || window.location.href,
                title: initialDetails.title || 'Produto Detectado',
                price: initialDetails.price || 'N/A',
                seller: 'Vendedor AliExpress'
            };
            await StorageModule.updateAdData(uniqueId, adData);
        }

        const tooltipOptions = {
            buttons: this.buttonTemplates['chinashops'] || [], // Força template chinashops
            onReport: async (signalType, delta = 1) => {
                // Lógica de report igual ao processAd (simplificada aqui para brevidade, idealmente refatorar)
                // Para agora, apenas logs
                console.log('Report via Heuristic Shield:', signalType);
            }
        };

        // Re-bind do onReport completo se necessário, ou usar lógica centralizada
        // Por simplicidade, vou copiar a lógica de update do processAd para garantir funcionalidade total
        tooltipOptions.onReport = async (signalType, delta = 1, context = null) => {
             if (!adData.community_signals) adData.community_signals = {};
             
             // Atualiza sinais
             adData.community_signals[signalType] = (adData.community_signals[signalType] || 0) + (delta * 1); // Weighted (Legado, será float se houver peso)
             
             // Novos campos explícitos
             const rawField = `${signalType}_raw`;
             const weightedField = `${signalType}_weighted`;
             adData.community_signals[rawField] = (adData.community_signals[rawField] || 0) + delta;
             adData.community_signals[weightedField] = (adData.community_signals[weightedField] || 0) + (delta * 1); // Em heurística peso é 1
             
             if (adData.community_signals[rawField] < 0) adData.community_signals[rawField] = 0;
             if (adData.community_signals[weightedField] < 0) adData.community_signals[weightedField] = 0;

             // Regista Contexto (Step 5)
             if (context) {
                 if (!adData.context_stats) adData.context_stats = {};
                 if (!adData.context_stats[signalType]) adData.context_stats[signalType] = {};
                 adData.context_stats[signalType][context] = (adData.context_stats[signalType][context] || 0) + delta;
             }

             // Atualiza total (EXCETO likes/dislikes - estes não devem diluir percentagens)
             if (!['votes_like', 'votes_dislike'].includes(signalType)) {
                 adData.community_signals.total_votes_raw = (adData.community_signals.total_votes_raw || 0) + delta;
                 adData.community_signals.total_votes_weighted = (adData.community_signals.total_votes_weighted || 0) + (delta * 1);
                 
                 // Fallback total_votes (Legado)
                 adData.community_signals.total_votes = adData.community_signals.total_votes_weighted;

                 if (adData.community_signals.total_votes_raw < 0) adData.community_signals.total_votes_raw = 0;
                 if (adData.community_signals.total_votes_weighted < 0) adData.community_signals.total_votes_weighted = 0;
             }

             // Salva e Atualiza UI
             await StorageModule.updateAdData(uniqueId, adData);
             UIModule.showTooltip(adData, targetElement, tooltipOptions, uniqueId, true);
        };

        // Abre Tooltip PASSANDO O TARGET
        UIModule.showTooltip(adData, targetElement, tooltipOptions, uniqueId);
    },

    async processAd(node, siteConfig) {
        if (node.dataset.asProcessed) return;
        
        // ANTI-DUPLICADOS: Para páginas de detalhe, só injetamos UMA VEZ no documento inteiro
        if (siteConfig.isDetailPage) {
            if (window._asShieldInjected) {
                 return;
            }
        }

        const selectors = siteConfig.selectors;
        let titleEl = node.querySelector(selectors.title);
        let priceEl = node.querySelector(selectors.price);
        
        // DEBUG: Log para Sites Problemáticos 
        if (siteConfig.name.includes('standvirtual')) {
           console.log(`[Anti-Scam DEBUG ${siteConfig.name}] Processando container:`, node);
           console.log(`[Anti-Scam DEBUG ${siteConfig.name}] Título encontrado:`, titleEl ? titleEl.innerText : 'NÃO ENCONTRADO');
           console.log(`[Anti-Scam DEBUG ${siteConfig.name}] Preço encontrado:`, priceEl ? priceEl.innerText : 'NÃO ENCONTRADO');
        }
        
        // REGEX MOEDAS GLOBAIS (Euro, Dólar, Libra, Real, Zloty, Lei, etc.)
        const currencyRegex = /[€$£]|R\$|zł|lei/i;

        // HEURÍSTICA DE PREÇO APRIMORADA (Fallback)
        if (!priceEl) {
             // Se for página de detalhe (qualquer site), usa busca profunda
             if (siteConfig.isDetailPage) {
                 // No detalhe, procura especificamente por elementos de preço
                 const candidates = Array.from(document.querySelectorAll('span, strong, h1, h2, h3, div[class*="css"], [data-testid="ad-price-container"], .offer-price__number'));
                 priceEl = candidates.find(el => {
                     const txt = el.innerText;
                     return txt && currencyRegex.test(txt) && /\d/.test(txt) && txt.length < 30 && !txt.includes('desde');
                 });
                 if (priceEl && (window.location.hostname.includes('imovirtual') || window.location.hostname.includes('olx') || window.location.hostname.includes('standvirtual'))) {
                    console.log(`[Anti-Scam DEBUG] Preço recuperado via fallback textual (Detalhe):`, priceEl.innerText);
                 }
             } else {
                 // Fallback para listagens 
                 const candidates = node.querySelectorAll('.price, span, strong, p, div[class*="price"], [data-testid="ad-price"]');
                 for (const el of candidates) {
                     if (el.innerText && currencyRegex.test(el.innerText) && el.innerText.length < 20) {
                         priceEl = el;
                         console.log(`[Anti-Scam DEBUG] Preço encontrado via fallback (Listagem):`, priceEl.innerText);
                         break;
                     }
                 }
             }
        }

        if (!titleEl || !priceEl) {
            // Fallbacks extremos
            if (siteConfig.name === 'imovirtual-detail') {
                 if (!titleEl && document.title) {
                     titleEl = { innerText: document.title.split('|')[0].trim() };
                     console.log('[Anti-Scam] Usando document.title como fallback:', titleEl.innerText);
                 }
                 if (!priceEl) {
                     priceEl = { innerText: 'N/A' };
                     console.log('[Anti-Scam] Usando preço placeholder N/A para forçar render');
                 }
            } else if ((siteConfig.name.includes('olx') || siteConfig.name.includes('standvirtual')) && !titleEl && priceEl) { 
                 // Fallback GLOBAL para OLX/Stand (Lista e Detalhe): Se temos preço mas não título
                 // Usa o hostname para ser internacionalmente correto e SOFRENEUTRO
                 titleEl = { innerText: `${window.location.hostname} Offer` };
                 console.log(`[Anti-Scam] ${siteConfig.name}: Usando título fallback internacional`);
            } else {            
                if (window.location.hostname.includes('imovirtual') || window.location.hostname.includes('olx') || window.location.hostname.includes('standvirtual')) {
                     // console.warn('[Anti-Scam] Falha ao encontrar Title ou Price no container', node);
                }
                return;
            }
        }
        
        node.dataset.asProcessed = "true";

        const title = titleEl.innerText.trim();
        const price = priceEl.innerText ? priceEl.innerText.trim() : 'N/A';
        
        // Extrai descrição se disponível
        const descEl = selectors.description ? node.querySelector(selectors.description) : null;
        const description = descEl ? descEl.innerText.trim() : '';

        // Extrai métricas nativas (Views/Saves)
        let nativeViews = 0;
        let nativeSaves = 0;

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
            if (siteConfig.name === 'demo-site' && price.includes('45.000')) {
                adData.score = 20;
            }
        }
        
        // Atualiza Sinais Nativos
        if (!adData.native_signals) adData.native_signals = { views: 0, saves: 0 };
        adData.native_signals.views = nativeViews;
        adData.native_signals.saves = nativeSaves;

        // Análise estrutural
        if (window.AdAnalyzer) {
            const adAnalysis = window.AdAnalyzer.analyze({
                title,
                description,
                price,
                photoCount: node.querySelectorAll('img').length
            });

            adData.ad_signals = {
                text_length: description.length,
                photo_count: adAnalysis.signals.photoCount,
                price_is_round: adAnalysis.signals.priceIsRound,
                text_quality: adAnalysis.signals.textQuality,
                suspicious_keywords: adAnalysis.signals.suspiciousKeywords,
                score_adjustment: adAnalysis.scoreAdjustment
            };
        }

        // Simula sync
        adData = StorageModule.syncWithServer(adData);

        // Guarda dados atualizados
        adData = await StorageModule.updateAdData(uniqueId, adData);

        // Renderiza UI
        this.injectUI(node, selectors, adData, uniqueId);
    },
    injectUI(containerNode, selectors, data, hash) {
        let targetEl = containerNode.querySelector(selectors.insertTarget);
        
        // Fallback especial para Imovirtual Detail
        if (this.currentConfig.name === 'imovirtual-detail' && !targetEl) {
             // Tenta encontrar o link do mapa por texto se a classe/href falhar
             const mapLink = Array.from(containerNode.querySelectorAll('a')).find(el => el.textContent.includes('Ver no mapa'));
             if (mapLink) targetEl = mapLink;
        }
        
        // Fallback genérico (Standvirtual/OLX) se target principal falhar
        if (!targetEl && this.currentConfig.isDetailPage) {
             console.warn('[Anti-Scam] Target específico falhou. Usando fallback H1 ou Container.');
             targetEl = containerNode.querySelector('h1') || containerNode;
             if (targetEl === containerNode) selectors.insertPosition = 'prepend';
        }

        // Fallback especial para OLX Detail (procura H3 com preço)
        if (this.currentConfig.name === 'olx-detail') {
             // Tenta melhorar o target se for muito genérico ou não existir
             if (!targetEl || targetEl.innerText.length > 50) { // Evita pegar h3 errados
                 const h3s = Array.from(document.querySelectorAll('h3'));
                 const priceH3 = h3s.find(el => el.innerText.includes('€') && /\d/.test(el.innerText) && el.innerText.length < 30);
                 if (priceH3) {
                     targetEl = priceH3;
                     console.log('[Anti-Scam] OLX: H3 de preço encontrado via texto:', targetEl);
                 }
             }
        }

        // Fallback padrão
        if (!targetEl) targetEl = containerNode.querySelector(selectors.title);
        
        if (!targetEl) return;

        // Remove badge existente se houver (para update)
        const existingContainer = containerNode.querySelector('.as-badge-container');
        if (existingContainer) existingContainer.remove();

        const badgeContainer = UIModule.createBadge(data, (e) => {
            const tooltipOptions = {
                buttons: this.currentConfig.buttons || [],
                voteQueue: Promise.resolve(),
                onReport: async (signalType, delta = 1, context = null) => {
                    // Lock/Queue para evitar race conditions em cliques rápidos
                    tooltipOptions.voteQueue = tooltipOptions.voteQueue.then(async () => {
                        // 1. Obter Peso (BotDetector + TrustManager)
                        let weight = 1.0;
                        if (window.BotDetector) {
                            weight *= window.BotDetector.getWeightMultiplier(); // Comportamento
                            weight *= window.BotDetector.getSignalBaseWeight(signalType); // Importância do Sinal
                        }
                        if (window.TrustManager) {
                            weight *= window.TrustManager.getTrustWeight(); // Reputação Histórica
                        }
                        
                        // 2. Regista Ação Positiva se for remoção
                        if (delta < 0 && window.TrustManager) {
                            window.TrustManager.recordAction('correction');
                        }
                    
                    // CRÍTICO: Buscar dados FRESCOS do storage (não usar 'data' estático)
                    let freshData = await StorageModule.getAdData(hash);
                    if (!freshData) {
                        freshData = StorageModule.createDefaultEntry();
                    }
                    
                    // Atualiza sinais da comunidade (nos dados frescos)
                    if (!freshData.community_signals) freshData.community_signals = {
                        total_votes_raw: 0,
                        total_votes_weighted: 0,
                        total_votes: 0
                    };
                    
                    const rawField = `${signalType}_raw`;
                    const weightedField = `${signalType}_weighted`;
                    
                    // Incremento RAW (Sempre 1 ou -1)
                    freshData.community_signals[rawField] = (freshData.community_signals[rawField] || 0) + delta;
                    if (freshData.community_signals[rawField] < 0) freshData.community_signals[rawField] = 0;
                    
                    // Incremento WEIGHTED (delta * weight)
                    freshData.community_signals[weightedField] = (freshData.community_signals[weightedField] || 0) + (delta * weight);
                    if (freshData.community_signals[weightedField] < 0) freshData.community_signals[weightedField] = 0;
                    
                    // Compatibilidade Legada (Misto)
                    // Para Likes/Dislikes, usamos SEMPRE o valor bruto (1 voto = 1 utilizador)
                    if (['votes_like', 'votes_dislike'].includes(signalType)) {
                        freshData.community_signals[signalType] = freshData.community_signals[rawField];
                    } else {
                        freshData.community_signals[signalType] = freshData.community_signals[weightedField];
                    }

                    // Regista Contexto (Step 5)
                    if (context) {
                        if (!freshData.context_stats) freshData.context_stats = {};
                        if (!freshData.context_stats[signalType]) freshData.context_stats[signalType] = {};
                        freshData.context_stats[signalType][context] = (freshData.context_stats[signalType][context] || 0) + (delta * weight);
                    }

                    // Atualiza totais (EXCETO likes/dislikes)
                    if (!['votes_like', 'votes_dislike'].includes(signalType)) {
                        freshData.community_signals.total_votes_raw = (freshData.community_signals.total_votes_raw || 0) + delta;
                        freshData.community_signals.total_votes_weighted = (freshData.community_signals.total_votes_weighted || 0) + (delta * weight);
                        
                        freshData.community_signals.total_votes = freshData.community_signals.total_votes_weighted;

                        if (freshData.community_signals.total_votes_raw < 0) freshData.community_signals.total_votes_raw = 0;
                        if (freshData.community_signals.total_votes_weighted < 0) freshData.community_signals.total_votes_weighted = 0;
                    }

                    // Atualiza contagem de participantes únicos (Heurística: 1º voto registado do user)
                    const userVotes = window.BotDetector ? window.BotDetector.getUserVoteCount(hash) : 0;
                    // Se userVotes == 1, significa que é o primeiro report deste user neste anúncio
                    if (userVotes === 1 && delta > 0) {
                         freshData.community_signals.users_count = (freshData.community_signals.users_count || 0) + 1;
                    }

                    // ATUALIZAÇÃO: Regista interação no BotDetector para gerir contador e limites
                    if (window.BotDetector && !['votes_like', 'votes_dislike'].includes(signalType)) {
                        window.BotDetector.registerVoteChange(hash, delta, signalType);
                    }
                    
                    const newData = await StorageModule.updateAdData(hash, freshData);
                    
                    // UPDATE TOOLTIP (se estiver aberto)
                    if (UIModule.activeTooltip) {
                        UIModule.showTooltip(newData, null, tooltipOptions, hash, true);
                    }
                    
                        // Atualiza Badge (re-inject)
                        this.injectUI(containerNode, selectors, newData, hash); 
                    });
                }
            };

            // Passa o hash para UI verificar cooldowns
            UIModule.showTooltip(data, badgeContainer, tooltipOptions, hash);
        });

        // Posicionamento com Logs
        try {
            // console.log('[Anti-Scam] Tentando inserir Shield no target:', targetEl);
            if (selectors.insertPosition === 'append') {
                targetEl.appendChild(badgeContainer);
            } else if (selectors.insertPosition === 'prepend') {
                targetEl.prepend(badgeContainer);
            } else {
                targetEl.parentNode.insertBefore(badgeContainer, targetEl.nextSibling);
            }
            // Marca que o escudo foi injetado nesta página de detalhe
            if (this.currentConfig.isDetailPage) {
                window._asShieldInjected = true;
            }
            // console.log('[Anti-Scam] SUCESSO: Escudo injetado visualmente.');
        } catch (err) {
            console.error('[Anti-Scam] ERRO CRÍTICO ao injetar no DOM:', err);
        }
        
        // Remove bordas de debug se existirem (limpeza visual)
        containerNode.style.border = '';
        containerNode.style.borderRadius = '';
        
        /* CÓDIGO ANTIGO DE DEBUG VISUAL REMOVIDO
        if (data.risk_score < 30) { ... } 
        */
    }
};

// === LISTENERS GLOBAIS ===

// Detecção ROBUSTA de mudança de página (SPA navigation)
// 1. Monkey Patch do History API
const patchHistoryMethod = (type) => {
    const original = history[type];
    return function() {
        const result = original.apply(this, arguments);
        const event = new Event(type);
        event.arguments = arguments;
        window.dispatchEvent(event);
        return result;
    };
};

history.pushState = patchHistoryMethod('pushState');
history.replaceState = patchHistoryMethod('replaceState');

// 2. Listeners para todos os tipos de navegação
const handleUrlChange = () => {
    const url = location.href;
    console.log('[Anti-Scam] Navegação detectada (Evento):', url);
    
    // Reseta flag anti-duplicados para permitir novo escudo na nova página
    window._asShieldInjected = false;
    
    // Scans rápidos e agressivos para melhor responsividade
    App.init(); // Imediato
    setTimeout(() => App.init(), 100);  // Rápido
    setTimeout(() => App.init(), 300);  // Médio
    setTimeout(() => App.init(), 800);  // Lento (para SPAs pesados)
};

window.addEventListener('pushState', handleUrlChange);
window.addEventListener('replaceState', handleUrlChange);
window.addEventListener('popstate', handleUrlChange);

// 3. Fallback: Polling (Verificação a cada 1s)
// "Cinto e suspensórios" para garantir que nunca falha
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        console.log('[Anti-Scam] Navegação detectada (Polling):', location.href);
        lastUrl = location.href;
        App.init();
    }
}, 1000);

// Inicialização IMEDIATA (para document_start)
App.init();

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

        alert('Anti-Scam: Memória limpa com sucesso.\nO página será recarregada.');
        window.location.reload();
    }
});

// Expose for debugging
window.AntiScamApp = App;
