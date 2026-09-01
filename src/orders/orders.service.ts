import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
      include: {
        items: {
          include: {
            dish: true,
          },
        },
        client: true,
        payment: true,
        reminder: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Commande avec l'ID ${id} non trouvée`);
    }

    return order;
  }

  async updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto, role: string, userId?: string) {
    const order = await this.findOne(id);

    const transitions: Record<string, string[]> = {
      EN_ATTENTE: ['EN_PREPARATION'],
      EN_PREPARATION: ['PRETE'],
      PRETE: ['LIVREE'],
      LIVREE: ['RECUPEREE'],
    };
    const allowed = transitions[order.statut] || [];
    if (role === 'LIVREUR' && (!order.livreurId || order.livreurId !== userId || !['LIVREE', 'RECUPEREE'].includes(updateStatusDto.statut))) {
      throw new BadRequestException('Ce livreur ne peut pas modifier cette commande');
    }
    if (role === 'CHEF' && updateStatusDto.statut === 'ANNULEE') {
      return this.cancel(id);
    }
    if (!['ADMIN', 'CHEF'].includes(role) && role !== 'LIVREUR' && !allowed.includes(updateStatusDto.statut)) {
      throw new BadRequestException(
        `Transition impossible : ${order.statut} vers ${updateStatusDto.statut}`,
      );
    }
    if (['ADMIN', 'CHEF'].includes(role) && updateStatusDto.statut === 'ANNULEE' && order.statut === 'RECUPEREE') {
      throw new BadRequestException('Une commande récupérée ne peut pas être annulée');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { statut: updateStatusDto.statut },
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
    });

    await this.notificationsService.notify(
      updated.clientId,
      `Commande ${updated.orderNumber}`,
      `Votre commande est maintenant ${STATUT_LABELS[updated.statut] ?? updated.statut}.`,
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
    if (order.statut !== 'PRETE') {
      throw new BadRequestException('La commande doit être prête avant sa livraison');
    }
    return this.prisma.order.update({
      where: { id },
      data: { livreurId },
      include: { items: { include: { dish: true } }, client: true, livreur: true, payment: true },
    });
  }

  async findTracking(id: string, clientId: string) {
    const order = await this.findOne(id);
    if (order.clientId !== clientId) {
      throw new NotFoundException('Commande non trouvée');
    }

    const stages = [
      { code: 'EN_ATTENTE', label: 'Reçue' },
      { code: 'EN_PREPARATION', label: 'En préparation' },
      { code: 'PRETE', label: 'Prête' },
      { code: 'RECUPEREE', label: 'Récupérée' },
    ];
    const currentIndex = stages.findIndex((stage) => stage.code === order.statut);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      statut: order.statut,
      heureRetrait: order.heureRetrait,
      montantTotal: order.montantTotal,
      client: order.client,
      items: order.items,
      timeline: stages.map((stage, index) => ({
        ...stage,
        termine: currentIndex >= index,
        actuel: currentIndex === index,
      })),
      message: order.statut === 'PRETE'
        ? 'Votre commande est prête à être récupérée.'
        : order.statut === 'EN_PREPARATION'
          ? 'Votre commande est en cours de préparation.'
          : null,
    };
  }

  async cancel(id: string) {
    const order = await this.findOne(id);

    // Vérifier si la commande peut être annulée
    if (order.statut === 'RECUPEREE' || order.statut === 'ANNULEE') {
      throw new BadRequestException(
        `Impossible d'annuler une commande avec le statut ${order.statut}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { statut: 'ANNULEE' },
      include: {
        items: {
          include: {
            dish: true,
          },
        },
        client: true,
        payment: true,
        reminder: true,
      },
    });

    await this.notificationsService.notify(
      updated.clientId,
      `Commande ${updated.orderNumber}`,
      'Votre commande a été annulée.',
      'COMMANDE',
    );

    return updated;
  }
}
