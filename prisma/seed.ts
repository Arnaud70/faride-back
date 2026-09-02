import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Decimal } from 'decimal.js';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isTransient = (error: any) => {
  const code = error?.code;
  const msg = String(error?.message ?? '');
  return (
    ['P1001', 'P1002', 'P1008', 'P1017'].includes(code) ||
    ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'Closed', 'terminated', 'not reachable'].some((h) =>
      msg.includes(h),
    )
  );
};

/**
 * Rejoue `fn` sur erreur transitoire. Le seed n'utilisant que des `upsert`
 * idempotents, on peut relancer tout le bloc sans risque de doublon.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === tries || !isTransient(error)) throw error;
      const delay = Math.min(2000 * i, 8000);
      console.log(`⏳ ${label} : base endormie (${i}/${tries - 1}), nouvel essai dans ${delay} ms…`);
      await sleep(delay);
    }
  }
  throw new Error('unreachable');
}

async function main() {
  console.log('🌱 Amorçage de la base de données...');
  await withRetry('connexion', () => prisma.$queryRaw`SELECT 1`);
  await withRetry('amorçage', seed);
}

async function seed() {

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

  // Séquentiel (pas de Promise.all) : moins de pression sur une base Neon
  // qui vient de se réveiller.
  const livreurHash = await bcrypt.hash('LivreurPassword123', 10);
  const livreurs: Array<Awaited<ReturnType<typeof prisma.user.upsert>>> = [];
  for (const [index, telephone] of ['+22892000004', '+22892000005', '+22892000006'].entries()) {
    livreurs.push(
      await prisma.user.upsert({
        where: { telephone },
        update: { role: 'LIVREUR', actif: true },
        create: {
          nom: `Livreur Test ${index + 1}`,
          telephone,
          email: `livreur${index + 1}@saveursebene.tg`,
          motDePasseHash: livreurHash,
          role: 'LIVREUR',
        },
      }),
    );
  }

  // Créer les catégories de menu
  const categories: Array<Awaited<ReturnType<typeof prisma.category.upsert>>> = [];
  for (const nom of ['Plats Principaux', 'Pizzas', 'Sandwichs & Burgers', 'Boissons']) {
    categories.push(
      await prisma.category.upsert({ where: { nom }, update: {}, create: { nom } }),
    );
  }

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
