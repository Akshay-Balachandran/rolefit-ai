// backend/test-gen.mjs  — run with: node test-gen.mjs
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL,
  generationConfig: { responseMimeType: "application/json" }
});

const r = await model.generateContent(
  'Return a JSON object: {"status":"ok","model_working":true}'
);
console.log(r.response.text());