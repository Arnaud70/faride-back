import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemindersService {
  private lastReminderCheck = new Date();

  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  // Tâche planifiée : vérifier les rappels toutes les 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAndCreateReminders() {
    console.log('🔔 Vérification des rappels...');

    // Récupérer les commandes avec une heure de retrait dans les 30 prochaines minutes
    const now = new Date();
    const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);

    const ordersNeedingReminder = await this.prisma.order.findMany({
      where: {
        heureRetrait: {
          gte: now,
          lte: in30Minutes,
        },
        statut: {
          in: ['EN_ATTENTE', 'EN_PREPARATION'], // Pas besoin de rappeler pour PRETE
        },
        // Vérifier qu'il n'y a pas déjà un rappel
        reminder: null,
      },
      include: {
        client: true,
        items: {
          include: { dish: true },
        },
      },
    });

    if (ordersNeedingReminder.length > 0) {
      console.log(`⏰ ${ordersNeedingReminder.length} commande(s) nécessitent un rappel`);

      for (const order of ordersNeedingReminder) {
        // Créer un rappel
        const reminder = await this.prisma.reminder.create({
          data: {
            orderId: order.id,
            heureDeclenchement: order.heureRetrait,
            envoye: false,
          },
        });

        console.log(
          `📧 Rappel créé pour ${order.client.nom} - Retrait à ${order.heureRetrait.toLocaleTimeString('fr-FR')}`,
        );

        await this.notificationsService.notify(
          order.clientId,
          'Rappel de retrait',
          `Votre commande sera à retirer à ${order.heureRetrait.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
          'RAPPEL',
        );

        // Afficher le rappel dans la console (en prod, ce serait WebSocket/email/SMS)
        console.log(
          `🎯 RAPPEL: ${order.client.nom} (${order.client.telephone}) doit retirer sa commande à ${order.heureRetrait.toLocaleTimeString('fr-FR')}`,
        );
      }
    }

    return {
      checked: ordersNeedingReminder.length,
      timestamp: new Date(),
    };
  }

  // Tâche planifiée : marquer les rappels comme envoyés si l'heure a passé
  @Cron(CronExpression.EVERY_MINUTE)
  async markRemindersAsSent() {
    const now = new Date();

    const sentReminders = await this.prisma.reminder.updateMany({
      where: {
        envoye: false,
        heureDeclenchement: {
          lte: now,
        },
      },
      data: {
        envoye: true,
      },
    });

    if (sentReminders.count > 0) {
      console.log(`✅ ${sentReminders.count} rappel(s) marqué(s) comme envoyé(s)`);
    }

    return sentReminders;
  }

  // Récupérer tous les rappels
  async findAll() {
    return this.prisma.reminder.findMany({
      include: {
        order: {
          include: {
            client: true,
            items: {
              include: { dish: true },
            },
          },
        },
      },
      orderBy: { heureDeclenchement: 'asc' },
    });
  }

  // Récupérer les rappels en attente
  async findPending() {
    return this.prisma.reminder.findMany({
      where: { envoye: false },
      include: {
        order: {
          include: {
            client: true,
            items: {
              include: { dish: true },
            },
          },
        },
      },
      orderBy: { heureDeclenchement: 'asc' },
    });
  }

  // Récupérer les rappels pour une commande
  async findByOrderId(orderId: string) {
    return this.prisma.reminder.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            client: true,
            items: {
              include: { dish: true },
            },
          },
        },
      },
    });
  }

  // Obtenir les statistiques des rappels
  async getStats() {
    const all = await this.prisma.reminder.findMany();
    const sent = await this.prisma.reminder.findMany({
      where: { envoye: true },
    });

    return {
      total: all.length,
      sent: sent.length,
      pending: all.length - sent.length,
    };
  }
}
