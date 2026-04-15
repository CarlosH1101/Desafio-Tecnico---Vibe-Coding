require("dotenv").config();

const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash";
const MAX_TEXT_LENGTH = 500;
const GEMINI_TIMEOUT_MS = 10_000;
const HISTORY_FILE_PATH = path.join(__dirname, "history.json");

if (!GEMINI_API_KEY) {
  console.error("Erro: GEMINI_API_KEY nao configurada no .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });
console.log("Conectado ao modelo Gemini 2.0 Flash");

function normalizeSentiment(rawText) {
  const text = String(rawText || "").toLowerCase();

  if (text.includes("positivo")) return "POSITIVO";
  if (text.includes("negativo")) return "NEGATIVO";
  if (text.includes("neutro")) return "NEUTRO";

  return "INDEFINIDO";
}

function isRateLimitError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.status === 429 ||
    error?.code === 429 ||
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted")
  );
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
    }),
  ]);
}

async function appendHistory(entry) {
  let history = [];
  let currentContent = "";

  try {
    currentContent = await fs.readFile(HISTORY_FILE_PATH, "utf-8");
  } catch (readError) {
    if (readError?.code === "ENOENT") {
      await fs.writeFile(HISTORY_FILE_PATH, "[]", "utf-8");
      currentContent = "[]";
    } else {
      throw readError;
    }
  }

  try {
    const parsed =
      currentContent.trim().length > 0 ? JSON.parse(currentContent) : [];
    if (!Array.isArray(parsed)) {
      throw new Error("history.json invalido: esperado um array");
    }
    history = parsed;
  } catch (parseError) {
    if (parseError instanceof SyntaxError) {
      history = [];
      await fs.writeFile(HISTORY_FILE_PATH, "[]", "utf-8");
    } else {
      throw parseError;
    }
  }

  history.push(entry);
  await fs.writeFile(
    HISTORY_FILE_PATH,
    JSON.stringify(history, null, 2),
    "utf-8",
  );
}

async function logHistorySafely(entry) {
  try {
    await appendHistory(entry);
  } catch (fileError) {
    console.error("Erro ao gravar historico:", fileError.message);
  }
}

app.post("/analyze", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const rawText = req.body?.text;
  const requestText = typeof rawText === "string" ? rawText : "";
  const trimmedText = requestText.trim();

  if (!trimmedText) {
    void logHistorySafely({
      timestamp: new Date().toISOString(),
      texto_original: typeof rawText === "string" ? rawText : null,
      sentimento: null,
      status: "validation_error",
    });

    return res
      .status(400)
      .json({ error: "O campo 'text' é obrigatório e não pode estar vazio." });
  }

  if (trimmedText.length > MAX_TEXT_LENGTH) {
    void logHistorySafely({
      timestamp: new Date().toISOString(),
      texto_original: requestText,
      sentimento: null,
      status: "validation_error",
    });

    return res
      .status(400)
      .json({ error: "O campo 'text' deve ter no máximo 500 caracteres." });
  }

  try {
    const prompt =
      "Analise o sentimento do seguinte texto e responda apenas com uma palavra: Positivo, Negativo ou Neutro. Texto: " +
      trimmedText;

    const result = await withTimeout(
      model.generateContent(prompt),
      GEMINI_TIMEOUT_MS,
    );

    let geminiText = "";
    try {
      const response = await result.response;
      if (!response || typeof response.text !== "function") {
        throw new Error(
          `Estrutura inesperada da resposta do Gemini. Campos disponiveis: ${
            Object.keys(result || {}).join(", ") || "(nenhum)"
          }`,
        );
      }

      geminiText = response.text();
    } catch (extractError) {
      console.error(extractError);
      return res.status(500).json({
        error: `Falha ao extrair texto da resposta do Gemini: ${
          extractError?.message || "estrutura de resposta invalida"
        }`,
      });
    }

    const sentimento = normalizeSentiment(geminiText);

    void logHistorySafely({
      timestamp: new Date().toISOString(),
      texto_original: trimmedText,
      sentimento,
      status: "success",
    });

    return res.json({ sentiment: geminiText });
  } catch (error) {
    if (error?.message === "TIMEOUT") {
      return res.status(504).json({ error: "Timeout ao consultar Gemini." });
    }

    // Fallback local temporario quando a API atinge limite de cota.
    if (isRateLimitError(error)) {
      void logHistorySafely({
        timestamp: new Date().toISOString(),
        texto_original: trimmedText,
        sentimento: "NEUTRO",
        status: "success",
      });

      return res.status(200).send({ sentiment: "Neutro (Fallback)" });
    }

    console.error(error);
    return res
      .status(500)
      .json({ error: error?.message || "Erro interno no processo." });
  }
});

app.listen(PORT);
