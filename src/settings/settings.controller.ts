import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/settings.dto';
import { JwtAuthGuard, RoleGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer les paramètres du restaurant' })
  @ApiResponse({ status: 200, description: 'Paramètres du restaurant' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Get('creneaux')
  @ApiOperation({ summary: 'Lister les créneaux de retrait disponibles pour une date' })
  @ApiQuery({ name: 'date', required: false, description: 'Date au format YYYY-MM-DD (défaut: aujourd\'hui)' })
  @ApiResponse({ status: 200, description: 'Liste des créneaux' })
  async getCreneaux(@Query('date') date?: string) {
    return this.settingsService.getAvailableSlots(date);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour les paramètres du restaurant (Admin)' })
  @ApiResponse({ status: 200, description: 'Paramètres mis à jour' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
