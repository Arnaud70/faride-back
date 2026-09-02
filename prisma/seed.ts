import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Decimal } from 'decimal.js';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Neon serverless peut être suspendu : on retente la connexion.
async function connectWithRetry(tries = 6) {
  for (let i = 1; i <= tries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (i === tries) throw error;
      console.log(`⏳ Base injoignable (${i}/${tries}), nouvelle tentative…`);
      await new Promise((r) => setTimeout(r, Math.min(1500 * i, 6000)));
    }
  }
}

async function main() {
  console.log('🌱 Amorçage de la base de données...');
  await connectWithRetry();

  // Créer des utilisateurs de test — les mots de passe sont (re)forcés à chaque
  // exécution du seed pour que les comptes de démo fonctionnent toujours.
  const adminUser = await prisma.user.upsert({
    where: { telephone: '+22892000001' },
    update: {
      motDePasseHash: await bcrypt.hash('AdminPassword123', 10),
      role: 'ADMIN',
      actif: true,
    },
    create: {
      nom: 'Admin Ébène',
      telephone: '+22892000001',
      email: 'admin@saveursebene.tg',
      motDePasseHash: await bcrypt.hash('AdminPassword123', 10),
      role: 'ADMIN',
    },
  });

  const personnelUser = await prisma.user.upsert({
    where: { telephone: '+22892000002' },
    update: {
      motDePasseHash: await bcrypt.hash('ChefPassword123', 10),
      role: 'CHEF',
      actif: true,
    },
    create: {
      nom: 'Chef Cuisine',
      telephone: '+22892000002',
      email: 'chef@saveursebene.tg',
      motDePasseHash: await bcrypt.hash('ChefPassword123', 10),
      role: 'CHEF',
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { telephone: '+22892000003' },
    update: {
      motDePasseHash: await bcrypt.hash('ClientPassword123', 10),
      role: 'CLIENT',
      actif: true,
    },
    create: {
      nom: 'Client Demo',
      telephone: '+22892000003',
      email: 'client@example.com',
      motDePasseHash: await bcrypt.hash('ClientPassword123', 10),
      role: 'CLIENT',
    },
  });

  const livreurs = await Promise.all([
    prisma.user.upsert({
      where: { telephone: '+22892000004' },
      update: { role: 'LIVREUR', actif: true },
      create: {
        nom: 'Livreur Test 1',
        telephone: '+22892000004',
        email: 'livreur1@saveursebene.tg',
        motDePasseHash: await bcrypt.hash('LivreurPassword123', 10),
        role: 'LIVREUR',
      },
    }),
    prisma.user.upsert({
      where: { telephone: '+22892000005' },
      update: { role: 'LIVREUR', actif: true },
      create: {
        nom: 'Livreur Test 2',
        telephone: '+22892000005',
        email: 'livreur2@saveursebene.tg',
        motDePasseHash: await bcrypt.hash('LivreurPassword123', 10),
        role: 'LIVREUR',
      },
    }),
    prisma.user.upsert({
      where: { telephone: '+22892000006' },
      update: { role: 'LIVREUR', actif: true },
      create: {
        nom: 'Livreur Test 3',
        telephone: '+22892000006',
        email: 'livreur3@saveursebene.tg',
        motDePasseHash: await bcrypt.hash('LivreurPassword123', 10),
        role: 'LIVREUR',
      },
    }),
  ]);

  // Créer les catégories de menu
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { nom: 'Plats Principaux' },
      update: {},
      create: { nom: 'Plats Principaux' },
    }),
    prisma.category.upsert({
      where: { nom: 'Pizzas' },
      update: {},
      create: { nom: 'Pizzas' },
    }),
    prisma.category.upsert({
      where: { nom: 'Sandwichs & Burgers' },
      update: {},
      create: { nom: 'Sandwichs & Burgers' },
    }),
    prisma.category.upsert({
      where: { nom: 'Boissons' },
      update: {},
      create: { nom: 'Boissons' },
    }),
  ]);

  // Créer des plats de démonstration
  const plaitsChef: Array<any> = [
    {
      nom: 'Riz au Gras Saveur',
      description: 'Riz cuit à la sauce tomate avec des légumes et protéines',
      prix: new Decimal('2500'),
      dureeCuissonMinutes: 25,
      disponible: true,
      categorieId: categories[0].id,
    },
    {
      nom: 'Poulet Braisé',
      description: 'Poulet tendre braisé avec sauce épicée',
      prix: new Decimal('3000'),
      dureeCuissonMinutes: 35,
      disponible: true,
      categorieId: categories[0].id,
    },
    {
      nom: 'Poisson Braisé',
      description: 'Poisson frais braisé avec sauce arachide',
      prix: new Decimal('3500'),
      dureeCuissonMinutes: 30,
      disponible: true,
      categorieId: categories[0].id,
    },
    {
      nom: 'Fufu Sauce Arachide',
      description: 'Fufu traditionnel avec sauce riche à l\'arachide',
      prix: new Decimal('2000'),
      dureeCuissonMinutes: 25,
      disponible: true,
      categorieId: categories[0].id,
    },
    {
      nom: 'Pâte Sauce Gombo',
      description: 'Pâte de maïs avec sauce gombo et protéines',
      prix: new Decimal('2000'),
      dureeCuissonMinutes: 20,
      disponible: true,
      categorieId: categories[0].id,
    },
    {
      nom: 'Pizza Margherita',
      description: 'Pizza classique avec tomate, mozzarella et basilic',
      prix: new Decimal('4000'),
      dureeCuissonMinutes: 20,
      disponible: true,
      categorieId: categories[1].id,
    },
    {
      nom: 'Pizza Épicée',
      description: 'Pizza garnie de viande épicée et fromage',
      prix: new Decimal('4500'),
      dureeCuissonMinutes: 25,
      disponible: true,
      categorieId: categories[1].id,
    },
    {
      nom: 'Chawarma Poulet',
      description: 'Sandwich chawarma avec poulet braisé et sauce spéciale',
      prix: new Decimal('2500'),
      dureeCuissonMinutes: 15,
      disponible: true,
      categorieId: categories[2].id,
    },
    {
      nom: 'Hamburger Saveur',
      description: 'Hamburger juteux avec fromage et légumes frais',
      prix: new Decimal('2000'),
      dureeCuissonMinutes: 15,
      disponible: true,
      categorieId: categories[2].id,
    },
    {
      nom: 'Jus Naturel Papaye',
      description: 'Jus frais de papaye locale',
      prix: new Decimal('800'),
      dureeCuissonMinutes: 10,
      disponible: true,
      categorieId: categories[3].id,
    },
    {
      nom: 'Jus Naturel Gingembre',
      description: 'Jus tonifiant au gingembre',
      prix: new Decimal('800'),
      dureeCuissonMinutes: 10,
      disponible: true,
      categorieId: categories[3].id,
    },
    {
      nom: 'Eau Fraîche Glacée',
      description: 'Eau glacée bien fraîche',
      prix: new Decimal('500'),
      dureeCuissonMinutes: 5,
      disponible: true,
      categorieId: categories[3].id,
    },
  ];


  for (const plat of plaitsChef) {
    await prisma.dish.updateMany({
      where: { nom: plat.nom },
      data: { dureeCuissonMinutes: plat.dureeCuissonMinutes },
    });

    await prisma.dish.upsert({
      where: { id: `${plat.nom}-id` },
      update: {},
      create: {
        nom: plat.nom,
        description: plat.description,
        prix: new Decimal(plat.prix.toString()),
        dureeCuissonMinutes: plat.dureeCuissonMinutes,
        disponible: plat.disponible,
        categorieId: plat.categorieId,
      },
    });
  }

  // Paramètres du restaurant (ligne unique)
  const existingSettings = await prisma.restaurantSetting.findFirst();
  if (!existingSettings) {
    await prisma.restaurantSetting.create({
      data: {
        nomRestaurant: "Saveurs d'Ébène",
        adresse: 'Agoè-Nyivé, Lomé - Togo',
        telephone: '+228 90 00 00 00',
        heureOuverture: '10:00',
        heureFermeture: '22:00',
        intervalleCreneauxMin: 30,
        bufferPreparationMin: 15,
        maxCommandesParCreneau: 5,
      },
    });
    console.log('⚙️  Paramètres du restaurant initialisés');
  }

  console.log('✅ Base de données amorçée avec succès!');
  console.log('👤 Utilisateurs de test créés:');
  console.log(`   - Admin: ${adminUser.telephone} / AdminPassword123`);
  console.log(`   - Personnel: ${personnelUser.telephone} / ChefPassword123`);
  console.log(`   - Client: ${clientUser.telephone} / ClientPassword123`);
  livreurs.forEach((livreur, index) => {
    console.log(`   - Livreur ${index + 1}: ${livreur.email} / LivreurPassword123`);
  });
  console.log(`📁 ${categories.length} catégories et ${plaitsChef.length} plats ajoutés`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de l\'amorçage:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
