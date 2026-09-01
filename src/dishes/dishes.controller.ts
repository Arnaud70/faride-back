import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DishesService } from './dishes.service';
import { CreateDishDto, UpdateDishDto } from './dto/dish.dto';
import { JwtAuthGuard, RoleGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

@ApiTags('dishes')
@Controller('dishes')
export class DishesController {
  constructor(private dishesService: DishesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtenir tous les plats (recherche et filtres)' })
  @ApiQuery({ name: 'categorieId', required: false, description: 'Filtrer par catégorie' })
  @ApiQuery({ name: 'q', required: false, description: 'Recherche texte (nom ou description)' })
  @ApiQuery({ name: 'prixMin', required: false, description: 'Prix minimum' })
  @ApiQuery({ name: 'prixMax', required: false, description: 'Prix maximum' })
  @ApiQuery({ name: 'disponible', required: false, description: 'true / false' })
  @ApiResponse({ status: 200, description: 'Liste des plats' })
  async findAll(
    @Query('categorieId') categorieId?: string,
    @Query('q') q?: string,
    @Query('prixMin') prixMin?: string,
    @Query('prixMax') prixMax?: string,
    @Query('disponible') disponible?: string,
  ) {
    return this.dishesService.findAll({
      categorieId,
      q,
      prixMin: prixMin !== undefined && prixMin !== '' ? Number(prixMin) : undefined,
      prixMax: prixMax !== undefined && prixMax !== '' ? Number(prixMax) : undefined,
      disponible:
        disponible === undefined || disponible === ''
          ? undefined
          : disponible === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un plat par ID' })
  @ApiResponse({ status: 200, description: 'Plat trouvé' })
  @ApiResponse({ status: 404, description: 'Plat non trouvé' })
  async findOne(@Param('id') id: string) {
    return this.dishesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un nouveau plat (Admin)' })
  @ApiResponse({ status: 201, description: 'Plat créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async create(@Body() createDishDto: CreateDishDto) {
    return this.dishesService.create(createDishDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un plat (Admin)' })
  @ApiResponse({ status: 200, description: 'Plat mis à jour' })
  @ApiResponse({ status: 404, description: 'Plat non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async update(
    @Param('id') id: string,
    @Body() updateDishDto: UpdateDishDto,
  ) {
    return this.dishesService.update(id, updateDishDto);
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'CHEF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Basculer la disponibilité d\'un plat (Admin/Personnel)' })
  @ApiResponse({ status: 200, description: 'Disponibilité mise à jour' })
  @ApiResponse({ status: 404, description: 'Plat non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async toggleAvailability(@Param('id') id: string) {
    return this.dishesService.toggleAvailability(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un plat (Admin)' })
  @ApiResponse({ status: 200, description: 'Plat supprimé' })
  @ApiResponse({ status: 404, description: 'Plat non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async remove(@Param('id') id: string) {
    return this.dishesService.remove(id);
  }
}
