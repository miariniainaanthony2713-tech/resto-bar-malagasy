# Resto Bar Malagasy — Backend

## 1. Installer Node.js (une seule fois)
1. Va sur https://nodejs.org → télécharge la version **LTS**
2. Installe-la normalement
3. Vérifie dans un terminal : `node --version`

## 2. Configurer l'email (Gmail)
Dans `server.js`, remplace ces deux lignes :
```
user: process.env.EMAIL_USER || 'ton.email@gmail.com',
pass: process.env.EMAIL_PASS || 'ton_mot_de_passe_app'
```
Pour Gmail, il faut créer un **mot de passe d'application** :
- Va sur https://myaccount.google.com → Sécurité → Validation en deux étapes → Mots de passe des applications
- Génère un mot de passe pour "Mail" et colle-le à la place de `ton_mot_de_passe_app`

## 3. Installer les dépendances
Dans le dossier du projet, dans un terminal :
```
npm install
```

## 4. Lancer le serveur
```
npm start
```
Tu verras :
```
Serveur démarré  : http://localhost:3000
Page admin       : http://localhost:3000/admin.html
```

## 5. Utilisation
| URL | Description |
|---|---|
| http://localhost:3000 | Site client (menu, panier, réservation) |
| http://localhost:3000/admin.html | Tableau de bord admin |

### Côté admin (3 onglets) :
- **🧾 Commandes** : vois les commandes arriver en temps réel, change leur statut
- **🍽️ Menu** : ajoute / modifie / supprime des plats avec photo
- **📅 Réservations** : vois les réservations, confirme ou annule-les

## Structure du projet
```
resto-bar-app/
├── package.json
├── server.js              → serveur principal
├── data/
│   ├── menu.json          → plats et boissons
│   ├── orders.json        → commandes
│   └── reservations.json  → réservations
└── public/
    ├── index.html         → site client
    ├── style.css
    ├── admin.html         → tableau de bord admin
    ├── admin.css
    ├── admin.js
    └── uploads/           → photos des plats uploadées
```
"# resto-bar-malagasy" 
