# API Meca'Chez Toi - Backend

API REST pour la gestion des rendez-vous de l'atelier automobile Meca'Chez Toi.

## Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd meca-chez-toi-api
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer la base de données**
```bash
# Installer PostgreSQL
# Créer la base de données
createdb meca_chez_toi

# Importer le schéma
psql -d meca_chez_toi -f database.sql
```

4. **Configurer les variables d'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos configurations
```

5. **Démarrer le serveur**
```bash
# Développement
npm run dev

# Production
npm start
```

## Configuration requise

- Node.js 16+
- PostgreSQL 12+
- npm 7+

## Endpoints API

### Rendez-vous

- `GET /api/rdv` - Récupérer tous les rendez-vous
- `GET /api/rdv/:id` - Récupérer un rendez-vous spécifique
- `POST /api/rdv` - Créer un nouveau rendez-vous
- `PUT /api/rdv/:id/status` - Mettre à jour le statut
- `DELETE /api/rdv/:id` - Supprimer un rendez-vous
- `GET /api/rdv/services/list` - Liste des services

### Notifications

- `POST /api/notifications/device` - Ajouter un device
- `DELETE /api/notifications/device` - Désactiver un device
- `GET /api/notifications/devices` - Lister les devices actifs

## Exemple d'utilisation

### Créer un rendez-vous

```javascript
const response = await fetch('http://localhost:3000/api/rdv', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    client_nom: 'Martin',
    client_prenom: 'Thomas',
    telephone: '0612345678',
    email: 'thomas.martin@email.com',
    vehicule: 'Peugeot 308 2020',
    service_id: 1,
    date: '2024-04-15',
    heure: '09:00',
    adresse: '14 rue Gambetta, Lyon',
    notes: 'Client fidèle'
  })
});
```

### Récupérer les rendez-vous du jour

```javascript
const response = await fetch('http://localhost:3000/api/rdv?date=today');
const rdvs = await response.json();
```

## Structure de la base de données

- **clients** : Informations des clients
- **services** : Services proposés par l'atelier
- **rendez_vous** : Planning des rendez-vous
- **notifications** : Notifications push à envoyer
- **devices** : Devices iOS/Android pour notifications

## Sécurité

- Validation des entrées avec express-validator
- Protection contre les injections SQL
- CORS configuré
- Helmet pour la sécurité HTTP

## Déploiement

### Docker (recommandé)

```bash
# Build
docker build -t meca-chez-toi-api .

# Run
docker run -p 3000:3000 --env-file .env meca-chez-toi-api
```

### Heroku

```bash
# Installer Heroku CLI
heroku create votre-app
heroku config:set NODE_ENV=production
heroku config:set DB_HOST=votre-host
# ... autres variables
git push heroku main
```

## Prochaines étapes

1. Intégrer les notifications push avec APNS (iOS)
2. Ajouter l'authentification JWT
3. Créer un dashboard admin
4. Ajouter les rappels automatiques
5. Intégrer un système de paiement

## Support

Pour toute question ou problème, contacter le développeur.
