import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType = 'COMMANDE' | 'PAIEMENT' | 'RAPPEL' | 'SYSTEME';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** Crée une notification. Ne lève jamais : une notification ratée ne doit pas casser le flux métier. */
  async notify(
    userId: string,
    titre: string,
    message: string,
    type: NotificationType = 'SYSTEME',
  ) {
    try {
      return await this.prisma.notification.create({
        data: { userId, titre, message, type },
      });
    } catch (error) {
      console.error('Notification non créée:', error);
      return null;
    }
  }

  async findMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, lu: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification non trouvée');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { lu: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, lu: false },
      data: { lu: true },
    });
  }
}
