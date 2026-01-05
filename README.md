# Anti-Scam Imobiliário 🛡️

**Versão:** Alpha Test 1 (Privado)

Extensão de browser para detectar e alertar sobre anúncios imobiliários suspeitos.

## Funcionalidades Implementadas ✅

### Core
- **Memória Local** - Armazena scores e sinais no browser (sem enviar dados externos)
- **Sistema de Score** - Pontuação de 0-100 baseada em sinais reportados
- **Detecção de Bots** - Identifica cliques automáticos para evitar manipulação

### UI
- **Badge Discreto** (🛡️) - Aparece ao lado do preço/título
  - 🟢 Verde: Score >= 80 (Seguro)
  - 🟡 Amarelo: Score 40-79 (Atenção)
  - 🔴 Vermelho: Score < 40 (Perigo)
- **Tooltip com Detalhes** - Mostra contadores de sinais
- **4 Tipos de Report**:
  - ❌ Não responde (-5 pontos)
  - 💳 Pagamento suspeito (-15 pontos)
  - 📞 Contacto externo (-10 pontos)
  - 🚨 Parece falso (-20 pontos)

### Portais Suportados
- ✅ **Idealista.pt** (Lista + Página de Detalhes)
- 🔄 Imovirtual (em desenvolvimento)
- 🔄 OLX (em desenvolvimento)

### Popup
- Estatísticas: Total monitorados, Fraudes detectadas
- Histórico dos últimos 10 anúncios visitados

## Instalação (Modo Desenvolvedor)

1. Abrir `chrome://extensions`
2. Ativar "Modo do desenvolvedor"
3. Clicar "Carregar sem compactação"
4. Selecionar pasta `extension/`

## Estrutura do Projeto

```
├── demo_site/          # Site de teste local
│   ├── index.html
│   └── style.css
├── extension/          # Código da extensão
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── modules/
│   │   ├── storage.js
│   │   ├── ui.js
│   │   └── bot_detect.js
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

## Licença

Projeto privado - Alpha Test
