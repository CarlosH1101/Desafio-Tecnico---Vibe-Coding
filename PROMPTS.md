# PROMPTS.md

## Introdução

Este desafio foi desenvolvido com abordagem de **Vibe Coding**, usando IA como copiloto técnico para reduzir tempo de implementação e aumentar consistência entre serviços. A IA foi utilizada para acelerar tarefas de estruturação, geração de código base e refinamento de robustez, enquanto as decisões de arquitetura e critérios de qualidade permaneceram guiados por engenharia.

## Log de Prompts

### 1) Configuração da estrutura do projeto

**Objetivo:** criar uma base simples, separando responsabilidades entre envio e processamento.

**Prompt principal:**

> "Estruture um projeto Node.js com dois serviços independentes: `servico-a` (sender) e `servico-b` (processor). Cada serviço deve ter seu próprio `package.json`, `index.js` e suporte a variáveis de ambiente via `.env`."

**Resultado esperado:**
- Organização em duas pastas independentes.
- Isolamento de dependências por serviço.
- Base pronta para evolução e testes locais.

### 2) Geração do Serviço B (Processor) com integração ao Gemini

**Objetivo:** implementar o endpoint de análise de sentimento usando IA generativa.

**Prompt principal:**

> "Gere o `index.js` do Serviço B em Node.js com Express. Crie o endpoint `POST /analyze` que receba um texto, consulte a API Gemini via `@google/generative-ai` usando `GEMINI_API_KEY` no `.env`, e retorne JSON com o sentimento identificado."

**Resultado esperado:**
- API HTTP funcional para processamento de texto.
- Integração com Gemini encapsulada no Serviço B.
- Retorno padronizado em JSON para consumo do Serviço A.

### 3) Geração do Serviço A (Sender) com foco em erros e resiliência

**Objetivo:** consumir o Serviço B com segurança e evitar falhas em cascata.

**Prompt principal:**

> "Gere o `index.js` do Serviço A em Node.js usando `axios` e `dotenv`. O script deve enviar texto para `http://localhost:3001/analyze`. Se receber JSON de sentimento, exiba `Análise concluída: [SENTIMENTO]`. Se o Serviço B estiver fora do ar, exiba `Erro: Não foi possível conectar ao processador de IA`. Se a resposta não for JSON válido, trate esse erro também."

**Resultado esperado:**
- Cliente simples para envio de requisição ao processador.
- Tratamento explícito de indisponibilidade do Serviço B.
- Tratamento de resposta inválida sem travar execução.

## Tomadas de Decisão

Durante a implementação, priorizamos **Error Handling** como requisito técnico central do MVP. A decisão foi garantir que o Serviço A não travasse quando o Serviço B estivesse offline, degradando de forma controlada com mensagens de erro claras.

Essa escolha aumentou a resiliência do fluxo ponta a ponta e reduziu risco operacional em cenários reais de instabilidade de rede, timeout ou indisponibilidade temporária do processador de IA.

## Conclusão

A colaboração com IA permitiu acelerar as etapas de design e implementação, mantendo foco em qualidade técnica e previsibilidade de comportamento. Como resultado, foi possível entregar um **MVP funcional e resiliente** em tempo recorde, com separação clara de responsabilidades, integração com modelo generativo e tratamento de falhas essenciais para operação confiável.
