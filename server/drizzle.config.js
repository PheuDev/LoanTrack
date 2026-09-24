import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Fichier où le schéma des tables est défini
  schema: './src/db/schema.js',

  // Dossier où Drizzle Kit stocke les fichiers de migration générés
  out: './src/db/migrations',

  dialect: 'mysql',

  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
