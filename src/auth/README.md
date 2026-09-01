# Module d'Authentification - Saveurs d'Ébène

## Description

Ce module gère l'authentification des utilisateurs (clients et personnel du restaurant) via JWT (JSON Web Tokens).

## Fonctionnalités

- ✅ Inscription des clients (nom, téléphone, email, mot de passe)
- ✅ Connexion avec téléphone et mot de passe
- ✅ Génération de tokens JWT (access token + refresh token)
- ✅ Guards JWT pour protéger les endpoints
- ✅ RoleGuard pour contrôle d'accès basé sur les rôles
- ✅ Hachage sécurisé des mots de passe avec bcrypt

## Endpoints

### `POST /auth/register`
Inscription d'un nouveau client ou personnel

**Body:**
```json
{
  "nom": "Jean Dupont",
  "telephone": "+22891234567",
  "email": "jean@example.com",
  "motDePasse": "SecurePassword123"
}
```

**Réponse (201):**
```json
{
  "message": "Inscription réussie",
  "user": {
    "id": "uuid",
    "nom": "Jean Dupont",
    "telephone": "+22891234567",
    "email": "jean@example.com",
    "role": "CLIENT"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### `POST /auth/login`
Connexion d'un utilisateur existant

**Body:**
```json
{
  "telephone": "+22891234567",
  "motDePasse": "SecurePassword123"
}
```

**Réponse (200):**
```json
{
  "message": "Connexion réussie",
  "user": {
    "id": "uuid",
    "nom": "Jean Dupont",
    "telephone": "+22891234567",
    "email": "jean@example.com",
    "role": "CLIENT"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### `POST /auth/refresh`
Renouvellement du token d'accès

**Headers:**
```
Authorization: Bearer <refreshToken>
```

**Réponse (200):**
```json
{
  "message": "Token actualisé",
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

## Utilisation dans d'autres modules

### Protéger un endpoint avec JWT
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards';

@Controller('users')
export class UsersController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@CurrentUser() user) {
    return user;
  }
}
```

### Protéger par rôle
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RoleGuard } from './auth/guards';
import { Roles } from './auth/decorators';

@Controller('dishes')
export class DishesController {
  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  createDish(@Body() createDishDto: CreateDishDto) {
    // Créer un plat
  }
}
```

### Accéder à l'utilisateur courant
```typescript
import { CurrentUser } from './auth/decorators';

@Get('me')
@UseGuards(JwtAuthGuard)
getCurrentUser(@CurrentUser() user) {
  return user;
}
```

## Structure des tokens JWT

**Payload:**
```json
{
  "sub": "user-id-uuid",
  "role": "CLIENT|PERSONNEL|ADMIN",
  "iat": 1234567890,
  "exp": 1234568790
}
```

## Rôles disponibles

- **CLIENT** : Client qui passe des commandes (défaut)
- **PERSONNEL** : Personnel du restaurant qui prépare les commandes
- **ADMIN** : Administrateur avec accès à tous les endpoints

## Schéma de sécurité

- Mots de passe hachés avec bcrypt (salt: 10)
- Access token: expire en 15 minutes
- Refresh token: expire en 7 jours
- JWT_SECRET: À configurer dans le fichier `.env`

## Variables d'environnement

```env
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```
