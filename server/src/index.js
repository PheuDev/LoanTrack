import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Serveur LoanTrack démarré sur http://localhost:${PORT}`);
});
