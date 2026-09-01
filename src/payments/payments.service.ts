import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SimulatePaymentDto } from './dto/payment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  async simulatePayment(orderId: string, simulatePaymentDto: SimulatePaymentDto) {
    // Vérifier que la commande existe
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Commande avec l'ID ${orderId} non trouvée`);
    }

    // Vérifier qu'aucun paiement n'existe déjà
    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (existingPayment) {
      throw new BadRequestException('Un paiement existe déjà pour cette commande');
    }

    // Simuler un paiement
    // Par défaut, 80% de réussite sauf si le statut est spécifié
    const statut =
      simulatePaymentDto.statut ||
      (Math.random() > 0.2 ? 'VALIDE' : 'ECHOUE');

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        methode: simulatePaymentDto.methode,
        statut: statut as 'VALIDE' | 'ECHOUE',
        montant: order.montantTotal,
      },
    });

    await this.notificationsService.notify(
      order.clientId,
      statut === 'VALIDE' ? 'Paiement confirmé' : 'Paiement échoué',
      statut === 'VALIDE'
        ? `Le paiement de ${order.montantTotal} FCA a été validé.`
        : `Le paiement de ${order.montantTotal} FCA a échoué, veuillez réessayer.`,
      'PAIEMENT',
    );

    return {
      ...payment,
      message: `Paiement ${statut === 'VALIDE' ? 'réussi' : 'échoué'} par ${simulatePaymentDto.methode}`,
    };
  }

  async findByOrderId(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment) {
      throw new NotFoundException(`Aucun paiement trouvé pour la commande ${orderId}`);
    }

    return payment;
  }

  async findAll() {
    return this.prisma.payment.findMany({
      include: {
        order: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPaymentStats() {
    const payments = await this.prisma.payment.findMany();

    const stats = {
      total: payments.length,
      valides: payments.filter(p => p.statut === 'VALIDE').length,
      echoues: payments.filter(p => p.statut === 'ECHOUE').length,
      montantTotal: payments
        .filter(p => p.statut === 'VALIDE')
        .reduce((sum, p) => sum + parseFloat(p.montant.toString()), 0),
      parMethode: {
        ESPECES: payments.filter(p => p.methode === 'ESPECES').length,
        MOBILE_MONEY_SIMULE: payments.filter(
          p => p.methode === 'MOBILE_MONEY_SIMULE',
        ).length,
        CARTE_SIMULEE: payments.filter(p => p.methode === 'CARTE_SIMULEE')
          .length,
      },
    };

    return stats;
  }
}
