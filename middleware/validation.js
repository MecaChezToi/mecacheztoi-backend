const { body, validationResult } = require('express-validator');

// Validation pour la création de rendez-vous
const validateRdvCreation = [
  body('client_nom')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du client doit contenir entre 2 et 100 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
    
  body('client_prenom')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le prénom du client doit contenir entre 2 et 100 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
    
  body('telephone')
    .matches(/^(0[1-9])([0-9]{8})$|^\+33[1-9][0-9]{8}$/)
    .withMessage('Format de téléphone invalide (ex: 0612345678 ou +33612345678)'),
    
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
    
  body('vehicule')
    .isLength({ min: 3, max: 255 })
    .withMessage('Le véhicule doit contenir entre 3 et 255 caractères'),
    
  body('service_id')
    .isInt({ min: 1 })
    .withMessage('L\'ID du service doit être un entier positif'),
    
  body('date')
    .isISO8601()
    .withMessage('Date invalide (format ISO8601 requis)')
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (date < today) {
        throw new Error('La date ne peut être dans le passé');
      }
      
      // Vérifier que ce n'est pas un dimanche
      if (date.getDay() === 0) {
        throw new Error('Les rendez-vous ne sont pas possibles le dimanche');
      }
      
      return true;
    }),
    
  body('heure')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Heure invalide (format HH:MM requis)')
    .custom((value) => {
      const [hours, minutes] = value.split(':').map(Number);
      
      // Heures d'ouverture : 8h-18h
      if (hours < 8 || hours > 18) {
        throw new Error('Les rendez-vous sont possibles entre 8h et 18h');
      }
      
      // Pas de rendez-vous à 12h pile (déjeuner)
      if (hours === 12 && minutes === 0) {
        throw new Error('Pas de rendez-vous à 12h pile');
      }
      
      return true;
    }),
    
  body('adresse')
    .isLength({ min: 10, max: 500 })
    .withMessage('L\'adresse doit contenir entre 10 et 500 caractères'),
    
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Les notes ne peuvent pas dépasser 1000 caractères')
];

// Validation pour l'ajout de device
const validateDevice = [
  body('device_token')
    .isLength({ min: 10 })
    .withMessage('Le device token est requis'),
    
  body('platform')
    .isIn(['ios', 'android'])
    .withMessage('La plateforme doit être "ios" ou "android"')
];

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: formattedErrors
    });
  }
  
  next();
};

module.exports = {
  validateRdvCreation,
  validateDevice,
  handleValidationErrors
};
