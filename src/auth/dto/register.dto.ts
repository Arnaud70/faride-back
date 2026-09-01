import { IsString, IsEmail, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'Le nom doit contenir au moins 3 caractères' })
  nom: string;

  @Matches(/^[\d\s+()-]+$/, { message: 'Le téléphone doit être valide (format: +228XXXXXXXX ou 8 chiffres min)' })
  @MinLength(8, { message: 'Le téléphone doit contenir au moins 8 chiffres' })
  telephone: string;

  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  motDePasse: string;
}
