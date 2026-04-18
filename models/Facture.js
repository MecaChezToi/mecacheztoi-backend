const db = require('../config/database');

class Facture {
  // Créer une nouvelle facture
  static async create(factureData) {
    const { client_id, rdv_id, date_echeance, taux_tva, remise_ht, conditions_paiement, notes } = factureData;
    
    try {
      const result = await db.query(
        `INSERT INTO factures (client_id, rdv_id, date_echeance, taux_tva, remise_ht, conditions_paiement, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [client_id, rdv_id, date_echeance, taux_tva || 20.00, remise_ht || 0, conditions_paiement, notes]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la création de la facture:', error);
      throw error;
    }
  }
  
  // Trouver une facture par ID avec toutes les informations
  static async findById(id) {
    try {
      const result = await db.query(`
        SELECT 
          f.*,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.telephone as client_telephone,
          c.email as client_email,
          c.adresse as client_adresse,
          c.code_postal as client_code_postal,
          c.ville as client_ville,
          r.date as rdv_date,
          r.heure as rdv_heure,
          r.vehicule as rdv_vehicule
        FROM factures f
        LEFT JOIN clients c ON f.client_id = c.id
        LEFT JOIN rendez_vous r ON f.rdv_id = r.id
        WHERE f.id = $1
      `, [id]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la recherche de la facture:', error);
      throw error;
    }
  }
  
  // Récupérer toutes les factures
  static async getAll(limit = 50, offset = 0, statut = null) {
    try {
      let query = `
        SELECT 
          f.*,
          c.nom as client_nom,
          c.prenom as client_prenom,
          r.date as rdv_date,
          r.heure as rdv_heure
        FROM factures f
        LEFT JOIN clients c ON f.client_id = c.id
        LEFT JOIN rendez_vous r ON f.rdv_id = r.id
      `;
      let params = [];
      
      if (statut) {
        query += ' WHERE f.statut = $1';
        params.push(statut);
      }
      
      query += ' ORDER BY f.date_emission DESC, f.numero DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des factures:', error);
      throw error;
    }
  }
  
  // Mettre à jour le statut d'une facture
  static async updateStatus(id, statut) {
    try {
      const result = await db.query(
        'UPDATE factures SET statut = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [statut, id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      throw error;
    }
  }
  
  // Supprimer une facture
  static async delete(id) {
    try {
      const result = await db.query('DELETE FROM factures WHERE id = $1 RETURNING *', [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la suppression de la facture:', error);
      throw error;
    }
  }
  
  // Ajouter une ligne de facture
  static async addLigne(facture_id, ligneData) {
    const { description, quantite, prix_unitaire_ht, taux_tva } = ligneData;
    
    try {
      const total_ht = quantite * prix_unitaire_ht;
      
      const result = await db.query(
        `INSERT INTO facture_lignes (facture_id, description, quantite, prix_unitaire_ht, total_ht, taux_tva) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [facture_id, description, quantite, prix_unitaire_ht, total_ht, taux_tva || 20.00]
      );
      
      // Mettre à jour les montants de la facture
      await db.query('UPDATE factures SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [facture_id]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la ligne de facture:', error);
      throw error;
    }
  }
  
  // Récupérer les lignes d'une facture
  static async getLignes(facture_id) {
    try {
      const result = await db.query(
        'SELECT * FROM facture_lignes WHERE facture_id = $1 ORDER BY ordre ASC, id ASC',
        [facture_id]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des lignes:', error);
      throw error;
    }
  }
  
  // Supprimer une ligne de facture
  static async deleteLigne(ligne_id) {
    try {
      const result = await db.query('DELETE FROM facture_lignes WHERE id = $1 RETURNING *', [ligne_id]);
      
      if (result.rows.length > 0) {
        // Mettre à jour les montants de la facture
        await db.query('UPDATE factures SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [result.rows[0].facture_id]);
      }
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la suppression de la ligne:', error);
      throw error;
    }
  }
  
  // Mettre à jour une ligne de facture
  static async updateLigne(ligne_id, ligneData) {
    const { description, quantite, prix_unitaire_ht, taux_tva } = ligneData;
    
    try {
      const total_ht = quantite * prix_unitaire_ht;
      
      const result = await db.query(
        `UPDATE facture_lignes 
         SET description = $1, quantite = $2, prix_unitaire_ht = $3, total_ht = $4, taux_tva = $5 
         WHERE id = $6 RETURNING *`,
        [description, quantite, prix_unitaire_ht, total_ht, taux_tva || 20.00, ligne_id]
      );
      
      if (result.rows.length > 0) {
        // Mettre à jour les montants de la facture
        await db.query('UPDATE factures SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [result.rows[0].facture_id]);
      }
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la ligne:', error);
      throw error;
    }
  }
  
  // Récupérer les informations de l'entreprise
  static async getEntrepriseInfo() {
    try {
      const result = await db.query('SELECT * FROM entreprise_info ORDER BY id DESC LIMIT 1');
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la récupération des infos entreprise:', error);
      throw error;
    }
  }
  
  // Mettre à jour les informations de l'entreprise
  static async updateEntrepriseInfo(infoData) {
    try {
      const { nom, adresse, code_postal, ville, telephone, email, siret, tva_intracomm, iban, logo_path, conditions_generales } = infoData;
      
      const result = await db.query(
        `UPDATE entreprise_info 
         SET nom = $1, adresse = $2, code_postal = $3, ville = $4, telephone = $5, email = $6, 
             siret = $7, tva_intracomm = $8, iban = $9, logo_path = $10, conditions_generales = $11, updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT id FROM entreprise_info ORDER BY id DESC LIMIT 1) RETURNING *`,
        [nom, adresse, code_postal, ville, telephone, email, siret, tva_intracomm, iban, logo_path, conditions_generales]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des infos entreprise:', error);
      throw error;
    }
  }
  
  // Mettre à jour le chemin du PDF
  static async updatePdfPath(id, pdf_path) {
    try {
      const result = await db.query(
        'UPDATE factures SET pdf_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [pdf_path, id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du PDF:', error);
      throw error;
    }
  }
  
  // Statistiques sur les factures
  static async getStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_factures,
          COUNT(CASE WHEN statut = 'payée' THEN 1 END) as factures_payees,
          COUNT(CASE WHEN statut = 'envoyée' THEN 1 END) as factures_envoyees,
          COUNT(CASE WHEN statut = 'brouillon' THEN 1 END) as brouillons,
          COALESCE(SUM(CASE WHEN statut = 'payée' THEN montant_ttc END), 0) as ca_encaisse,
          COALESCE(SUM(CASE WHEN statut = 'envoyée' THEN montant_ttc END), 0) as a_encaisser,
          COALESCE(SUM(montant_ttc), 0) as ca_total
        FROM factures
        WHERE date_emission >= DATE_TRUNC('year', CURRENT_DATE)
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  }
}

module.exports = Facture;
