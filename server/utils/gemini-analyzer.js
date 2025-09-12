// In server/utils/gemini-analyzer.js

// Import the GoogleGenerativeAI class from '@google/generative-ai'.
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize a new GoogleGenerativeAI instance with the API key from process.env.GEMINI_API_KEY.
const API_KEY = process.env.GEMINI_API_KEY || "";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const genAI = new GoogleGenerativeAI(API_KEY);

// Function to convert a base64 data URL to a GoogleGenerativeAI.Part object.
function fileToGenerativePart(base64Data, mimeType) {
  return {
    inlineData: {
      data: base64Data.split(",")[1], // Extract the actual base64 data
      mimeType,
    },
  };
}

// Internal helper to sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Call Gemini with retries and JSON-mode enabled
async function callWithRetries(
  modelName,
  contents,
  { attempts = 3, baseDelayMs = 500 } = {}
) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        },
      });
      const result = await model.generateContent(contents);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      const msg = (err?.message || "").toLowerCase();
      const isOverloaded = msg.includes("503") || msg.includes("overloaded");
      if (i < attempts - 1 && isOverloaded) {
        const delay =
          baseDelayMs * Math.pow(2, i) + Math.floor(Math.random() * 200);
        await sleep(delay);
        continue;
      }
      break;
    }
  }
  const error = new Error(lastErr?.message || "Gemini request failed");
  if ((lastErr?.message || "").includes("503")) error.status = 503;
  throw error;
}

// Try to coerce non-strict JSON outputs (e.g., markdown code fences or single quotes)
function tryParseJsonFlexible(text) {
  if (!text || typeof text !== "string") return null;
  let t = text.trim();
  // Extract from code fences ```json ... ``` or ``` ... ```
  const fenceIdx = t.indexOf("```");
  if (fenceIdx !== -1) {
    const lastFence = t.lastIndexOf("```");
    if (lastFence > fenceIdx) {
      t = t.slice(fenceIdx + 3, lastFence);
      // Remove possible json language tag
      t = t.replace(/^json\s*/i, "").trim();
    }
  }
  // Focus on the largest array if present
  const firstArr = t.indexOf("[");
  const lastArr = t.lastIndexOf("]");
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    t = t.slice(firstArr, lastArr + 1);
  } else {
    // Try single object, wrap into array
    const firstObj = t.indexOf("{");
    const lastObj = t.lastIndexOf("}");
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      t = `[${t.slice(firstObj, lastObj + 1)}]`;
    }
  }
  // Normalize quotes
  t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  // Replace single-quoted keys/strings with double quotes (best-effort)
  const attempts = [t, t.replace(/'([^'\\]*?)'/g, '"$1"')];
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
    } catch {}
  }
  return null;
}

// Define the main asynchronous function, analyzeImage, which takes base64ImageData and dictOfVars as arguments.
async function analyzeImage(base64ImageData, dictOfVars) {
  // Convert the dictOfVars object to a JSON string.
  const dictOfVarsStr = JSON.stringify(dictOfVars || {});

  // IMPORTANT: Prompt copied as provided by the user to match Python behavior.
  const prompt = `You have been given an image with some mathematical expressions, equations, or graphical problems, and you need to solve them. Note: Use the PEMDAS rule for solving mathematical expressions. PEMDAS stands for the Priority Order: Parentheses, Exponents, Multiplication and Division (from left to right), Addition and Subtraction (from left to right). Parentheses have the highest priority, followed by Exponents, then Multiplication and Division, and lastly Addition and Subtraction. For example: Q. 2 + 3 * 4 (3 * 4) => 12, 2 + 12 = 14. Q. 2 + 3 + 5 * 4 - 8 / 2 5 * 4 => 20, 8 / 2 => 4, 2 + 3 => 5, 5 + 20 => 25, 25 - 4 => 21. YOU CAN HAVE FIVE TYPES OF EQUATIONS/EXPRESSIONS IN THIS IMAGE, AND ONLY ONE CASE SHALL APPLY EVERY TIME: Following are the cases: 1. Simple mathematical expressions like 2 + 2, 3 * 4, 5 / 6, 7 - 8, etc.: In this case, solve and return the answer in the format of a LIST OF ONE DICT [{'expr': given expression, 'result': calculated answer}]. 2. Set of Equations like x^2 + 2x + 1 = 0, 3y + 4x = 0, 5x^2 + 6y + 7 = 12, etc.: In this case, solve for the given variable, and the format should be a COMMA SEPARATED LIST OF DICTS, with dict 1 as {'expr': 'x', 'result': 2, 'assign': True} and dict 2 as {'expr': 'y', 'result': 5, 'assign': True}. This example assumes x was calculated as 2, and y as 5. Include as many dicts as there are variables. 3. Assigning values to variables like x = 4, y = 5, z = 6, etc.: In this case, assign values to variables and return another key in the dict called {'assign': True}, keeping the variable as 'expr' and the value as 'result' in the original dictionary. RETURN AS A LIST OF DICTS. 4. Analyzing Graphical Math problems, which are word problems represented in drawing form, such as cars colliding, trigonometric problems, problems on the Pythagorean theorem, adding runs from a cricket wagon wheel, etc. These will have a drawing representing some scenario and accompanying information with the image. PAY CLOSE ATTENTION TO DIFFERENT COLORS FOR THESE PROBLEMS. You need to return the answer in the format of a LIST OF ONE DICT [{'expr': given expression, 'result': calculated answer}]. 5. Detecting Abstract Concepts that a drawing might show, such as love, hate, jealousy, patriotism, or a historic reference to war, invention, discovery, quote, etc. USE THE SAME FORMAT AS OTHERS TO RETURN THE ANSWER, where 'expr' will be the explanation of the drawing, and 'result' will be the abstract concept. Analyze the equation or expression in this image and return the answer according to the given rules: Make sure to use extra backslashes for escape characters like \\f -> \\\\f, \\n -> \\\\n, etc. Here is a dictionary of user-assigned variables. If the given expression has any of these variables, use its actual value from this dictionary accordingly: ${dictOfVarsStr}. DO NOT USE BACKTICKS OR MARKDOWN FORMATTING. PROPERLY QUOTE THE KEYS AND VALUES IN THE DICTIONARY FOR EASIER PARSING.`;

  // Convert the input image to the correct format for the API.
  const imagePart = fileToGenerativePart(base64ImageData, "image/png");

  if (!API_KEY) {
    console.error("GEMINI_API_KEY is missing. Set it in server/.env");
    return [];
  }

  let responseText = "";
  const contents = [prompt, imagePart];
  const modelsToTry = [
    DEFAULT_MODEL,
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
  ];
  let success = false;
  let lastErr;
  for (const m of modelsToTry) {
    try {
      responseText = await callWithRetries(m, contents, {
        attempts: 3,
        baseDelayMs: 600,
      });
      success = true;
      break;
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  if (!success) {
    console.error(
      "Gemini API error after retries/fallbacks:",
      lastErr?.message || lastErr
    );
    // propagate to route; it will convert to 503/500 response
    throw lastErr || new Error("Gemini API failed");
  }

  let answers = [];
  try {
    // Parse the AI's text response into a JavaScript object.
    answers = JSON.parse(responseText);
  } catch (e) {
    // Try a more flexible parse if strict JSON failed
    const flex = tryParseJsonFlexible(responseText);
    if (flex) {
      answers = flex;
    } else {
      console.error("Error parsing Gemini API response:", e);
      return [];
    }
  }

  // Ensure every item in the response has an 'assign' property.
  const formattedAnswers = (Array.isArray(answers) ? answers : []).map(
    (item) => ({
      ...item,
      assign: item.assign || false,
    })
  );

  return formattedAnswers;
}

// Export the analyzeImage function.
module.exports = { analyzeImage };
