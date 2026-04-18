const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class PDFGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '../pdfs');
  }

  async generateFacturePDF(facture, lignes, entrepriseInfo) {
    try {
      const browser = await puppeteer.launch({
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
      
      // Génération du HTML de la facture
      const html = this.generateFactureHTML(facture, lignes, entrepriseInfo);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Génération du PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; color: #666; text-align: center; width: 100%;">
            Facture N°${facture.numero} - ${entrepriseInfo.nom}
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 9px; color: #666; text-align: center; width: 100%;">
            ${entrepriseInfo.nom} - ${entrepriseInfo.adresse} ${entrepriseInfo.code_postal} ${entrepriseInfo.ville} - 
            SIRET: ${entrepriseInfo.siret} - Page <span class="pageNumber"></span>/<span class="totalPages"></span>
          </div>
        `
      });
      
      await browser.close();
      
      // Sauvegarde du fichier
      const filename = `facture_${facture.numero.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      await fs.writeFile(filepath, pdfBuffer);
      
      return {
        filename,
        filepath,
        buffer: pdfBuffer
      };
      
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      throw error;
    }
  }

  generateFactureHTML(facture, lignes, entrepriseInfo) {
    const dateEmission = new Date(facture.date_emission).toLocaleDateString('fr-FR');
    const dateEcheance = facture.date_echeance ? new Date(facture.date_echeance).toLocaleDateString('fr-FR') : '';
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facture ${facture.numero}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            border-bottom: 2px solid #2c5a57;
            padding-bottom: 20px;
        }
        
        .logo {
            flex: 1;
        }
        
        .logo img {
            max-width: 150px;
            height: auto;
        }
        
        .logo h1 {
            color: #2c5a57;
            font-size: 24px;
            margin-bottom: 5px;
        }
        
        .facture-info {
            text-align: right;
            flex: 1;
        }
        
        .facture-info h2 {
            font-size: 28px;
            color: #a34719;
            margin-bottom: 10px;
        }
        
        .facture-info p {
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        .addresses {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        
        .address-block {
            flex: 1;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        
        .address-block h3 {
            color: #2c5a57;
            margin-bottom: 10px;
            font-size: 14px;
        }
        
        .address-block p {
            margin-bottom: 5px;
        }
        
        .table-container {
            margin-bottom: 30px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        th {
            background-color: #2c5a57;
            color: white;
            font-weight: bold;
        }
        
        .total-row {
            font-weight: bold;
            background-color: #f8f9fa;
        }
        
        .total-row td {
            border-bottom: 2px solid #2c5a57;
        }
        
        .footer-info {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }
        
        .footer-info h3 {
            color: #2c5a57;
            margin-bottom: 10px;
            font-size: 14px;
        }
        
        .footer-info p {
            margin-bottom: 5px;
            font-size: 11px;
            color: #666;
        }
        
        .mentions {
            margin-top: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
            font-size: 11px;
            color: #666;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-brouillon { background-color: #ffc107; color: #333; }
        .status-envoyee { background-color: #17a2b8; color: white; }
        .status-payee { background-color: #28a745; color: white; }
        .status-annulee { background-color: #dc3545; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <!-- En-tête -->
        <div class="header">
            <div class="logo">
                ${entrepriseInfo.logo_path ? `<img src="${entrepriseInfo.logo_path}" alt="${entrepriseInfo.nom}">` : ''}
                <h1>${entrepriseInfo.nom}</h1>
                <p>${entrepriseInfo.adresse}</p>
                <p>${entrepriseInfo.code_postal} ${entrepriseInfo.ville}</p>
                <p>Tél: ${entrepriseInfo.telephone}</p>
                <p>Email: ${entrepriseInfo.email}</p>
            </div>
            <div class="facture-info">
                <h2>FACTURE</h2>
                <p>N°: ${facture.numero}</p>
                <p>Date: ${dateEmission}</p>
                ${dateEcheance ? `<p>Échéance: ${dateEcheance}</p>` : ''}
                <p>Statut: <span class="status-badge status-${facture.statut}">${facture.statut}</span></p>
            </div>
        </div>

        <!-- Adresses -->
        <div class="addresses">
            <div class="address-block">
                <h3>Adresse de facturation</h3>
                <p><strong>${facture.client_prenom} ${facture.client_nom}</strong></p>
                ${facture.client_adresse ? `<p>${facture.client_adresse}</p>` : ''}
                ${facture.client_code_postal ? `<p>${facture.client_code_postal} ${facture.client_ville}</p>` : ''}
                <p>Tél: ${facture.client_telephone}</p>
                ${facture.client_email ? `<p>Email: ${facture.client_email}</p>` : ''}
            </div>
            <div class="address-block">
                <h3>Informations complémentaires</h3>
                ${facture.rdv_date ? `<p>Date RDV: ${new Date(facture.rdv_date).toLocaleDateString('fr-FR')}</p>` : ''}
                ${facture.rdv_heure ? `<p>Heure: ${facture.rdv_heure}</p>` : ''}
                ${facture.rdv_vehicule ? `<p>Véhicule: ${facture.rdv_vehicule}</p>` : ''}
                ${facture.conditions_paiement ? `<p>Conditions: ${facture.conditions_paiement}</p>` : ''}
            </div>
        </div>

        <!-- Détails de la facture -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center;">Quantité</th>
                        <th style="text-align: right;">Prix unitaire HT</th>
                        <th style="text-align: right;">Total HT</th>
                    </tr>
                </thead>
                <tbody>
                    ${lignes.map(ligne => `
                        <tr>
                            <td>${ligne.description}</td>
                            <td style="text-align: center;">${Number(ligne.quantite).toFixed(2)}</td>
                            <td style="text-align: right;">${Number(ligne.prix_unitaire_ht).toFixed(2)}€</td>
                            <td style="text-align: right;">${Number(ligne.total_ht).toFixed(2)}€</td>
                        </tr>
                    `).join('')}
                    
                    ${Number(facture.remise_ht) > 0 ? `
                        <tr>
                            <td colspan="3" style="text-align: right;"><strong>Remise HT:</strong></td>
                            <td style="text-align: right;">-${Number(facture.remise_ht).toFixed(2)}€</td>
                        </tr>
                    ` : ''}
                    
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;"><strong>Total HT:</strong></td>
                        <td style="text-align: right;">${Number(facture.montant_ht).toFixed(2)}€</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;"><strong>TVA (${facture.taux_tva}%):</strong></td>
                        <td style="text-align: right;">${Number(facture.montant_tva).toFixed(2)}€</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;"><strong>Total TTC:</strong></td>
                        <td style="text-align: right; font-size: 16px; color: #a34719;">${Number(facture.montant_ttc).toFixed(2)}€</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Informations de paiement -->
        <div class="footer-info">
            <h3>Coordonnées bancaires</h3>
            <p><strong>IBAN:</strong> ${entrepriseInfo.iban}</p>
            ${entrepriseInfo.siret ? `<p><strong>SIRET:</strong> ${entrepriseInfo.siret}</p>` : ''}
            ${entrepriseInfo.tva_intracomm ? `<p><strong>N° TVA Intracommunautaire:</strong> ${entrepriseInfo.tva_intracomm}</p>` : ''}
        </div>

        <!-- Mentions légales -->
        <div class="mentions">
            <h3>Mentions légales</h3>
            <p>${entrepriseInfo.conditions_generales || 'Paiement à 30 jours date de facture. Taux de pénalités de retard : 3 fois le taux d\'intérêt légal.'}</p>
            <p>En cas de retard de paiement, une indemnité forfaitaire pour frais de recouvrement de 40€ sera appliquée.</p>
            ${facture.notes ? `<p><strong>Notes:</strong> ${facture.notes}</p>` : ''}
        </div>
    </div>
</body>
</html>
    `;
  }
}

module.exports = PDFGenerator;
