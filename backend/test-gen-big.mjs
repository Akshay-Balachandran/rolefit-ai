import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL,
  generationConfig: { responseMimeType: 'application/json' },
});
const big = 'Senior engineer with React and Node experience. '.repeat(1500); // ~70KB
try {
  const r = await model.generateContent('Reply JSON {"ok":true}. Context: ' + big);
  console.log('OK:', r.response.text().slice(0, 80));
} catch (e) {
  console.error('FAILED:', e.message, '| cause code:', e.cause?.code);
}