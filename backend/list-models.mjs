// backend/list-models.mjs  — run with:  node list-models.mjs
import 'dotenv/config';

const key = process.env.GEMINI_API_KEY;
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
const data = await res.json();

if (!data.models) { console.error('Error:', data); process.exit(1); }

console.log('Models your key can use for generation:\n');
for (const m of data.models) {
  if (m.supportedGenerationMethods?.includes('generateContent')) {
    console.log(`  ${m.name.replace('models/', '')}  —  ${m.displayName}`);
  }
}