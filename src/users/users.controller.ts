import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RoleGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: any) {
    return this.usersService.findOne(user.id);
  }

  @Get()
  @UseGuards(RoleGuard)
  @Roles('ADMIN')
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('livreurs/actifs')
  @UseGuards(RoleGuard)
  @Roles('ADMIN', 'CHEF')
  async findActiveLivreurs() {
    return this.usersService.findActiveLivreurs();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== 'ADMIN' && user.id !== id) {
      return this.usersService.findOne(user.id);
    }
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(RoleGuard)
  @Roles('ADMIN')
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    if (user.role !== 'ADMIN' && user.id !== id) {
      return this.usersService.findOne(user.id);
    }
    return this.usersService.update(id, user.role === 'ADMIN' ? dto : { nom: dto.nom, telephone: dto.telephone, email: dto.email, motDePasse: dto.motDePasse });
  }

  @Delete(':id')
  @UseGuards(RoleGuard)
  @Roles('ADMIN')
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
}
