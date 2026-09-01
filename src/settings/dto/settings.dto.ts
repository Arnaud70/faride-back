import { IsInt, IsOptional, IsString, Matches, Min, Max } from 'class-validator';

const HEURE_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  nomRestaurant?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @Matches(HEURE_REGEX, { message: "L'heure d'ouverture doit être au format HH:mm" })
  heureOuverture?: string;

  @IsOptional()
  @Matches(HEURE_REGEX, { message: "L'heure de fermeture doit être au format HH:mm" })
  heureFermeture?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  intervalleCreneauxMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  bufferPreparationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxCommandesParCreneau?: number;
}
