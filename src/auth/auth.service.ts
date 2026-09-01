import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { RegisterDto, LoginDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { nom, telephone, email, motDePasse } = registerDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ telephone }, { email: email || undefined }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('Un utilisateur avec ce téléphone ou email existe déjà');
    }

    // Hacher le mot de passe
    const motDePasseHash = await bcrypt.hash(motDePasse, 10);

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        nom,
        telephone,
        email: email || null,
        motDePasseHash,
        role: 'CLIENT',
      },
    });

    // Générer les tokens
    const tokens = await this.issueTokens(user.id, user.role);

    return {
      message: 'Inscription réussie',
      user: {
        id: user.id,
        nom: user.nom,
        telephone: user.telephone,
        email: user.email,
        role: user.role,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, telephone, motDePasse } = loginDto;
    const identifier = email || telephone;

    if (!identifier) {
      throw new UnauthorizedException('Email ou téléphone requis');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { telephone: identifier },
        ],
      },
    });

    if (!user || !user.actif) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const isPasswordValid = await bcrypt.compare(motDePasse, user.motDePasseHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const tokens = await this.issueTokens(user.id, user.role);

    return {
      message: 'Connexion réussie',
      user: {
        id: user.id,
        nom: user.nom,
        telephone: user.telephone,
        email: user.email,
        role: user.role,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshWithToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token manquant');
    }

    try {
      const tokenHash = await bcrypt.hash(refreshToken, 10);
      const candidates = await this.prisma.refreshToken.findMany({
        where: { revoked: false, expiresAt: { gt: new Date() } },
      });
      const storedToken = await this.findMatchingToken(candidates, refreshToken, tokenHash);

      if (!storedToken) {
        throw new UnauthorizedException('Refresh token invalide ou expiré');
      }

      const payload = this.jwtService.verify<{ sub: string }>(refreshToken);
      const user = await this.validateUser(payload.sub);
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      });
      const tokens = await this.issueTokens(user.id, user.role);
      return {
        message: 'Token actualisé',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: this.publicUser(user),
      };
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      const candidates = await this.prisma.refreshToken.findMany({
        where: { revoked: false },
      });
      const storedToken = await this.findMatchingToken(candidates, refreshToken);
      if (storedToken) {
        await this.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revoked: true },
        });
      }
    }
  }

  private async issueTokens(userId: string, userRole: string) {
    const accessToken = this.jwtService.sign({ sub: userId, role: userRole }, { expiresIn: '15m' });
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private async findMatchingToken(candidates: Array<{ id: string; tokenHash: string }>, token: string, _unusedHash?: string) {
    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) return candidate;
    }
    return null;
  }

  publicUser(user: any) {
    return {
      id: user.id,
      nom: user.nom,
      telephone: user.telephone,
      email: user.email,
      role: user.role,
    };
  }

  private generateTokens(userId: string, userRole: string) {
    const payload = { sub: userId, role: userRole };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.actif) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    return user;
  }
}
