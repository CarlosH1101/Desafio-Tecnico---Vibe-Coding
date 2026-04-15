# PROMPTS.md

## Registro Técnico de Prompts

Este documento resume, de forma objetiva, como usei IA para acelerar a entrega do desafio de análise de sentimento em arquitetura de microsserviços. A ideia não foi só “gerar código”, mas usar os prompts para direcionar decisões técnicas, resolver incidentes reais de integração e manter o sistema funcional mesmo sob instabilidade externa.

## 1. Estrutura Inicial do Projeto

Comecei definindo uma separação clara de responsabilidades entre os serviços para evitar acoplamento precoce e facilitar debug.

### Prompt principal

> "Estruture um projeto Node.js com dois serviços independentes: servico-a (sender) e servico-b (processor), cada um com seu próprio package.json, index.js e suporte a variáveis de ambiente via .env."

### Resultado técnico

- Base organizada em duas aplicações isoladas.
- Dependências desacopladas.
- Fluxo pronto para evolução incremental.

## 2. Implementação do Serviço B (Processor)

A segunda etapa foi construir o endpoint de análise com integração ao Gemini, padronizando o retorno para consumo pelo Serviço A.

### Prompt principal

> "Gere o index.js do Serviço B em Node.js com Express. Crie o endpoint POST /analyze que receba um texto, consulte o Gemini usando GEMINI_API_KEY e retorne JSON com o sentimento identificado."

### Resultado técnico

- Endpoint `/analyze` funcional.
- Integração com IA encapsulada no serviço de processamento.
- Contrato de resposta JSON definido para integração.

## 3. Implementação do Serviço A (Sender)

Depois, foquei no cliente/orquestrador para enviar texto ao Processor e tratar falhas sem travar execução.

### Prompt principal

> "Gere o index.js do Serviço A em Node.js usando axios e dotenv. Envie texto para http://localhost:3001/analyze. Se receber JSON válido, exiba 'Análise concluída: [SENTIMENTO]'. Se o Serviço B estiver fora do ar, trate o erro com mensagem clara."

### Resultado técnico

- Chamada HTTP padronizada do A para o B.
- Tratamento explícito de indisponibilidade.
- Mensagens de erro objetivas para operação local.

## 4. Hardening de Validação e Histórico

Com o fluxo básico pronto, adicionei validações de entrada e persistência de rastreabilidade para facilitar auditoria e troubleshooting.

### Prompt principal

> "Adicione validação no Serviço B: campo text obrigatório, sem conteúdo vazio e limite de 500 caracteres. Em caso de erro, retorne 400 com mensagem clara."

### Prompt complementar

> "Salve cada requisição e resposta no history.json usando fs/promises, incluindo timestamp, texto_original e sentimento, com tratamento para arquivo inexistente e JSON corrompido."

### Resultado técnico

- Proteção contra payload inválido/abusivo.
- Histórico persistente de execução.
- Robustez em cenários de arquivo ausente ou corrompido.

## 5. Debug de Integração com Gemini (404)

Na etapa seguinte, enfrentei o maior bloqueio: erro 404 recorrente na chamada de modelo. O trabalho aqui foi iterativo, com prompts orientados para diagnóstico e simplificação.

### Prompt principal

> "O erro 404 persiste. Refatore a inicialização para usar o padrão oficial do SDK @google/generative-ai, com getGenerativeModel({ model: '...' }) e sem configuração manual de apiVersion beta."

### Prompt de diagnóstico

> "Adicione log da resposta bruta do Gemini e um try/catch específico na extração para identificar exatamente qual parte da resposta está faltando."

### Resultado técnico

- Inicialização estabilizada no padrão oficial do SDK.
- Melhoria de observabilidade no ponto crítico de extração da resposta.
- Redução do ruído de hipóteses durante o debug.

## 6. Resiliência para Rate Limit (429)

Depois de resolver o fluxo principal, apareceu a limitação de cota da API. A decisão foi priorizar continuidade do sistema para avaliação, sem depender 100% da disponibilidade externa.

### Prompt principal

> "Atingi erro 429 no Gemini. Implemente fallback local para que o Serviço B retorne uma análise temporária em JSON, garantindo que o Serviço A nunca quebre."

### Prompt de compatibilidade

> "O Serviço A ainda reporta JSON inválido. Ajuste o fallback para responder sempre com Content-Type application/json e payload consistente."

### Resultado técnico

- Fallback local ativado para cenários de cota excedida.
- Contrato de resposta preservado mesmo em degradação.
- Continuidade operacional entre os serviços.

Nota: Durante a fase de testes intensivos, implementei um status específico de API_LIMIT_REACHED para monitorar o estouro de cota do Tier Gratuito do Gemini, garantindo que o sistema identifique gargalos de infraestrutura externa.

## 7. Refinamento Final para Entrega

Na reta final, priorizei limpeza do código e previsibilidade dos logs para deixar o comportamento fácil de validar por terceiros.

### Prompt principal

> "Remova logs de debug desnecessários, mantenha logs essenciais de status/erro, organize a identação e adicione comentários curtos explicando o fallback."

### Resultado técnico

- Código mais legível e objetivo.
- Menos ruído no terminal.
- Base pronta para avaliação técnica.

## Conclusão

O uso de prompts foi tratado como ferramenta de engenharia, não como atalho cego. Cada iteração foi guiada por sintomas reais (404, 429, parse de resposta, contrato JSON), até chegar em um MVP funcional, resiliente e com comportamento previsível entre microsserviços.

Em resumo, os prompts aceleraram implementação, debug e documentação sem perder controle técnico sobre arquitetura, tratamento de erro e qualidade de entrega.
