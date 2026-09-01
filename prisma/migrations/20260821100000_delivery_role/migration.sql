ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'LIVREUR';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'LIVREE';

ALTER TABLE "orders" ADD COLUMN "livreurId" TEXT;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_livreurId_fkey"
FOREIGN KEY ("livreurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orders_livreurId_idx" ON "orders"("livreurId");
