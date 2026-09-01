import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const { nom } = createCategoryDto;

    // Vérifier l'unicité du nom
    const existing = await this.prisma.category.findUnique({
      where: { nom },
    });

    if (existing) {
      throw new BadRequestException('Cette catégorie existe déjà');
    }

    const category = await this.prisma.category.create({
      data: {
        nom,
        description: createCategoryDto.description ?? null,
        imageUrl: createCategoryDto.imageUrl ?? null,
        actif: createCategoryDto.actif ?? true,
      },
    });

    return category;
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        dishes: true,
      },
      orderBy: { nom: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        dishes: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (updateCategoryDto.nom && updateCategoryDto.nom !== category.nom) {
      // Vérifier l'unicité du nouveau nom
      const existing = await this.prisma.category.findUnique({
        where: { nom: updateCategoryDto.nom },
      });

      if (existing) {
        throw new BadRequestException('Cette catégorie existe déjà');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
      include: { dishes: true },
    });
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    // Vérifier s'il y a des plats liés
    const dishCount = await this.prisma.dish.count({
      where: { categorieId: id },
    });

    if (dishCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer cette catégorie car elle contient ${dishCount} plat(s)`,
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }
}
