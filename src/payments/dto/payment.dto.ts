import { IsEnum, IsOptional } from 'class-validator';

export class SimulatePaymentDto {
  @IsEnum(['ESPECES', 'MOBILE_MONEY_SIMULE', 'CARTE_SIMULEE'])
  methode: 'ESPECES' | 'MOBILE_MONEY_SIMULE' | 'CARTE_SIMULEE';

  @IsOptional()
  @IsEnum(['VALIDE', 'ECHOUE'])
  statut?: 'VALIDE' | 'ECHOUE';
}
