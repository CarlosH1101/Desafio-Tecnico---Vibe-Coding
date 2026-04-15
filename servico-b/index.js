require("dotenv").config();

const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

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
const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ],
});
console.log("Conectado ao modelo Gemini 2.0 Flash");

function normalizeSentiment(rawText) {
  const text = String(rawText || "").toLowerCase();

  if (text.includes("positivo")) return "POSITIVO";
  if (text.includes("negativo")) return "NEGATIVO";
  if (text.includes("neutro")) return "NEUTRO";

  return "INDEFINIDO";
}

function manualSentimentFromText(text) {
  const lower = String(text || "").toLowerCase();

  if (
    lower.includes("bom") ||
    lower.includes("excelente") ||
    lower.includes("feliz")
  ) {
    return "POSITIVO";
  }

  if (
    lower.includes("péssimo") ||
    lower.includes("pessimo") ||
    lower.includes("ruim") ||
    lower.includes("horroroso")
  ) {
    return "NEGATIVO";
  }

  return null;
}

function localAnalysis(text) {
  const positive = ["bom", "excelente", "perfeito", "adorei", "ótimo", "show"];
  const negative = ["péssimo", "ruim", "horrível", "lixo", "não recomendo"];
  const lowerText = String(text || "").toLowerCase();

  if (positive.some((word) => lowerText.includes(word)))
    return "POSITIVO (HEURÍSTICA)";
  if (negative.some((word) => lowerText.includes(word)))
    return "NEGATIVO (HEURÍSTICA)";
  return "NEUTRO (HEURÍSTICA)";
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

  const manualSentiment = manualSentimentFromText(trimmedText);
  if (manualSentiment) {
    void logHistorySafely({
      timestamp: new Date().toISOString(),
      texto_original: trimmedText,
      sentimento: manualSentiment,
      status: "success",
    });

    return res.status(200).json({ sentiment: manualSentiment });
  }

  try {
    const prompt =
      'Instrução: Responda apenas com a palavra POSITIVO, NEGATIVO ou NEUTRO. Analise o sentimento desta frase: "' +
      trimmedText +
      '"';

    console.log("Tentando analisar:", prompt);
    const result = await withTimeout(
      model.generateContent(prompt),
      GEMINI_TIMEOUT_MS,
    );
    let rawResult = "";
    try {
      rawResult = JSON.stringify(result, null, 2);
    } catch (stringifyError) {
      rawResult = `[nao foi possivel serializar result: ${stringifyError?.message || "erro desconhecido"}]`;
    }
    console.log("Resposta Bruta:", rawResult);

    let modelText = "";
    try {
      const response = await result.response;
      if (!response || typeof response.text !== "function") {
        throw new Error(
          `Estrutura inesperada da resposta do Gemini. Campos disponiveis: ${
            Object.keys(result || {}).join(", ") || "(nenhum)"
          }`,
        );
      }

      const rawModelText = response.text();
      if (typeof rawModelText !== "string") {
        throw new Error("Resposta do Gemini sem texto em formato string.");
      }

      modelText = rawModelText.toUpperCase().trim();
      console.log("IA respondeu originalmente:", modelText);
    } catch (extractError) {
      console.error(extractError);
      return res.status(500).json({
        error: `Falha ao extrair texto da resposta do Gemini: ${
          extractError?.message || "estrutura de resposta invalida"
        }`,
      });
    }

    const sentimento = normalizeSentiment(modelText);

    void logHistorySafely({
      timestamp: new Date().toISOString(),
      texto_original: trimmedText,
      sentimento,
      status: "success",
    });

    return res.json({ sentiment: modelText });
  } catch (error) {
    console.error(error);
    const errorMessage = String(error?.message || "").toLowerCase();
    const isRateLimitError =
      error?.status === 429 ||
      error?.code === 429 ||
      errorMessage.includes("429") ||
      errorMessage.includes("resource_exhausted") ||
      errorMessage.includes("rate limit");

    if (isRateLimitError) {
      const heuristicSentiment = localAnalysis(trimmedText);

      void logHistorySafely({
        timestamp: new Date().toISOString(),
        texto_original: trimmedText,
        sentimento: heuristicSentiment,
        status: "fallback_heuristica_429",
      });

      return res.status(200).json({ sentiment: heuristicSentiment });
    }

    // const manualFallback = manualSentimentFromText(trimmedText) || "NEUTRO";
    const googleApiErrorMessage =
      error?.response?.data?.error?.message ||
      error?.errorDetails?.[0]?.message ||
      error?.message ||
      "Erro desconhecido ao consultar a API do Google";

    void logHistorySafely({
      timestamp: new Date().toISOString(),
      texto_original: trimmedText,
      sentimento: null,
      status: "api_error",
    });

    return res.status(500).json({
      error: googleApiErrorMessage,
      details: {
        status: error?.status,
        code: error?.code,
      },
    });
  }
});

app.listen(PORT);
