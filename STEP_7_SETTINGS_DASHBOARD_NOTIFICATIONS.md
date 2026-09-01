# ✅ ÉTAPE 7 — Paramètres, créneaux, tableau de bord & notifications

Cette étape ajoute la **gestion intelligente du cycle de commande** demandée par le cahier
des charges (créneaux de retrait, priorisation, statistiques serveur, notifications).

## 1. Schéma Prisma (migration `20260901120000_settings_notifications_dashboard`)

| Modèle / champ | Rôle |
|---|---|
| `RestaurantSetting` | Ligne unique : nom, adresse, téléphone, heures d'ouverture/fermeture, intervalle des créneaux, buffer de préparation, nombre max de commandes par créneau |
| `Notification` (+ enum `NotificationType`) | Notifications utilisateur (COMMANDE, PAIEMENT, RAPPEL, SYSTEME) |
| `Order.orderNumber` | Numéro lisible `CMD-AAAA-0001` (unique) |
| `Order.orderType` (enum `OrderType`) | Mode de récupération : `A_EMPORTER`, `LIVRAISON`, `SUR_PLACE` |
| `Order.notes` | Remarque libre du client |
| `Category.description` / `imageUrl` / `actif` / `updatedAt` | Champs manquants du cahier |
| Index ajoutés | `orders.statut`, `orders.heureRetrait`, `orders.createdAt`, `dishes.categorieId`, `users.email`, `notifications.userId` |

> ⚠️ La base Neon doit être joignable pour appliquer la migration :
> `cd backend && npx prisma migrate deploy` puis `npm run prisma:seed`.

## 2. `SettingsModule`

| Méthode | Endpoint | Accès |
|---|---|---|
| GET | `/settings` | public |
| GET | `/settings/creneaux?date=YYYY-MM-DD` | public — liste des créneaux avec `disponible / passe / complet / placesRestantes` |
| PATCH | `/settings` | ADMIN |

`SettingsService.validatePickupTime()` est appelé par `OrdersService.create()` : refus si
l'heure est passée (+ buffer), hors des heures d'ouverture, ou si le créneau est complet.

## 3. `DashboardModule` (ADMIN / CHEF)

| Endpoint | Contenu |
|---|---|
| `/dashboard/stats` | Commandes du jour, répartition par statut, CA (paiements validés), panier moyen |
| `/dashboard/plats-populaires?limit=5` | Classement des plats sur 30 jours (`groupBy` Prisma) |
| `/dashboard/priorites` | Commandes actives triées `URGENT → A_PREPARER → PROGRAMMEE`, calcul : `heureRetrait − (dureeCuisson max + buffer)` |

## 4. `NotificationsModule`

| Endpoint | Rôle |
|---|---|
| GET `/notifications/me` | 50 dernières notifications |
| GET `/notifications/me/unread-count` | compteur |
| PATCH `/notifications/:id/read` | marquer lue |
| PATCH `/notifications/read-all` | tout marquer lu |

`NotificationsService.notify()` (jamais bloquant) est déclenché depuis :
- `OrdersService` : création, changement de statut, annulation
- `PaymentsService` : paiement validé / échoué
- `RemindersService` : rappel de retrait

## 5. Plats — recherche & filtres

`GET /dishes` accepte désormais `q`, `categorieId`, `prixMin`, `prixMax`, `disponible`.

## 6. Frontend

- `Cart.jsx` : sélection **date + créneau** (via `/settings/creneaux`), **mode de récupération**, **note**.
- `Menu.jsx` : recherche serveur (anti-rebond), filtre prix max, « disponibles uniquement », cloche de notifications.
- `components/NotificationsBell.jsx` : cloche + panneau, polling 20 s.
- `pages/admin/Dashboard.jsx` : stats serveur, plats populaires, **file de préparation priorisée**, onglet **Paramètres**.
