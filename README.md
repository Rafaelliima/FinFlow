# Finflow — Controle Financeiro Pessoal

Sistema de controle financeiro pessoal que usa **Google Sheets como banco de dados** e um frontend HTML puro, sem dependências de servidor. Tudo roda no seu navegador, e os dados ficam na sua própria planilha Google.

---

## O que é

Uma aplicação web de página única (SPA) que se comunica com uma planilha Google Sheets via Google Apps Script. Você hospeda o HTML onde quiser — GitHub Pages, servidor local, qualquer lugar — e os dados ficam 100% na sua conta Google.

---

## Funcionalidades

- **Dashboard** com KPIs do mês atual, gráficos por categoria e forma de pagamento, fluxo dos últimos 6 meses e últimas saídas
- **Saídas** — lançamentos do dia a dia com suporte a compras no crédito parcelado (campos de cartão e parcelas aparecem automaticamente ao selecionar "Crédito")
- **Entradas** — receitas e depósitos com controle de recorrência
- **Parcelas Fixas** — acompanhamento de progresso (ex: 3/12 parcelas pagas)
- **Assinaturas** — serviços recorrentes com controle de status e vencimento
- Busca e filtragem em todas as telas
- Edição e exclusão de qualquer registro

---

## Estrutura

```
finflow/
├── finflow-app.html         # Frontend completo (HTML + CSS + JS em um arquivo)
└── codigo-apps-script.gs    # Backend Google Apps Script
```

---

## Como configurar

### 1. Criar o backend no Google Apps Script

1. Abra sua planilha em [Google Sheets](https://sheets.google.com)
2. No menu: **Extensões → Apps Script**
3. Apague o código padrão e cole o conteúdo de `codigo-apps-script.gs`
4. Salve com `Ctrl+S`
5. Clique em **Implantar → Novo deployment**
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
6. Clique em **Implantar** e autorize as permissões
7. Copie a URL gerada — ela tem o formato:
   ```
   https://script.google.com/macros/s/SEU_ID/exec
   ```

### 2. Hospedar o frontend

Você tem algumas opções:

**GitHub Pages (recomendado)**
1. Crie um repositório no GitHub
2. Faça upload do `finflow-app.html` renomeado para `index.html`
3. Vá em **Settings → Pages → Branch: main → Save**
4. Acesse em `https://seuusuario.github.io/seu-repositorio`

**Servidor local com Python**
```bash
python -m http.server 8080
# Acesse: http://localhost:8080/finflow-app.html
```

**VS Code com Live Server**
Clique com botão direito no arquivo → **Open with Live Server**

### 3. Conectar

1. Abra o app no navegador
2. Cole a URL do Apps Script no campo do menu lateral
3. Clique em **⚙ Configurar planilha**
4. As abas serão criadas automaticamente na sua planilha
5. Status deve mudar para **● conectado**

---

## Abas criadas na planilha

| Aba | Campos principais |
|-----|------------------|
| Saídas | Data, Descrição, Categoria, Valor, Forma Pagamento, Cartão, Parcelas |
| Entradas | Data, Descrição, Fonte, Valor, Recorrente |
| Parcelas | Descrição, Valor Parcela, Total Parcelas, Parcela Atual, Cartão, Status |
| Assinaturas | Serviço, Valor, Ciclo, Cartão, Próximo Vencimento, Status |

---

## Arquitetura

```
Navegador (finflow-app.html)
        │
        ├── GET via JSONP ──────────► Google Apps Script (/exec)
        │   (leitura de dados)               │
        │                                    ▼
        └── POST via fetch ──────────► Google Sheets
            (escrita de dados)         (suas abas de dados)
```

Leituras usam **JSONP** para contornar restrições de CORS ao abrir o arquivo localmente. Escritas usam **fetch com redirect:follow**, que o Apps Script aceita cross-origin.

---

## Tecnologias

- HTML, CSS e JavaScript puros — sem framework
- [Chart.js](https://www.chartjs.org/) para os gráficos
- [Google Apps Script](https://developers.google.com/apps-script) como API/backend
- Google Sheets como banco de dados
- Fontes: [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) + [Geist Mono](https://fonts.google.com/specimen/Geist+Mono)

---

## Observações

- Os dados ficam exclusivamente na sua conta Google — nenhum servidor externo é utilizado
- Toda vez que o código do Apps Script for alterado, é necessário criar um **novo deployment** (nova versão) para as mudanças entrarem em vigor
- O campo da URL do Apps Script é salvo no `localStorage` do navegador
