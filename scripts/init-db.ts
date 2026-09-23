import 'dotenv/config';
import { initDB } from '../lib/db';

try {
  await initDB();
  console.log('Neon database initialized successfully.');
} catch (error) {
  console.error('Failed to initialize Neon database:', error);
  process.exitCode = 1;
}
