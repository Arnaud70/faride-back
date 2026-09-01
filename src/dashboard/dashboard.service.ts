import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';

type Priorite = 'URGENT' | 'A_PREPARER' | 'PROGRAMMEE';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private bornesDuJour() {
    const now = new Date();
    const debut = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const fin = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return { debut, fin };
  }

  async getStats() {
    const { debut, fin } = this.bornesDuJour();

    const commandesDuJour = await this.prisma.order.findMany({
      where: { createdAt: { gte: debut, lt: fin } },
      include: { payment: true },
    });

    const parStatut: Record<string, number> = {
      EN_ATTENTE: 0,
      EN_PREPARATION: 0,
      PRETE: 0,
      LIVREE: 0,
      RECUPEREE: 0,
      ANNULEE: 0,
    };
    for (const commande of commandesDuJour) {
      parStatut[commande.statut] = (parStatut[commande.statut] ?? 0) + 1;
    }

    const chiffreAffaires = commandesDuJour
      .filter((c) => c.payment?.statut === 'VALIDE')
      .reduce((total, c) => total.plus(new Decimal(c.montantTotal.toString())), new Decimal(0));

    const panierMoyen = commandesDuJour.length
      ? chiffreAffaires.dividedBy(commandesDuJour.length).toDecimalPlaces(0)
      : new Decimal(0);

    return {
      commandesAujourdhui: commandesDuJour.length,
      parStatut,
      enAttente: parStatut.EN_ATTENTE,
      enPreparation: parStatut.EN_PREPARATION,
      pretes: parStatut.PRETE,
      chiffreAffaires: chiffreAffaires.toNumber(),
      panierMoyen: panierMoyen.toNumber(),
    };
  }

  async getPlatsPopulaires(limit = 5) {
    const depuis = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const groupes = await this.prisma.orderItem.groupBy({
      by: ['dishId'],
      _sum: { quantite: true },
      where: { order: { createdAt: { gte: depuis }, statut: { not: 'ANNULEE' } } },
      orderBy: { _sum: { quantite: 'desc' } },
      take: limit,
    });

    const dishes = await this.prisma.dish.findMany({
      where: { id: { in: groupes.map((g) => g.dishId) } },
      include: { categorie: true },
    });
    const dishMap = new Map(dishes.map((d) => [d.id, d]));

    return groupes.map((g) => ({
      dishId: g.dishId,
      nom: dishMap.get(g.dishId)?.nom ?? 'Plat supprimé',
      categorie: dishMap.get(g.dishId)?.categorie?.nom ?? null,
      quantiteVendue: g._sum.quantite ?? 0,
    }));
  }

  async getPriorites() {
    const settings = await this.prisma.restaurantSetting.findFirst();
    const seuilAPreparer = 30; // minutes

    const commandes = await this.prisma.order.findMany({
      where: { statut: { in: ['EN_ATTENTE', 'EN_PREPARATION'] } },
      include: { items: { include: { dish: true } }, client: true },
      orderBy: { heureRetrait: 'asc' },
    });

    const now = Date.now();

    const resultat = commandes.map((commande) => {
      const dureePreparation = commande.items.reduce(
        (max, item) => Math.max(max, item.dish?.dureeCuissonMinutes ?? 20),
        20,
      );
      const buffer = settings?.bufferPreparationMin ?? 0;
      const debutPreparation = new Date(
        commande.heureRetrait.getTime() - (dureePreparation + buffer) * 60 * 1000,
      );
      const minutesAvantDebut = Math.round((debutPreparation.getTime() - now) / 60000);

      let priorite: Priorite;
      if (minutesAvantDebut <= 0 || commande.statut === 'EN_PREPARATION') {
        priorite = 'URGENT';
      } else if (minutesAvantDebut <= seuilAPreparer) {
        priorite = 'A_PREPARER';
      } else {
        priorite = 'PROGRAMMEE';
      }

      return {
        id: commande.id,
        orderNumber: commande.orderNumber,
        client: commande.client
          ? { nom: commande.client.nom, telephone: commande.client.telephone }
          : null,
        statut: commande.statut,
        heureRetrait: commande.heureRetrait,
        dureePreparationMin: dureePreparation,
        debutPreparationRecommande: debutPreparation,
        minutesAvantDebut,
        priorite,
        items: commande.items.map((item) => ({
          nom: item.dish?.nom ?? 'Plat supprimé',
          quantite: item.quantite,
        })),
      };
    });

    const ordre: Record<Priorite, number> = { URGENT: 0, A_PREPARER: 1, PROGRAMMEE: 2 };
    resultat.sort(
      (a, b) =>
        ordre[a.priorite] - ordre[b.priorite] ||
        a.heureRetrait.getTime() - b.heureRetrait.getTime(),
    );

    return resultat;
  }
}
