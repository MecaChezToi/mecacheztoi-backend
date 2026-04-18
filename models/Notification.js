const db = require('../config/database');

class Notification {
  // Créer une notification
  static async create(notificationData) {
    try {
      const { rdv_id, type, titre, message } = notificationData;
      
      const result = await db.query(
        'INSERT INTO notifications (rdv_id, type, titre, message) VALUES ($1, $2, $3, $4) RETURNING *',
        [rdv_id, type, titre, message]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la création de la notification:', error);
      throw error;
    }
  }
  
  // Récupérer les notifications non envoyées
  static async getUnsent() {
    try {
      const result = await db.query(`
        SELECT n.*, r.date, r.heure, c.nom as client_nom, c.prenom as client_prenom
        FROM notifications n
        JOIN rendez_vous r ON n.rdv_id = r.id
        JOIN clients c ON r.client_id = c.id
        WHERE n.envoyee = FALSE
        ORDER BY n.created_at ASC
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications non envoyées:', error);
      throw error;
    }
  }
  
  // Marquer une notification comme envoyée
  static async markAsSent(id) {
    try {
      const result = await db.query(
        'UPDATE notifications SET envoyee = TRUE, date_envoi = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors du marquage de la notification:', error);
      throw error;
    }
  }
  
  // Récupérer tous les devices actifs pour notifications push
  static async getActiveDevices() {
    try {
      const result = await db.query(
        'SELECT * FROM devices WHERE active = TRUE ORDER BY created_at DESC'
      );
      
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des devices:', error);
      throw error;
    }
  }
  
  // Ajouter un device pour notifications push
  static async addDevice(deviceData) {
    try {
      const { device_token, platform, user_id } = deviceData;
      
      // Vérifier si le device existe déjà
      const existing = await db.query(
        'SELECT id FROM devices WHERE device_token = $1',
        [device_token]
      );
      
      if (existing.rows.length > 0) {
        // Réactiver le device existant
        const result = await db.query(
          'UPDATE devices SET active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE device_token = $1 RETURNING *',
          [device_token]
        );
        return result.rows[0];
      } else {
        // Créer un nouveau device
        const result = await db.query(
          'INSERT INTO devices (device_token, platform, user_id) VALUES ($1, $2, $3) RETURNING *',
          [device_token, platform, user_id || null]
        );
        return result.rows[0];
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du device:', error);
      throw error;
    }
  }
  
  // Désactiver un device
  static async deactivateDevice(device_token) {
    try {
      const result = await db.query(
        'UPDATE devices SET active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE device_token = $1 RETURNING *',
        [device_token]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la désactivation du device:', error);
      throw error;
    }
  }
}

module.exports = Notification;
