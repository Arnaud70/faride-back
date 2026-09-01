# ÉTAPE 4 - Module Commandes (Orders) ✅

## Résumé de ce qui a été implémenté

### 📁 Structure de fichiers créée

```
src/orders/
├── dto/
│   ├── order.dto.ts              # DTOs pour les commandes
│   └── index.ts
├── orders.service.ts             # Service CRUD commandes
├── orders.controller.ts          # Controller endpoints
├── orders.module.ts              # Module NestJS
└── README.md (optionnel)
```

### 🔐 Contrôle d'accès

| Méthode | Route | Authentification | Rôles |
|---------|-------|-----------------|-------|
| POST | `/orders` | ✅ JWT | CLIENT |
| GET | `/orders/me` | ✅ JWT | CLIENT |
| GET | `/orders` | ✅ JWT | ADMIN, PERSONNEL |
| GET | `/orders/:id` | ✅ JWT | Toutes les authentifications |
| PATCH | `/orders/:id/status` | ✅ JWT | ADMIN, PERSONNEL |
| PATCH | `/orders/:id/cancel` | ✅ JWT | Tous (propriétaire ou ADMIN) |

### 📋 Endpoints détaillés

#### **POST /orders** (Client)
Créer une nouvelle commande

**Body:**
```json
{
  "items": [
    {
      "dishId": "uuid-du-plat-1",
      "quantite": 2
    },
    {
      "dishId": "uuid-du-plat-2",
      "quantite": 1
    }
  ],
  "heureRetrait": "2026-08-18T14:30:00Z"
}
```

**Réponse (201):**
```json
{
  "id": "uuid",
  "clientId": "uuid",
  "statut": "EN_ATTENTE",
  "heureRetrait": "2026-08-18T14:30:00Z",
  "montantTotal": "7500",
  "createdAt": "2026-08-18T...",
  "updatedAt": "2026-08-18T...",
  "items": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "dishId": "uuid",
      "quantite": 2,
      "prixUnitaire": "2500",
      "dish": { ... }
    }
  ],
  "client": { ... },
  "payment": null,
  "reminder": null
}
```

#### **GET /orders/me** (Client)
Récupérer mes commandes (triées par date décroissante)

**Réponse:**
```json
[
  {
    "id": "uuid",
    "clientId": "uuid-du-client-connecté",
    "statut": "EN_ATTENTE",
    "heureRetrait": "2026-08-18T14:30:00Z",
    "montantTotal": "7500",
    "createdAt": "2026-08-18T...",
    "updatedAt": "2026-08-18T...",
    "items": [ ... ],
    "client": { ... },
    "payment": { ... },
    "reminder": { ... }
  }
]
```

#### **GET /orders** (Admin/Personnel)
Lister toutes les commandes

**Query Parameters:**
- `orderBy` (optionnel): `heureRetrait` (défaut) ou `createdAt`

**Réponse:**
```json
[
  {
    "id": "uuid",
    "clientId": "uuid",
    "statut": "EN_ATTENTE",
    "heureRetrait": "2026-08-18T14:30:00Z",
    "montantTotal": "7500",
    "createdAt": "2026-08-18T...",
    "items": [ ... ],
    "client": {
      "id": "uuid",
      "nom": "Client Demo",
      "telephone": "+228...",
      "email": "...",
      "role": "CLIENT",
      "createdAt": "..."
    },
    "payment": { ... },
    "reminder": { ... }
  }
]
```

#### **GET /orders/:id** (Authentifié)
Récupérer une commande par ID

**Réponse:**
```json
{
  "id": "uuid",
  "clientId": "uuid",
  "statut": "EN_ATTENTE",
  "heureRetrait": "2026-08-18T14:30:00Z",
  "montantTotal": "7500",
  "createdAt": "2026-08-18T...",
  "items": [ ... ],
  "client": { ... },
  "payment": null,
  "reminder": null
}
```

#### **PATCH /orders/:id/status** (Admin/Personnel)
Mettre à jour le statut d'une commande

**Body:**
```json
{
  "statut": "EN_PREPARATION"
}
```

**Statuts valides:**
- `EN_ATTENTE` → `EN_PREPARATION` → `PRETE` → `RECUPEREE`
- Peut aussi passer à `ANNULEE` à tout moment (sauf si déjà RECUPEREE)

#### **PATCH /orders/:id/cancel** (Authentifié)
Annuler une commande

**Réponse:** Commande mise à jour avec `statut: "ANNULEE"`

**Erreurs:**
- ❌ 400 : Impossible d'annuler si le statut est RECUPEREE ou ANNULEE

### ✅ Validations implémentées

#### CreateOrderDto
- ✅ `items`: array non vide avec au minimum 1 élément
- ✅ `items[].dishId`: UUID valide
- ✅ `items[].quantite`: nombre entier >= 1
- ✅ `heureRetrait`: date ISO valide (string ISO 8601)

#### UpdateOrderStatusDto
- ✅ `statut`: enum valide parmi EN_ATTENTE, EN_PREPARATION, PRETE, RECUPEREE, ANNULEE

### 🚨 Erreurs gérées

- ❌ 400 : Commande vide (aucun item)
- ❌ 400 : Un ou plusieurs plats n'existent pas
- ❌ 400 : Impossible d'annuler une commande RECUPEREE ou ANNULEE
- ❌ 404 : Commande non trouvée
- ❌ 401 : Non authentifié
- ❌ 403 : Accès refusé (rôle insuffisant)

### 💰 Calcul du montant total

Le montant total est calculé automatiquement :
- Pour chaque item: `prixUnitaire × quantite`
- Montant total = somme de tous les items

Les prix sont récupérés de la base de données au moment de la création.

### 📊 Intégration avec les autres modules

#### Utilisé par :
- **PaymentsModule** (Étape 5) : Créer un paiement pour une commande
- **RemindersModule** (Étape 6) : Créer un rappel pour une commande

#### Utilise :
- **DishesService** : Valider l'existence des plats et récupérer leurs prix
- **AuthModule** : Guards JWT et RoleGuard

### ✅ État de compilation

✅ Backend compile sans erreurs
✅ Tous les DTOs validés
✅ Service d'ordre de commandes complètement implémenté
✅ Controllers documentés avec Swagger

## Flux d'utilisation typique

1. **Client crée une commande**
   ```
   POST /auth/login → reçoit accessToken
   POST /orders (avec token) → crée la commande EN_ATTENTE
   ```

2. **Personnel voit les commandes**
   ```
   GET /orders?orderBy=heureRetrait → liste classée par heure de retrait
   PATCH /orders/:id/status → change EN_ATTENTE → EN_PREPARATION
   PATCH /orders/:id/status → change EN_PREPARATION → PRETE
   ```

3. **Client suit sa commande**
   ```
   GET /orders/me → voit tous ses commandes
   GET /orders/:id → voit une commande spécifique
   ```

4. **Rappel avant retrait**
   ```
   (Créé automatiquement par l'Étape 6)
   ```

## Prochaines étapes

L'étape 5 (Module Paiement) créera les endpoints pour simuler les paiements associés à une commande.

**Confirmation :** ✅ Cette étape est terminée et compilée avec succès.
