require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

// Créer les dossiers nécessaires s'ils n'existent pas
const dirs = ['uploads', 'pdfs'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Dossier ${dir} créé`);
  }
});

// Import des routes
const rdvRoutes = require('./routes/rdv');
const notificationRoutes = require('./routes/notifications');
const factureRoutes = require('./routes/factures');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const frontendOrigins = (process.env.FRONTEND_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (frontendOrigins.includes('*')) return callback(null, true);
    if (frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parser le body des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware pour logger les requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Servir les fichiers statiques (uploads, pdfs)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

// Routes API
app.use('/api/rdv', rdvRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/factures', factureRoutes);

// Route de santé pour vérifier que le serveur fonctionne
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route d'accueil
app.get('/', (req, res) => {
  res.json({
    message: 'API Meca\'Chez Toi - Gestion des rendez-vous et factures',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Vérifier le statut du serveur',
      'GET /api/rdv': 'Récupérer tous les rendez-vous',
      'GET /api/rdv/:id': 'Récupérer un rendez-vous spécifique',
      'POST /api/rdv': 'Créer un nouveau rendez-vous',
      'PUT /api/rdv/:id/status': 'Mettre à jour le statut d\'un rendez-vous',
      'DELETE /api/rdv/:id': 'Supprimer un rendez-vous',
      'GET /api/rdv/services/list': 'Récupérer les services disponibles',
      'POST /api/notifications/device': 'Ajouter un device pour notifications push',
      'GET /api/notifications/devices': 'Récupérer les devices actifs',
      'GET /api/factures': 'Récupérer toutes les factures',
      'GET /api/factures/stats': 'Statistiques des factures',
      'GET /api/factures/:id': 'Récupérer une facture spécifique',
      'POST /api/factures': 'Créer une nouvelle facture',
      'POST /api/factures/:id/lignes': 'Ajouter une ligne de facture',
      'PUT /api/factures/:id/lignes/:ligneId': 'Mettre à jour une ligne',
      'DELETE /api/factures/:id/lignes/:ligneId': 'Supprimer une ligne',
      'PUT /api/factures/:id/status': 'Mettre à jour le statut',
      'POST /api/factures/:id/pdf': 'Générer le PDF',
      'GET /api/factures/:id/pdf': 'Télécharger le PDF',
      'GET /api/factures/entreprise/info': 'Infos entreprise',
      'PUT /api/factures/entreprise/info': 'Mettre à jour infos entreprise',
      'POST /api/factures/entreprise/logo': 'Uploader le logo'
    }
  });
});

// Middleware pour gérer les routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  });
});

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err);
  
  // Erreur de validation JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'JSON invalide dans le corps de la requête'
    });
  }
  
  // Erreur de taille limite dépassée
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Corps de la requête trop volumineux'
    });
  }
  
  // Erreur par défaut
  res.status(err.status || 500).json({
    success: false,
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(``);
  console.log(`=========================================`);
  console.log(`  API Meca'Chez Toi démarrée`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Heure de démarrage: ${new Date().toLocaleString('fr-FR')}`);
  console.log(`=========================================`);
  console.log(``);
  console.log(`Endpoints disponibles:`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/api/rdv`);
  console.log(`  POST http://localhost:${PORT}/api/rdv`);
  console.log(`  GET  http://localhost:${PORT}/api/rdv/services/list`);
  console.log(`  POST http://localhost:${PORT}/api/notifications/device`);
  console.log(``);
});

// Gestion propre de l'arrêt du serveur
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT reçu, arrêt du serveur...');
  process.exit(0);
});

module.exports = app;
