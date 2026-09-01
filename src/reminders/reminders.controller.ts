import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard, RoleGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

@ApiTags('reminders')
@Controller('reminders')
export class RemindersController {
  constructor(private remindersService: RemindersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'CHEF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister tous les rappels (Admin/Personnel)' })
  @ApiResponse({ status: 200, description: 'Liste de tous les rappels' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findAll() {
    return this.remindersService.findAll();
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'CHEF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les rappels en attente (Admin/Personnel)' })
  @ApiResponse({ status: 200, description: 'Liste des rappels en attente' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findPending() {
    return this.remindersService.findPending();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Statistiques des rappels (Admin)' })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async getStats() {
    return this.remindersService.getStats();
  }

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le rappel d\'une commande' })
  @ApiResponse({ status: 200, description: 'Rappel trouvé' })
  @ApiResponse({ status: 404, description: 'Rappel non trouvé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async findByOrderId(@Param('orderId') orderId: string) {
    return this.remindersService.findByOrderId(orderId);
  }
}
