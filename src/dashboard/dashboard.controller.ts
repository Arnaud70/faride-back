import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard, RoleGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('ADMIN', 'CHEF')
  @ApiOperation({ summary: "Statistiques d'activité du jour (Admin/Personnel)" })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('plats-populaires')
  @Roles('ADMIN', 'CHEF')
  @ApiOperation({ summary: 'Plats les plus commandés (30 derniers jours)' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Classement des plats' })
  async getPlatsPopulaires(@Query('limit') limit?: string) {
    return this.dashboardService.getPlatsPopulaires(limit ? Number(limit) : 5);
  }

  @Get('priorites')
  @Roles('ADMIN', 'CHEF')
  @ApiOperation({ summary: 'Commandes actives classées par priorité de préparation' })
  @ApiResponse({ status: 200, description: 'Commandes priorisées' })
  async getPriorites() {
    return this.dashboardService.getPriorites();
  }
}
