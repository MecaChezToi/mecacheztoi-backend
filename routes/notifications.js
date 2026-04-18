const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { validateDevice, handleValidationErrors } = require('../middleware/validation');

// POST /api/notifications/device - Ajouter un device pour notifications push
router.post('/device', validateDevice, handleValidationErrors, async (req, res) => {
  try {
    const { device_token, platform, user_id } = req.body;
    
    const device = await Notification.addDevice({
      device_token,
      platform,
      user_id
    });
    
    res.status(201).json({
      success: true,
      message: 'Device enregistré avec succès',
      data: device
    });
  } catch (error) {
    console.error('Erreur POST /api/notifications/device:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du device',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/notifications/device - Désactiver un device
router.delete('/device', async (req, res) => {
  try {
    const { device_token } = req.body;
    
    if (!device_token) {
      return res.status(400).json({
        success: false,
        message: 'Device token requis'
      });
    }
    
    const device = await Notification.deactivateDevice(device_token);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Device désactivé avec succès',
      data: device
    });
  } catch (error) {
    console.error('Erreur DELETE /api/notifications/device:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désactivation du device',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/notifications/unsent - Récupérer les notifications non envoyées (pour le système de push)
router.get('/unsent', async (req, res) => {
  try {
    const notifications = await Notification.getUnsent();
    
    res.json({
      success: true,
      message: 'Notifications non envoyées récupérées',
      data: notifications
    });
  } catch (error) {
    console.error('Erreur GET /api/notifications/unsent:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/notifications/devices - Récupérer tous les devices actifs
router.get('/devices', async (req, res) => {
  try {
    const devices = await Notification.getActiveDevices();
    
    res.json({
      success: true,
      message: 'Devices actifs récupérés avec succès',
      data: devices
    });
  } catch (error) {
    console.error('Erreur GET /api/notifications/devices:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des devices',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
