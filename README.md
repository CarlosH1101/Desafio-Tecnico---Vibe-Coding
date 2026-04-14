# Desafio Técnico: Vibe Coding - Análise de Sentimento

## Arquitetura

O projeto está dividido em dois serviços independentes:

- **Serviço A (Sender)**: cliente em Node.js responsável por enviar um texto para análise.
- **Serviço B (Processor)**: API em Node.js que recebe o texto em `POST /analyze`, consulta o Gemini e retorna o sentimento em JSON.

Fluxo: **Serviço A -> Serviço B -> Gemini -> Serviço B -> Serviço A**.

## Instalação

Instale as dependências em **ambas** as pastas:

```bash
cd servico-a
npm install
```

```bash
cd servico-b
npm install
```

## Configuração

No **Serviço B**, configure o arquivo de ambiente:

1. Renomeie `servico-b/.env.example` para `servico-b/.env`.
2. Preencha a chave do Gemini no arquivo `.env`:

```env
GEMINI_API_KEY=sua_chave_aqui
PORT=3001
```

## Execução

Execute os dois serviços simultaneamente em terminais separados.

Terminal 1 (Processor):

```bash
cd servico-b
node index.js
```

Terminal 2 (Sender):

```bash
cd servico-a
node index.js
```

Se tudo estiver correto, o Serviço A exibirá a análise recebida do Serviço B.
