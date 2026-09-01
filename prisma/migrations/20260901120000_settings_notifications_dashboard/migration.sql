-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('A_EMPORTER', 'LIVRAISON', 'SUR_PLACE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COMMANDE', 'PAIEMENT', 'RAPPEL', 'SYSTEME');

-- AlterTable "categories"
ALTER TABLE "categories" ADD COLUMN "description" TEXT;
ALTER TABLE "categories" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "categories" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "categories" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable "orders"
ALTER TABLE "orders" ADD COLUMN "orderNumber" TEXT;
ALTER TABLE "orders" ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'A_EMPORTER';
ALTER TABLE "orders" ADD COLUMN "notes" TEXT;

-- Backfill orderNumber for existing rows
WITH numbered AS (
  SELECT "id",
         'CMD-' || TO_CHAR("createdAt", 'YYYY') || '-' ||
         LPAD(ROW_NUMBER() OVER (
           PARTITION BY TO_CHAR("createdAt", 'YYYY')
           ORDER BY "createdAt"
         )::text, 4, '0') AS generated
  FROM "orders"
)
UPDATE "orders" o
SET "orderNumber" = n.generated
FROM numbered n
WHERE o."id" = n."id" AND o."orderNumber" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "orderNumber" SET NOT NULL;

-- CreateTable "restaurant_settings"
CREATE TABLE "restaurant_settings" (
    "id" TEXT NOT NULL,
    "nomRestaurant" TEXT NOT NULL DEFAULT 'Saveurs d''Ébène',
    "adresse" TEXT NOT NULL DEFAULT 'Agoè-Nyivé, Lomé - Togo',
    "telephone" TEXT NOT NULL DEFAULT '+228 00 00 00 00',
    "heureOuverture" TEXT NOT NULL DEFAULT '10:00',
    "heureFermeture" TEXT NOT NULL DEFAULT '22:00',
    "intervalleCreneauxMin" INTEGER NOT NULL DEFAULT 30,
    "bufferPreparationMin" INTEGER NOT NULL DEFAULT 15,
    "maxCommandesParCreneau" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable "notifications"
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEME',
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE INDEX "orders_statut_idx" ON "orders"("statut");
CREATE INDEX "orders_heureRetrait_idx" ON "orders"("heureRetrait");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
CREATE INDEX "dishes_categorieId_idx" ON "dishes"("categorieId");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default settings row
INSERT INTO "restaurant_settings" ("id") VALUES (gen_random_uuid());
