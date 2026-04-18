const express = require('express');
const router = express.Router();
const Facture = require('../models/Facture');
const PDFGenerator = require('../services/pdfGenerator');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

// Configuration de multer pour l'upload de logo
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

router.post('/render-pdf', [
  body('html').isString().isLength({ min: 1, max: 2000000 }),
  body('filename').optional().isString().isLength({ min: 1, max: 200 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array()
    });
  }

  const { html, filename } = req.body;

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${(filename || 'facture.pdf').replace(/"/g, '')}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Erreur POST /api/factures/render-pdf:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du PDF'
    });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
});

router.post('/send-email', [
  body('to').isEmail(),
  body('subject').isString().isLength({ min: 1, max: 200 }),
  body('message').optional().isString().isLength({ min: 0, max: 200000 }),
  body('html').optional().isString().isLength({ min: 0, max: 200000 }),
  body('attachmentBase64').optional().isString().isLength({ min: 0, max: 20000000 }),
  body('attachmentFilename').optional().isString().isLength({ min: 1, max: 200 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array()
    });
  }

  const {
    to,
    subject,
    message,
    html,
    attachmentBase64,
    attachmentFilename,
  } = req.body;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = (process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    return res.status(500).json({
      success: false,
      message: 'SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASS)'
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    let att = null;
    if (attachmentBase64 && attachmentFilename) {
      const cleaned = attachmentBase64.startsWith('data:')
        ? attachmentBase64.split('base64,')[1] || ''
        : attachmentBase64;
      att = {
        filename: attachmentFilename,
        content: Buffer.from(cleaned, 'base64'),
        contentType: 'application/pdf',
      };
    }

    await transporter.sendMail({
      from,
      to,
      subject,
      text: message || '',
      html: html || undefined,
      attachments: att ? [att] : [],
    });

    return res.json({
      success: true,
      message: 'Email envoyé'
    });
  } catch (error) {
    console.error('Erreur POST /api/factures/send-email:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’envoi email'
    });
  }
});

// GET /api/factures - Récupérer toutes les factures
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, statut } = req.query;
    
    const factures = await Facture.getAll(parseInt(limit), parseInt(offset), statut);
    
    res.json({
      success: true,
      message: 'Factures récupérées avec succès',
      data: factures,
      count: factures.length
    });
  } catch (error) {
    console.error('Erreur GET /api/factures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des factures',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/factures/stats - Statistiques des factures
router.get('/stats', async (req, res) => {
  try {
    const stats = await Facture.getStats();
    
    res.json({
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: stats
    });
  } catch (error) {
    console.error('Erreur GET /api/factures/stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/factures/:id - Récupérer une facture spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de facture invalide'
      });
    }
    
    const facture = await Facture.findById(parseInt(id));
    
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }
    
    // Récupérer les lignes de la facture
    const lignes = await Facture.getLignes(parseInt(id));
    
    res.json({
      success: true,
      message: 'Facture récupérée avec succès',
      data: { ...facture, lignes }
    });
  } catch (error) {
    console.error('Erreur GET /api/factures/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/factures - Créer une nouvelle facture
router.post('/', [
  body('client_id').isInt({ min: 1 }).withMessage('ID client invalide'),
  body('rdv_id').optional().isInt({ min: 1 }).withMessage('ID rendez-vous invalide'),
  body('taux_tva').optional().isFloat({ min: 0, max: 100 }).withMessage('Taux TVA invalide'),
  body('remise_ht').optional().isFloat({ min: 0 }).withMessage('Remise invalide'),
  body('conditions_paiement').optional().isLength({ max: 500 }).withMessage('Conditions de paiement trop longues'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes trop longues')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array()
    });
  }

  try {
    const facture = await Facture.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      data: facture
    });
  } catch (error) {
    console.error('Erreur POST /api/factures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/factures/:id/lignes - Ajouter une ligne de facture
router.post('/:id/lignes', [
  body('description').isLength({ min: 3, max: 500 }).withMessage('Description invalide'),
  body('quantite').isFloat({ min: 0.1 }).withMessage('Quantité invalide'),
  body('prix_unitaire_ht').isFloat({ min: 0 }).withMessage('Prix unitaire invalide'),
  body('taux_tva').optional().isFloat({ min: 0, max: 100 }).withMessage('Taux TVA invalide')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de facture invalide'
      });
    }
    
    const ligne = await Facture.addLigne(parseInt(id), req.body);
    
    res.status(201).json({
      success: true,
      message: 'Ligne ajoutée avec succès',
      data: ligne
    });
  } catch (error) {
    console.error('Erreur POST /api/factures/:id/lignes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de la ligne',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/factures/:id/lignes/:ligneId - Mettre à jour une ligne
router.put('/:id/lignes/:ligneId', [
  body('description').isLength({ min: 3, max: 500 }).withMessage('Description invalide'),
  body('quantite').isFloat({ min: 0.1 }).withMessage('Quantité invalide'),
  body('prix_unitaire_ht').isFloat({ min: 0 }).withMessage('Prix unitaire invalide'),
  body('taux_tva').optional().isFloat({ min: 0, max: 100 }).withMessage('Taux TVA invalide')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array()
    });
  }

  try {
    const { ligneId } = req.params;
    
    if (!ligneId || isNaN(parseInt(ligneId))) {
      return res.status(400).json({
        success: false,
        message: 'ID de ligne invalide'
      });
    }
    
    const ligne = await Facture.updateLigne(parseInt(ligneId), req.body);
    
    if (!ligne) {
      return res.status(404).json({
        success: false,
        message: 'Ligne non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Ligne mise à jour avec succès',
      data: ligne
    });
  } catch (error) {
    console.error('Erreur PUT /api/factures/:id/lignes/:ligneId:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la ligne',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/factures/:id/lignes/:ligneId - Supprimer une ligne
router.delete('/:id/lignes/:ligneId', async (req, res) => {
  try {
    const { ligneId } = req.params;
    
    if (!ligneId || isNaN(parseInt(ligneId))) {
      return res.status(400).json({
        success: false,
        message: 'ID de ligne invalide'
      });
    }
    
    const ligne = await Facture.deleteLigne(parseInt(ligneId));
    
    if (!ligne) {
      return res.status(404).json({
        success: false,
        message: 'Ligne non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Ligne supprimée avec succès',
      data: ligne
    });
  } catch (error) {
    console.error('Erreur DELETE /api/factures/:id/lignes/:ligneId:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la ligne',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/factures/:id/status - Mettre à jour le statut
router.put('/:id/status', [
  body('statut').isIn(['brouillon', 'envoyée', 'payée', 'annulée']).withMessage('Statut invalide')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const { statut } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de facture invalide'
      });
    }
    
    const facture = await Facture.updateStatus(parseInt(id), statut);
    
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: facture
    });
  } catch (error) {
    console.error('Erreur PUT /api/factures/:id/status:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/factures/:id/pdf - Générer le PDF
router.post('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de facture invalide'
      });
    }
    
    // Récupérer la facture et ses lignes
    const facture = await Facture.findById(parseInt(id));
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }
    
    const lignes = await Facture.getLignes(parseInt(id));
    const entrepriseInfo = await Facture.getEntrepriseInfo();
    
    if (!entrepriseInfo) {
      return res.status(500).json({
        success: false,
        message: 'Informations de l\'entreprise non configurées'
      });
    }
    
    // Générer le PDF
    const pdfGenerator = new PDFGenerator();
    const pdfResult = await pdfGenerator.generateFacturePDF(facture, lignes, entrepriseInfo);
    
    // Mettre à jour le chemin du PDF dans la base de données
    await Facture.updatePdfPath(parseInt(id), pdfResult.filepath);
    
    // Envoyer le PDF en réponse
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
    res.send(pdfResult.buffer);
    
  } catch (error) {
    console.error('Erreur POST /api/factures/:id/pdf:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/factures/:id/pdf - Télécharger le PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de facture invalide'
      });
    }
    
    const facture = await Facture.findById(parseInt(id));
    
    if (!facture || !facture.pdf_path) {
      return res.status(404).json({
        success: false,
        message: 'PDF non trouvé pour cette facture'
      });
    }
    
    const fs = require('fs');
    
    if (!fs.existsSync(facture.pdf_path)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier PDF non trouvé'
      });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture_${facture.numero}.pdf"`);
    res.sendFile(facture.pdf_path);
    
  } catch (error) {
    console.error('Erreur GET /api/factures/:id/pdf:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/factures/:id - Supprimer une facture
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de facture invalide'
      });
    }
    
    const facture = await Facture.delete(parseInt(id));
    
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Facture supprimée avec succès',
      data: facture
    });
  } catch (error) {
    console.error('Erreur DELETE /api/factures/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/factures/entreprise - Récupérer les infos entreprise
router.get('/entreprise/info', async (req, res) => {
  try {
    const info = await Facture.getEntrepriseInfo();
    
    if (!info) {
      return res.status(404).json({
        success: false,
        message: 'Informations entreprise non trouvées'
      });
    }
    
    res.json({
      success: true,
      message: 'Informations entreprise récupérées avec succès',
      data: info
    });
  } catch (error) {
    console.error('Erreur GET /api/factures/entreprise:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations entreprise',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/factures/entreprise - Mettre à jour les infos entreprise
router.put('/entreprise/info', [
  body('nom').isLength({ min: 2, max: 255 }).withMessage('Nom invalide'),
  body('adresse').optional().isLength({ max: 500 }).withMessage('Adresse trop longue'),
  body('code_postal').optional().isLength({ max: 10 }).withMessage('Code postal invalide'),
  body('ville').optional().isLength({ max: 100 }).withMessage('Ville invalide'),
  body('telephone').optional().isLength({ max: 20 }).withMessage('Téléphone invalide'),
  body('email').optional().isEmail().withMessage('Email invalide'),
  body('siret').optional().isLength({ min: 14, max: 14 }).withMessage('SIRET invalide'),
  body('tva_intracomm').optional().isLength({ max: 20 }).withMessage('TVA intracommunautaire invalide'),
  body('iban').optional().isLength({ max: 34 }).withMessage('IBAN invalide')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array()
    });
  }

  try {
    const info = await Facture.updateEntrepriseInfo(req.body);
    
    if (!info) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour des informations entreprise'
      });
    }
    
    res.json({
      success: true,
      message: 'Informations entreprise mises à jour avec succès',
      data: info
    });
  } catch (error) {
    console.error('Erreur PUT /api/factures/entreprise:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des informations entreprise',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/factures/entreprise/logo - Upload du logo
router.post('/entreprise/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier uploadé'
      });
    }
    
    const logoPath = req.file.path;
    
    // Mettre à jour les infos entreprise avec le chemin du logo
    const info = await Facture.updateEntrepriseInfo({ logo_path: logoPath });
    
    res.json({
      success: true,
      message: 'Logo uploadé avec succès',
      data: { logo_path: logoPath }
    });
  } catch (error) {
    console.error('Erreur POST /api/factures/entreprise/logo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload du logo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
