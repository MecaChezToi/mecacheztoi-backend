const db = require('../config/database');

class Rdv {
  // Créer un nouveau rendez-vous
  static async create(rdvData) {
    const { client_nom, client_prenom, telephone, email, vehicule, service_id, date, heure, adresse, notes } = rdvData;
    
    try {
      // D'abord, vérifier si le client existe déjà
      let clientResult = await db.query(
        'SELECT id FROM clients WHERE telephone = $1',
        [telephone]
      );
      
      let clientId;
      
      if (clientResult.rows.length === 0) {
        // Créer le nouveau client
        const newClient = await db.query(
          'INSERT INTO clients (nom, prenom, telephone, email, vehicule) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [client_nom, client_prenom, telephone, email, vehicule]
        );
        clientId = newClient.rows[0].id;
      } else {
        clientId = clientResult.rows[0].id;
        // Mettre à jour les informations du client existant
        await db.query(
          'UPDATE clients SET nom = $1, prenom = $2, email = $3, vehicule = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
          [client_nom, client_prenom, email, vehicule, clientId]
        );
      }
      
      // Créer le rendez-vous
      const newRdv = await db.query(
        `INSERT INTO rendez_vous (client_id, service_id, date, heure, adresse, notes, statut) 
         VALUES ($1, $2, $3, $4, $5, $6, 'confirmé') RETURNING *`,
        [clientId, service_id, date, heure, adresse, notes]
      );
      
      // Récupérer les informations complètes
      const fullRdv = await this.findById(newRdv.rows[0].id);
      
      return fullRdv;
      
    } catch (error) {
      console.error('Erreur lors de la création du rendez-vous:', error);
      throw error;
    }
  }
  
  // Trouver un rendez-vous par ID avec toutes les informations
  static async findById(id) {
    try {
      const result = await db.query(`
        SELECT 
          r.id,
          r.date,
          r.heure,
          r.statut,
          r.adresse,
          r.notes,
          r.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.telephone,
          c.email,
          c.vehicule,
          s.nom as service_nom,
          s.prix as service_prix,
          s.description as service_description
        FROM rendez_vous r
        JOIN clients c ON r.client_id = c.id
        LEFT JOIN services s ON r.service_id = s.id
        WHERE r.id = $1
      `, [id]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la recherche du rendez-vous:', error);
      throw error;
    }
  }
  
  // Récupérer tous les rendez-vous
  static async getAll(limit = 50, offset = 0) {
    try {
      const result = await db.query(`
        SELECT 
          r.id,
          r.date,
          r.heure,
          r.statut,
          r.adresse,
          r.notes,
          r.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.telephone,
          c.email,
          c.vehicule,
          s.nom as service_nom,
          s.prix as service_prix,
          s.description as service_description
        FROM rendez_vous r
        JOIN clients c ON r.client_id = c.id
        LEFT JOIN services s ON r.service_id = s.id
        ORDER BY r.date DESC, r.heure DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
      
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des rendez-vous:', error);
      throw error;
    }
  }
  
  // Récupérer les rendez-vous du jour
  static async getToday() {
    try {
      const result = await db.query(`
        SELECT 
          r.id,
          r.date,
          r.heure,
          r.statut,
          r.adresse,
          r.notes,
          r.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.telephone,
          c.email,
          c.vehicule,
          s.nom as service_nom,
          s.prix as service_prix,
          s.description as service_description
        FROM rendez_vous r
        JOIN clients c ON r.client_id = c.id
        LEFT JOIN services s ON r.service_id = s.id
        WHERE r.date = CURRENT_DATE
        ORDER BY r.heure ASC
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des rendez-vous du jour:', error);
      throw error;
    }
  }
  
  // Mettre à jour le statut d'un rendez-vous
  static async updateStatus(id, statut) {
    try {
      const result = await db.query(
        'UPDATE rendez_vous SET statut = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [statut, id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      throw error;
    }
  }
  
  // Supprimer un rendez-vous
  static async delete(id) {
    try {
      const result = await db.query('DELETE FROM rendez_vous WHERE id = $1 RETURNING *', [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la suppression du rendez-vous:', error);
      throw error;
    }
  }
  
  // Récupérer les services disponibles
  static async getServices() {
    try {
      const result = await db.query('SELECT * FROM services ORDER BY prix ASC');
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des services:', error);
      throw error;
    }
  }
}

module.exports = Rdv;
