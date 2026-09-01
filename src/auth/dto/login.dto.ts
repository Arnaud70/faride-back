import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsEmail({}, { message: 'Veuillez fournir un email valide' })
  email?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsString()
  @MinLength(1, { message: 'Le mot de passe est requis' })
  motDePasse: string;
}
