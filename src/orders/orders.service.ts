import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: 'en attente',
  EN_PREPARATION: 'en préparation',
  PRETE: 'prête',
  LIVREE: 'en livraison',
  RECUPEREE: 'récupérée',
  ANNULEE: 'annulée',
};

const ORDER_INCLUDE = {
  items: { include: { dish: true } },
  client: true,
  livreur: true,
  payment: true,
  reminder: true,
} as const;

/** Étape suivante autorisée selon le type de commande. */
const nextStatut = (
  orderType: string,
  current: string,
): string | undefined => {
  const livraison: Record<string, string> = {
    EN_ATTENTE: 'EN_PREPARATION',
    EN_PREPARATION: 'PRETE',
    PRETE: 'LIVREE',
    LIVREE: 'RECUPEREE',
  };
  const retrait: Record<string, string> = {
    EN_ATTENTE: 'EN_PREPARATION',
    EN_PREPARATION: 'PRETE',
    PRETE: 'RECUPEREE',
  };
  return (orderType === 'LIVRAISON' ? livraison : retrait)[current];
};

@Injectable()
export class OrdersService {
  constructor(
    private settingsService: SettingsService,
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const count = await this.prisma.order.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    return `CMD-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(clientId: string, createOrderDto: CreateOrderDto) {
    const { items, heureRetrait, orderType, notes } = createOrderDto;

    // Valider les items
    if (!items || items.length === 0) {
      throw new BadRequestException('La commande doit contenir au moins un plat');
    }

    // Récupérer tous les plats pour valider et calculer le total
    const dishIds = items.map((item) => item.dishId);
    const dishes = await this.prisma.dish.findMany({
      where: { id: { in: dishIds } },
    });

    if (dishes.length !== new Set(dishIds).size) {
      throw new BadRequestException('Un ou plusieurs plats n\'existent pas');
    }

    // Règle 1 : un client ne peut pas commander un plat indisponible
    const indisponibles = dishes.filter((dish) => !dish.disponible);
    if (indisponibles.length > 0) {
      throw new BadRequestException(
        `Plat(s) indisponible(s) : ${indisponibles.map((d) => d.nom).join(', ')}`,
      );
    }

    // Créer une map des plats pour accès rapide
    const dishMap = new Map(dishes.map((d) => [d.id, d]));

    // Valider l'heure de retrait selon les paramètres du restaurant
    const pickupTime = new Date(heureRetrait);
    const erreurCreneau = await this.settingsService.validatePickupTime(pickupTime);
    if (erreurCreneau) {
      throw new BadRequestException(erreurCreneau);
    }

    // Calculer le montant total (Règle 3 : calcul côté serveur)
    let montantTotal = new Decimal(0);
    const orderItems = items.map((item) => {
      const dish = dishMap.get(item.dishId);
      if (!dish) {
        throw new BadRequestException(`Plat ${item.dishId} non trouvé`);
      }
      montantTotal = montantTotal.plus(
        new Decimal(dish.prix.toString()).times(item.quantite),
      );
      return {
        dishId: item.dishId,
        quantite: item.quantite,
        prixUnitaire: dish.prix,
      };
    });

    // Créer la commande avec les items (retry sur collision du numéro)
    let order: any;
    for (let tentative = 0; tentative < 3; tentative++) {
      try {
        order = await this.prisma.order.create({
          data: {
            orderNumber: await this.generateOrderNumber(),
            clientId,
            statut: 'EN_ATTENTE',
            orderType: orderType ?? 'A_EMPORTER',
            heureRetrait: pickupTime,
            montantTotal,
            notes: notes ?? null,
            items: {
              createMany: {
                data: orderItems,
              },
            },
          },
          include: {
            items: { include: { dish: true } },
            client: true,
            livreur: true,
          },
        });
        break;
      } catch (error: any) {
        if (error?.code === 'P2002' && tentative < 2) continue;
        throw error;
      }
    }

    await this.notificationsService.notify(
      clientId,
      'Commande reçue',
      `Votre commande ${order.orderNumber} a bien été enregistrée. Retrait prévu à ${pickupTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
      'COMMANDE',
    );

    return order;
  }

  async findMyOrders(clientId: string) {
    return this.prisma.order.findMany({
      where: { clientId },
      include: {
        items: {
          include: {
            dish: true,
          },
        },
        payment: true,
        reminder: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(orderBy: 'heureRetrait' | 'createdAt' = 'heureRetrait', user?: any) {
    return this.prisma.order.findMany({
      where: user?.role === 'LIVREUR' ? { livreurId: user.id } : undefined,
      include: {
        items: {
          include: {
            dish: true,
          },
        },
        client: true,
        livreur: true,
        payment: true,
        reminder: true,
      },
      orderBy:
        orderBy === 'heureRetrait'
          ? { heureRetrait: 'asc' }
          : { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException(`Commande avec l'ID ${id} non trouvée`);
    }

    return order;
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateOrderStatusDto,
    role: string,
    userId?: string,
  ) {
    const order = await this.findOne(id);
    const target = updateStatusDto.statut;

    if (target === 'ANNULEE') {
      return this.cancel(id, role, userId);
    }

    if (['RECUPEREE', 'ANNULEE'].includes(order.statut)) {
      throw new BadRequestException('Cette commande est déjà terminée.');
    }

    // La seule progression possible dépend du type de commande (retrait / livraison).
    const expected = nextStatut(order.orderType, order.statut);
    if (target !== expected) {
      throw new BadRequestException(
        `Transition impossible : ${STATUT_LABELS[order.statut]} → ${STATUT_LABELS[target] ?? target}.`,
      );
    }

    // Qui a le droit de faire CETTE transition précise ?
    const step = `${order.statut}->${target}`;
    const permission: Record<string, () => boolean> = {
      'EN_ATTENTE->EN_PREPARATION': () => ['CHEF', 'ADMIN'].includes(role),
      'EN_PREPARATION->PRETE': () => ['CHEF', 'ADMIN'].includes(role),
      // retrait : le personnel remet la commande au client
      'PRETE->RECUPEREE': () => ['CHEF', 'ADMIN'].includes(role),
      // livraison : le livreur assigné (ou un admin) confirme la livraison
      'PRETE->LIVREE': () =>
        role === 'ADMIN' || (role === 'LIVREUR' && order.livreurId === userId),
      // livraison : c'est le client qui confirme avoir récupéré sa commande
      'LIVREE->RECUPEREE': () =>
        role === 'ADMIN' || (role === 'CLIENT' && order.clientId === userId),
    };

    if (!permission[step]?.()) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à effectuer ce changement de statut.",
      );
    }
    if (step === 'PRETE->LIVREE' && !order.livreurId) {
      throw new BadRequestException(
        "Aucun livreur n'est assigné à cette commande.",
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { statut: target },
      include: ORDER_INCLUDE,
    });

    const message =
      target === 'RECUPEREE'
        ? 'Votre commande a bien été récupérée. Merci !'
        : target === 'LIVREE'
          ? 'Votre commande est en cours de livraison.'
          : `Votre commande est maintenant ${STATUT_LABELS[target] ?? target}.`;
    await this.notificationsService.notify(
      updated.clientId,
      `Commande ${updated.orderNumber}`,
      message,
      'COMMANDE',
    );

    return updated;
  }

  async assignLivreur(id: string, livreurId: string) {
    const [order, livreur] = await Promise.all([
      this.findOne(id),
      this.prisma.user.findUnique({ where: { id: livreurId } }),
    ]);
    if (!livreur || livreur.role !== 'LIVREUR' || !livreur.actif) {
      throw new BadRequestException('Livreur actif introuvable');
    }
    if (order.orderType !== 'LIVRAISON') {
      throw new BadRequestException(
        "Cette commande n'est pas une commande à livrer.",
      );
    }
    if (order.statut !== 'PRETE') {
      throw new BadRequestException('La commande doit être prête avant sa livraison');
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { livreurId },
      include: ORDER_INCLUDE,
    });
    await this.notificationsService.notify(
      updated.clientId,
      `Commande ${updated.orderNumber}`,
      `Un livreur (${livreur.nom}) a été assigné à votre commande.`,
      'COMMANDE',
    );
    return updated;
  }

  async findTracking(id: string, clientId: string) {
    const order = await this.findOne(id);
    if (order.clientId !== clientId) {
      throw new NotFoundException('Commande non trouvée');
    }

    const stages =
      order.orderType === 'LIVRAISON'
        ? [
            { code: 'EN_ATTENTE', label: 'Reçue' },
            { code: 'EN_PREPARATION', label: 'En préparation' },
            { code: 'PRETE', label: 'Prête' },
            { code: 'LIVREE', label: 'En livraison' },
            { code: 'RECUPEREE', label: 'Récupérée' },
          ]
        : [
            { code: 'EN_ATTENTE', label: 'Reçue' },
            { code: 'EN_PREPARATION', label: 'En préparation' },
            { code: 'PRETE', label: 'Prête' },
            { code: 'RECUPEREE', label: 'Récupérée' },
          ];
    const currentIndex = stages.findIndex((stage) => stage.code === order.statut);

    const messages: Record<string, string> = {
      EN_PREPARATION: 'Votre commande est en cours de préparation.',
      PRETE:
        order.orderType === 'LIVRAISON'
          ? 'Votre commande est prête, un livreur va la prendre en charge.'
          : 'Votre commande est prête à être récupérée.',
      LIVREE:
        'Votre commande est en cours de livraison. Confirmez la réception une fois reçue.',
    };

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      statut: order.statut,
      orderType: order.orderType,
      heureRetrait: order.heureRetrait,
      montantTotal: order.montantTotal,
      client: order.client,
      livreur: order.livreur ?? null,
      items: order.items,
      timeline: stages.map((stage, index) => ({
        ...stage,
        termine: currentIndex >= index,
        actuel: currentIndex === index,
      })),
      message: messages[order.statut] ?? null,
    };
  }

  /**
   * Annulation.
   * - Client : uniquement tant que la commande est EN_ATTENTE (avant préparation).
   * - Chef / Admin : à tout moment sauf commande déjà récupérée ou annulée.
   */
  async cancel(id: string, role = 'ADMIN', userId?: string) {
    const order = await this.findOne(id);

    if (['RECUPEREE', 'ANNULEE', 'LIVREE'].includes(order.statut)) {
      throw new BadRequestException(
        'Cette commande ne peut plus être annulée.',
      );
    }

    if (role === 'CLIENT') {
      if (order.clientId !== userId) {
        throw new ForbiddenException('Accès refusé.');
      }
      if (order.statut !== 'EN_ATTENTE') {
        throw new BadRequestException(
          "Trop tard : votre commande est déjà en préparation. Contactez le restaurant pour l'annuler.",
        );
      }
    } else if (!['CHEF', 'ADMIN'].includes(role)) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à annuler cette commande.",
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { statut: 'ANNULEE' },
      include: ORDER_INCLUDE,
    });

    await this.notificationsService.notify(
      updated.clientId,
      `Commande ${updated.orderNumber}`,
      role === 'CLIENT'
        ? 'Votre commande a bien été annulée.'
        : 'Votre commande a été annulée par le restaurant.',
      'COMMANDE',
    );

    return updated;
  }
}
