const express = require('express');
const router = express.Router();
const Rdv = require('../models/Rdv');
const Notification = require('../models/Notification');
const { validateRdvCreation, handleValidationErrors } = require('../middleware/validation');

// GET /api/rdv - Récupérer tous les rendez-vous
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, date } = req.query;
    
    let rdvs;
    if (date === 'today') {
      rdvs = await Rdv.getToday();
    } else {
      rdvs = await Rdv.getAll(parseInt(limit), parseInt(offset));
    }
    
    res.json({
      success: true,
      message: 'Rendez-vous récupérés avec succès',
      data: rdvs,
      count: rdvs.length
    });
  } catch (error) {
    console.error('Erreur GET /api/rdv:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/rdv/:id - Récupérer un rendez-vous spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de rendez-vous invalide'
      });
    }
    
    const rdv = await Rdv.findById(parseInt(id));
    
    if (!rdv) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Rendez-vous récupéré avec succès',
      data: rdv
    });
  } catch (error) {
    console.error('Erreur GET /api/rdv/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/rdv - Créer un nouveau rendez-vous
router.post('/', validateRdvCreation, handleValidationErrors, async (req, res) => {
  try {
    const rdvData = req.body;
    
    // Créer le rendez-vous
    const newRdv = await Rdv.create(rdvData);
    
    // Créer une notification pour l'application mobile
    await Notification.create({
      rdv_id: newRdv.id,
      type: 'nouveau_rdv',
      titre: 'Nouveau rendez-vous',
      message: `${newRdv.client_prenom} ${newRdv.client_nom} - ${newRdv.service_nom} à ${newRdv.heure}`
    });
    
    // TODO: Envoyer notification push ici
    
    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      data: newRdv
    });
  } catch (error) {
    console.error('Erreur POST /api/rdv:', error);
    
    // Gérer les erreurs spécifiques
    if (error.code === '23505') { // Violation de contrainte unique
      return res.status(409).json({
        success: false,
        message: 'Ce numéro de téléphone existe déjà'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/rdv/:id/status - Mettre à jour le statut d'un rendez-vous
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de rendez-vous invalide'
      });
    }
    
    const statutsValides = ['confirmé', 'terminé', 'annulé'];
    if (!statutsValides.includes(statut)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide. Valeurs possibles: confirmé, terminé, annulé'
      });
    }
    
    const updatedRdv = await Rdv.updateStatus(parseInt(id), statut);
    
    if (!updatedRdv) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }
    
    // Créer une notification pour le changement de statut
    if (statut === 'terminé') {
      await Notification.create({
        rdv_id: parseInt(id),
        type: 'terminé',
        titre: 'Rendez-vous terminé',
        message: `Le rendez-vous de ${updatedRdv.heure} a été marqué comme terminé`
      });
    }
    
    res.json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedRdv
    });
  } catch (error) {
    console.error('Erreur PUT /api/rdv/:id/status:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/rdv/:id - Supprimer un rendez-vous
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de rendez-vous invalide'
      });
    }
    
    const deletedRdv = await Rdv.delete(parseInt(id));
    
    if (!deletedRdv) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Rendez-vous supprimé avec succès',
      data: deletedRdv
    });
  } catch (error) {
    console.error('Erreur DELETE /api/rdv/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/rdv/services - Récupérer les services disponibles
router.get('/services/list', async (req, res) => {
  try {
    const services = await Rdv.getServices();
    
    res.json({
      success: true,
      message: 'Services récupérés avec succès',
      data: services
    });
  } catch (error) {
    console.error('Erreur GET /api/rdv/services:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des services',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
