import 'dotenv/config';
import mongoose from 'mongoose';
console.log('USING URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => { console.log('CONNECTED OK'); process.exit(0); })
  .catch((e) => { console.error('RAW ERROR:', e.message); process.exit(1); });