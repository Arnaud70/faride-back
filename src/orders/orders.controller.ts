import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { JwtAuthGuard, RoleGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('CLIENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer une nouvelle commande (Client)' })
  @ApiResponse({ status: 201, description: 'Commande créée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: any) {
    return this.ordersService.create(user.id, createOrderDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('CLIENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer mes commandes (Client)' })
  @ApiResponse({ status: 200, description: 'Liste des commandes du client' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async getMyOrders(@CurrentUser() user: any) {
    return this.ordersService.findMyOrders(user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'CHEF', 'LIVREUR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister toutes les commandes (Admin/Personnel)' })
  @ApiResponse({ status: 200, description: 'Liste de toutes les commandes' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findAll(
    @Query('orderBy') orderBy?: 'heureRetrait' | 'createdAt',
    @CurrentUser() user?: any,
  ) {
    return this.ordersService.findAll(orderBy, user);
  }

  @Patch(':id/assign-livreur/:livreurId')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'CHEF')
  @ApiBearerAuth()
  async assignLivreur(@Param('id') id: string, @Param('livreurId') livreurId: string) {
    return this.ordersService.assignLivreur(id, livreurId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer une commande par ID' })
  @ApiResponse({ status: 200, description: 'Commande trouvée' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role === 'CLIENT') {
      const order = await this.ordersService.findOne(id);
      if (order.clientId !== user.id) throw new ForbiddenException('Accès refusé');
      return order;
    }
    return this.ordersService.findOne(id);
  }

  @Get(':id/tracking')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('CLIENT')
  @ApiBearerAuth()
  async tracking(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findTracking(id, user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'CHEF', 'LIVREUR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une commande (Admin/Personnel)' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, updateStatusDto, user.role, user.id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Annuler une commande' })
  @ApiResponse({ status: 200, description: 'Commande annulée' })
  @ApiResponse({ status: 400, description: 'Impossible d\'annuler' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    const order = await this.ordersService.findOne(id);
    if (user.role === 'CLIENT' && order.clientId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }
    if (!['CLIENT', 'ADMIN', 'CHEF'].includes(user.role)) {
      throw new ForbiddenException('Seul le client, le chef ou l\'administrateur peut annuler une commande');
    }
    return this.ordersService.cancel(id);
  }
}
