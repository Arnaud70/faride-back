import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { SimulatePaymentDto } from './dto/payment.dto';
import { JwtAuthGuard, RoleGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post(':orderId/simulate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simuler un paiement pour une commande' })
  @ApiResponse({ status: 201, description: 'Paiement simulé' })
  @ApiResponse({ status: 400, description: 'Commande inexistante ou paiement existant' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async simulatePayment(
    @Param('orderId') orderId: string,
    @Body() simulatePaymentDto: SimulatePaymentDto,
  ) {
    return this.paymentsService.simulatePayment(orderId, simulatePaymentDto);
  }

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le paiement d\'une commande' })
  @ApiResponse({ status: 200, description: 'Paiement trouvé' })
  @ApiResponse({ status: 404, description: 'Paiement non trouvé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async findByOrderId(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrderId(orderId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister tous les paiements (Admin)' })
  @ApiResponse({ status: 200, description: 'Liste de tous les paiements' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findAll() {
    return this.paymentsService.findAll();
  }

  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Statistiques des paiements (Admin)' })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async getStats() {
    return this.paymentsService.getPaymentStats();
  }
}
