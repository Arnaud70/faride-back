-- Ajoute le statut "EN_ROUTE" (livreur en route pour la livraison)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EN_ROUTE';
