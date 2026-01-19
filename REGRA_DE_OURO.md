# 🏆 REGRA DE OURO - SCM HUNTERS

**ESTADO DO SISTEMA: ESTÁVEL E VALIDADO (16/01/2026)**

Este documento serve como a instrução suprema para qualquer IA ou desenvolvedor que trabalhe neste projeto. O sistema de votação, matemática de scores e lógica de cooldown foi exaustivamente depurado e está agora no seu estado ideal.

## ⛔ NUNCA ALTERAR (NÚCLEO IMUTÁVEL)

Os seguintes componentes formam o **CÉREBRO** do sistema e não devem ser modificados, refatorados ou simplificados sem ordem direta e explícita do utilizador:

### 1. Lógica de Votação (ui.js / content.js)
- **Fila de Execução (VoteQueue):** O sistema de Promessas (`voteQueue`) que impede "Race Conditions" em cliques rápidos.
- **Prioritização de Ações:** 
    1. Remoção de Voto (Sempre livre).
    2. Resolução de Conflitos (Swaps automáticos).
    3. Verificação de Limites (5 por anúncio).
    4. Adição de Voto + Aplicação de Cooldown.

### 2. Matemática e Contadores (bot_detect.js / trust_manager.js)
- **Centralização:** O `registerVoteChange` é a fonte de verdade para limites de sessão, mas o **PESO** do voto é agora dinâmico e invisível.
- **Factor de Confiança:** Cada clique vale **1 voto × Factor de Confiança (0.6 a 1.4)**. Isto evoluiu para prevenir manipulação e premiar utilizadores consistentes.
- **Cooldown Dinâmico:** A lógica que diferencia botões de Risco (aplicam cooldown) de Sinais/Neutros (não aplicam cooldown).
- **Regra de Ouro dos Likes:** A lógica de **apenas 1 Like ou Dislike por anúncio** (Swap mútuo).

### 3. Persistência de Dados (storage.js)
- **Deep Merge:** A proteção de dados comunais para que novos votos não apaguem os antigos.

## ✅ FLEXIBILIDADE PERMITIDA (SITES)

O que **PODE** e **DEVE** ser alterado conforme a necessidade:
- **Botões específicos por site:** O Standvirtual pode ter botões de "Mecânico Verificou", enquanto o Idealista tem "Dono Confirmado".
- **Seletores CSS:** Ajustes para quando os sites mudam de layout.
- **Cores visuais:** Ajustes estéticos que não afetem a lógica de backend.

---

> **NOTA PARA A IA:** Se o utilizador pedir para "melhorar o sistema de votos", refira-se a este documento. Se a alteração proposta afetar a matemática ou a ordem de execução descrita acima, peça confirmação tripla antes de proceder. Este commit (Janeiro 2026) é o "Salva-Vidas".
