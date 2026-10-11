import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Fichier où le schéma des tables est défini
  schema: './src/db/schema.js',

  // Dossier où Drizzle Kit stocke les fichiers de migration générés
  out: './src/db/migrations',

  dialect: 'mysql',

  dbCredentials: (() => {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      ssl: { minVersion: 'TLSv1.2' },
    };
  })(),
});
