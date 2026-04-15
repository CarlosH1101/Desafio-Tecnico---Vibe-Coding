# Desafio Técnico: Vibe Coding - Análise de Sentimento

## Descrição

Sistema de análise de sentimento construído com arquitetura de microsserviços e integração com Google Gemini AI.

A solução separa responsabilidades entre um serviço de orquestração de requisições e um serviço dedicado ao processamento de IA, com foco em robustez operacional e tratamento de falhas.

## Arquitetura

O projeto está dividido em dois serviços independentes:

- **Serviço A (Node.js/Express)**: atua como orquestrador. Envia texto para análise, recebe a resposta do Serviço B e exibe o resultado final.
- **Serviço B (Node.js/Express)**: atua como integrador de IA. Recebe o texto, consulta o Google Gemini, valida entradas, trata erros e retorna o sentimento.

Fluxo principal:

`Serviço A -> Serviço B -> Gemini -> Serviço B -> Serviço A`

## Destaque Técnico

Foi implementada uma estratégia de **resiliência com Fallback Local** no Serviço B.

Quando a API Gemini retorna **Rate Limit (429)**, o serviço responde com uma análise local temporária em vez de falhar. Isso garante continuidade de operação para o Serviço A e evita indisponibilidade do sistema durante limitação de cota.

### Sobre a Resiliência do Sistema

Durante o desenvolvimento, identifiquei que o modelo `gemini-2.0-flash` (único disponível para o tier free em 2026) possui limites de cota rigorosos. Por isso, projetei o Serviço B com um sistema de Análise Heurística Local.

Se você rodar o projeto e vir o sufixo `(HEURÍSTICA)` nos logs, significa que o sistema detectou o limite de cota da API e acionou a lógica local para não interromper o serviço. Isso garante disponibilidade de 100% para o Serviço A.

## Como Rodar

### 1) Pré-requisitos

- Node.js 18+
- npm

### 2) Instalação

Instale as dependências em cada serviço:

```bash
cd servico-a
npm install
```

```bash
cd ../servico-b
npm install
```

### 3) Configuração de ambiente

No Serviço B, crie o arquivo `.env` a partir de `.env.example` e configure a chave do Gemini:

```env
GEMINI_API_KEY=sua_chave_google_gemini
PORT=3001
```

Opcionalmente, no Serviço A você pode definir:

```env
SERVICE_B_URL=http://localhost:3001/analyze
TEXT_TO_ANALYZE=Este produto é excelente e me deixou muito satisfeito.
```

### 4) Execução

Execute os dois serviços em terminais separados.

Terminal 1 - Serviço B:

```bash
cd servico-b
node index.js
```

Terminal 2 - Serviço A:

```bash
cd servico-a
node index.js
```

Resultado esperado no Serviço A:

`Análise concluída: [SENTIMENTO]`

## Tecnologias

- Node.js
- Express
- Axios
- Google Generative AI SDK (`@google/generative-ai`)
