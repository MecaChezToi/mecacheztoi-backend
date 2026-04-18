-- Base de données pour Meca'Chez Toi
-- PostgreSQL

-- Extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des clients
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    telephone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255),
    vehicule VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des services
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    prix DECIMAL(10,2) NOT NULL,
    duree_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des rendez-vous
CREATE TABLE IF NOT EXISTS rendez_vous (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id),
    date DATE NOT NULL,
    heure TIME NOT NULL,
    statut VARCHAR(20) DEFAULT 'confirmé' CHECK (statut IN ('confirmé', 'terminé', 'annulé')),
    adresse VARCHAR(500) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    rdv_id INTEGER REFERENCES rendez_vous(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'nouveau_rdv', 'rappel', 'annulation'
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    envoyee BOOLEAN DEFAULT FALSE,
    date_envoi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des devices pour notifications push
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER, -- pour futur système multi-utilisateurs
    device_token VARCHAR(255) NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_rendez_vous_date ON rendez_vous(date, heure);
CREATE INDEX IF NOT EXISTS idx_rendez_vous_client ON rendez_vous(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_envoyee ON notifications(envoyee);
CREATE INDEX IF NOT EXISTS idx_devices_active ON devices(active);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rendez_vous_updated_at BEFORE UPDATE ON rendez_vous
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table des factures
CREATE TABLE IF NOT EXISTS factures (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50) NOT NULL UNIQUE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    rdv_id INTEGER REFERENCES rendez_vous(id) ON DELETE SET NULL,
    date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
    date_echeance DATE,
    statut VARCHAR(20) DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoyée', 'payée', 'annulée')),
    montant_ht DECIMAL(10,2) NOT NULL DEFAULT 0,
    montant_tva DECIMAL(10,2) NOT NULL DEFAULT 0,
    montant_ttc DECIMAL(10,2) NOT NULL DEFAULT 0,
    taux_tva DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    remise_ht DECIMAL(10,2) NOT NULL DEFAULT 0,
    conditions_paiement TEXT,
    notes TEXT,
    pdf_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des lignes de facture
CREATE TABLE IF NOT EXISTS facture_lignes (
    id SERIAL PRIMARY KEY,
    facture_id INTEGER REFERENCES factures(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantite DECIMAL(10,2) NOT NULL DEFAULT 1,
    prix_unitaire_ht DECIMAL(10,2) NOT NULL,
    total_ht DECIMAL(10,2) NOT NULL,
    taux_tva DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des informations de l'entreprise (pour les factures)
CREATE TABLE IF NOT EXISTS entreprise_info (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL DEFAULT 'Meca\'Chez Toi',
    adresse VARCHAR(500),
    code_postal VARCHAR(10),
    ville VARCHAR(100),
    telephone VARCHAR(20),
    email VARCHAR(255),
    siret VARCHAR(14),
    tva_intracomm VARCHAR(20),
    iban VARCHAR(34),
    logo_path VARCHAR(500),
    conditions_generales TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les factures
CREATE INDEX IF NOT EXISTS idx_factures_numero ON factures(numero);
CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_emission);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture ON facture_lignes(facture_id);

-- Trigger pour mettre à jour updated_at des factures
CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON factures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entreprise_info_updated_at BEFORE UPDATE ON entreprise_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour calculer automatiquement les montants de la facture
CREATE OR REPLACE FUNCTION calculer_montants_facture()
RETURNS TRIGGER AS $$
DECLARE
    total_lignes_ht DECIMAL(10,2);
BEGIN
    -- Calcul du total HT des lignes
    SELECT COALESCE(SUM(total_ht), 0) INTO total_lignes_ht
    FROM facture_lignes 
    WHERE facture_id = NEW.id;
    
    NEW.montant_ht = total_lignes_ht - COALESCE(NEW.remise_ht, 0);
    
    -- S'assurer que le montant HT n'est pas négatif
    IF NEW.montant_ht < 0 THEN
        NEW.montant_ht = 0;
    END IF;
    
    -- Calcul du montant TVA
    NEW.montant_tva = NEW.montant_ht * (NEW.taux_tva / 100);
    
    -- Calcul du montant TTC
    NEW.montant_ttc = NEW.montant_ht + NEW.montant_tva;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_calculer_montants_facture
    BEFORE INSERT OR UPDATE ON factures
    FOR EACH ROW EXECUTE FUNCTION calculer_montants_facture();

-- Trigger pour générer automatiquement le numéro de facture
CREATE OR REPLACE FUNCTION generer_numero_facture()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
        NEW.numero = 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYY-MM') || '-' || 
                     LPAD(NEXTVAL('facture_numero_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer la séquence pour les numéros de facture
CREATE SEQUENCE IF NOT EXISTS facture_numero_seq START 1;

CREATE TRIGGER trigger_generer_numero_facture
    BEFORE INSERT ON factures
    FOR EACH ROW EXECUTE FUNCTION generer_numero_facture();

-- Insertion des informations entreprise par défaut
INSERT INTO entreprise_info (nom, adresse, code_postal, ville, telephone, email, siret, tva_intracomm, iban, conditions_generales) VALUES
('Meca''Chez Toi', '14 rue Gambetta', '69003', 'Lyon', '0478123456', 'contact@meca-chez-toi.fr', '12345678901234', 'FR12345678901', 'FR7630004000031234567890123', 
'Paiement à 30 jours date de facture. Taux de pénalités de retard : 3 fois le taux d''intérêt légal. Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40€.')
ON CONFLICT DO NOTHING;

-- Insertion des services par défaut
INSERT INTO services (nom, description, prix, duree_minutes) VALUES
('Vidange & Filtres', 'Vidange complète avec remplacement filtre à huile, filtre à air et filtre habitacle', 89.00, 60),
('Freins & Pneumatiques', 'Diagnostic et réparation du système de freinage, vérification pneus', 149.00, 120),
('Diagnostic complet', 'Diagnostic électronique complet du véhicule', 39.00, 45),
('Batterie & Électricité', 'Test batterie, diagnostic système électrique', 79.00, 60),
('Refroidissement', 'Vidange circuit refroidissement, contrôle radiateur', 99.00, 90),
('Éclairage & Optiques', 'Remplacement ampoules, réglage feux', 59.00, 45)
ON CONFLICT DO NOTHING;
