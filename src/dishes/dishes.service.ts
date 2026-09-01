import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { CreateDishDto, UpdateDishDto } from './dto/dish.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DishesService {
  constructor(private prisma: PrismaService) {}

  async create(createDishDto: CreateDishDto) {
    const { nom, description, prix, dureeCuissonMinutes, categorieId, disponible, imageUrl } = createDishDto;

    // Vérifier que la catégorie existe
    const category = await this.prisma.category.findUnique({
      where: { id: categorieId },
    });

    if (!category) {
      throw new BadRequestException(`Catégorie avec l'ID ${categorieId} non trouvée`);
    }

    const dish = await this.prisma.dish.create({
      data: {
        nom,
        description: description || null,
        prix: new Decimal(prix.toString()),
        dureeCuissonMinutes,
        categorieId,
        disponible: disponible ?? true,
        imageUrl: imageUrl || null,
      },
      include: { categorie: true },
    });

    return dish;
  }

  async findAll(filters: {
    categorieId?: string;
    q?: string;
    prixMin?: number;
    prixMax?: number;
    disponible?: boolean;
  } = {}) {
    const { categorieId, q, prixMin, prixMax, disponible } = filters;

    const where: any = {};
    if (categorieId) where.categorieId = categorieId;
    if (disponible !== undefined) where.disponible = disponible;
    if (q && q.trim()) {
      where.OR = [
        { nom: { contains: q.trim(), mode: 'insensitive' } },
        { description: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    if (prixMin !== undefined || prixMax !== undefined) {
      where.prix = {};
      if (prixMin !== undefined) where.prix.gte = prixMin;
      if (prixMax !== undefined) where.prix.lte = prixMax;
    }

    return this.prisma.dish.findMany({
      where,
      include: { categorie: true },
      orderBy: { nom: 'asc' },
    });
  }

  async findOne(id: string) {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      include: { categorie: true },
    });

    if (!dish) {
      throw new NotFoundException(`Plat avec l'ID ${id} non trouvé`);
    }

    return dish;
  }

  async update(id: string, updateDishDto: UpdateDishDto) {
    const dish = await this.findOne(id);

    // Si la catégorie est mise à jour, vérifier qu'elle existe
    if (updateDishDto.categorieId && updateDishDto.categorieId !== dish.categorieId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateDishDto.categorieId },
      });

      if (!category) {
        throw new BadRequestException(`Catégorie avec l'ID ${updateDishDto.categorieId} non trouvée`);
      }
    }

    const data: any = { ...updateDishDto };
    if (updateDishDto.prix !== undefined) {
      data.prix = new Decimal(updateDishDto.prix.toString());
    }

    return this.prisma.dish.update({
      where: { id },
      data,
      include: { categorie: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const orderItemsCount = await this.prisma.orderItem.count({ where: { dishId: id } });

    if (orderItemsCount > 0) {
      throw new ConflictException(
        'Ce plat appartient à l’historique de commandes et ne peut pas être supprimé. Désactivez-le plutôt.',
      );
    }

    return this.prisma.dish.delete({
      where: { id },
    });
  }

  async toggleAvailability(id: string) {
    const dish = await this.findOne(id);

    return this.prisma.dish.update({
      where: { id },
      data: { disponible: !dish.disponible },
      include: { categorie: true },
    });
  }
}
