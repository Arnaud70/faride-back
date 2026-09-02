import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Res,
  Get,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Inscription client' })
  @ApiResponse({ status: 201, description: 'Inscription réussie' })
  @ApiResponse({ status: 400, description: 'Données invalides ou utilisateur existant' })
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(registerDto);
    this.setRefreshCookie(response, result.refreshToken);
    return { message: result.message, user: result.user, accessToken: result.accessToken };
  }

  @Post('login')
  @ApiOperation({ summary: 'Connexion utilisateur' })
  @ApiResponse({ status: 200, description: 'Connexion réussie' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto);
    this.setRefreshCookie(response, result.refreshToken);
    return { message: result.message, user: result.user, accessToken: result.accessToken };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renouvellement du token d\'accès' })
  @ApiResponse({ status: 200, description: 'Token actualisé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.refreshWithToken((request as Request & { cookies?: Record<string, string> }).cookies?.refresh_token || '');
    this.setRefreshCookie(response, result.refreshToken);
    return { message: result.message, user: result.user, accessToken: result.accessToken };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout((request as Request & { cookies?: Record<string, string> }).cookies?.refresh_token || '');
    response.clearCookie('refresh_token', this.cookieOptions());
    return { message: 'Déconnexion réussie' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: Request) {
    return { user: this.authService.publicUser((request as Request & { user: any }).user) };
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie('refresh_token', token, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth',
    };
  }
}
