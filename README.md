# Anti-Scam Imobiliário 🛡️

**Versão:** Alpha Test 2 - Comportamental

Extensão de browser para detectar e alertar sobre anúncios imobiliários suspeitos, usando **dados comportamentais passivos** em vez de depender apenas de reports explícitos.

## 🚀 Novidades v2

### Tracking Comportamental Passivo
- ⏱️ **Tempo na página** - Analisa quanto tempo os visitantes ficam
- 📜 **Scroll depth** - Mede % do anúncio visualizado
- 📋 **Cópia de contactos** - Detecta interesse real
- 🔙 **Padrões de hesitação** - Scroll errático e back button

### Análise Estrutural de Anúncios
- 📝 Avalia qualidade do texto (curto/genérico = suspeito)
- 📷 Conta fotografias (< 3 fotos = alerta)
- 💰 Detecta preços redondos (padrão em fraudes)
- ⚠️ Identifica keywords suspeitas ("urgente", "transferência", etc.)

### Sistema Anti-Abuso
- 🛑 Rate limiting (max 5 reports/minuto)
- ⏳ Cooldown de 30s entre reports no mesmo anúncio
- 📉 Peso dinâmico (reports subsequentes pesam menos)
- 🤖 Detecção de bots melhorada

## 📊 Como Funciona o Score

O score é **híbrido** com 3 componentes:

| Componente | Peso | Descrição |
|------------|------|-----------|
| Comportamento | 35% | Dados agregados de visitantes |
| Estrutura | 25% | Análise do próprio anúncio |
| Reports | 40% | Reports explícitos dos utilizadores |

## Funcionalidades Core

### UI
- **Badge Discreto** (🛡️) - Aparece ao lado do preço/título
  - 🟢 Verde: Score >= 80 (Seguro)
  - 🟡 Amarelo: Score 40-79 (Atenção)
  - 🔴 Vermelho: Score < 40 (Perigo) - com animação pulsante
- **Tooltip Semântico** - Explicações em linguagem natural:
  - "73% dos visitantes saíram em <10s"
  - "Descrição muito curta ou genérica"
  - "Termos suspeitos: urgente, transferência"
- **Indicador de Confiança** - Alta/Média/Baixa baseada em dados

### Portais Suportados
- ✅ **Idealista.pt** (Lista + Página de Detalhes)
- 🔄 Imovirtual (em desenvolvimento)
- 🔄 OLX (em desenvolvimento)

## Instalação (Modo Desenvolvedor)

1. Abrir `chrome://extensions`
2. Ativar "Modo do desenvolvedor"
3. Clicar "Carregar sem compactação"
4. Selecionar pasta `extension/`

## Estrutura do Projeto

```
├── demo_site/              # Site de teste local
│   ├── index.html
│   └── style.css
├── extension/              # Código da extensão
│   ├── manifest.json
│   ├── background.js
│   ├── content.js          # Orquestrador principal
│   ├── modules/
│   │   ├── storage.js      # Score híbrido + dados agregados
│   │   ├── ui.js           # Tooltips semânticos
│   │   ├── bot_detect.js   # Anti-abuso + rate limiting
│   │   ├── behavior_tracker.js  # [NOVO] Tracking passivo
│   │   └── ad_analyzer.js       # [NOVO] Análise estrutural
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.js
│   └── styles/
│       └── content.css
└── README.md
```

## Roadmap

- [ ] Exportação de dados (Backup JSON)
- [ ] Backend de partilha anónima
- [ ] Suporte completo Imovirtual/OLX
- [ ] Browser mobile dedicado
- [ ] Clustering de anúncios similares (IA leve)

## Princípio

> **IA sugere, regras governam.**
> Reports explícitos *ajustam*, *confirmam* e *aceleram*.
> Nunca decidem sozinhos.

## Licença

Projeto privado - Alpha Test

