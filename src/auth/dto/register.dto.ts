import { IsEmail, IsOptional, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Nom : lettres (accents compris), espaces, tirets et apostrophes uniquement. */
export const NOM_REGEX =
  /^[A-Za-zÀ-ÖØ-öø-ÿ]{2,}(?:[ '\-][A-Za-zÀ-ÖØ-öø-ÿ]{1,}){0,4}$/;

/** Téléphone togolais normalisé : +228 puis 8 chiffres commençant par 7 ou 9. */
export const TEL_TOGO_REGEX = /^\+228[79]\d{7}$/;

/** Mot de passe : au moins 8 caractères, avec au moins une lettre et un chiffre. */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

/** Retire les séparateurs et force le préfixe +228. */
export const normalizePhone = (value: unknown): string => {
  if (typeof value !== 'string') return value as string;
  let digits = value.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+228')) digits = digits.slice(4);
  else if (digits.startsWith('228')) digits = digits.slice(3);
  else if (digits.startsWith('+')) digits = digits.slice(1);
  return `+228${digits}`;
};

export class RegisterDto {
  @Matches(NOM_REGEX, {
    message: 'Le nom ne doit contenir que des lettres (pas de chiffres).',
  })
  @MinLength(3, { message: 'Le nom doit contenir au moins 3 caractères.' })
  nom: string;

  @Transform(({ value }) => normalizePhone(value))
  @Matches(TEL_TOGO_REGEX, {
    message:
      'Numéro togolais invalide : 8 chiffres commençant par 7 ou 9 (ex. +228 90 12 34 56).',
  })
  telephone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide.' })
  email?: string;

  @Matches(PASSWORD_REGEX, {
    message:
      'Le mot de passe doit contenir au moins 8 caractères, dont au moins une lettre et un chiffre.',
  })
  motDePasse: string;
}
