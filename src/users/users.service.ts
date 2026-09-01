import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private publicUser(user: any) {
    const { motDePasseHash, ...safeUser } = user;
    return safeUser;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((user) => this.publicUser(user));
  }

  async findActiveLivreurs() {
    const users = await this.prisma.user.findMany({
      where: { role: 'LIVREUR', actif: true },
      orderBy: { nom: 'asc' },
    });
    return users.map((user) => this.publicUser(user));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return this.publicUser(user);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ telephone: dto.telephone }, { email: dto.email || undefined }] },
    });
    if (existing) throw new BadRequestException('Un utilisateur avec ce téléphone ou cet email existe déjà');

    const user = await this.prisma.user.create({
      data: {
        nom: dto.nom,
        telephone: dto.telephone,
        email: dto.email || null,
        motDePasseHash: await bcrypt.hash(dto.motDePasse, 10),
        role: dto.role,
      },
    });
    return this.publicUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    delete data.motDePasse;
    if (dto.motDePasse) data.motDePasseHash = await bcrypt.hash(dto.motDePasse, 10);

    const user = await this.prisma.user.update({ where: { id }, data });
    return this.publicUser(user);
  }

  async deactivate(id: string) {
    return this.update(id, { actif: false });
  }
}
