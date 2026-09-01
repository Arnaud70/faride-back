import { Injectable } from '@nestjs/common';
import { UpdateSettingsDto } from './dto/settings.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface CreneauDisponible {
  heure: string; // "HH:mm"
  iso: string; // ISO datetime du créneau
  disponible: boolean;
  passe: boolean;
  complet: boolean;
  placesRestantes: number;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /** Récupère l'unique ligne de paramètres, la crée si absente. */
  async getSettings() {
    const existing = await this.prisma.restaurantSetting.findFirst();
    if (existing) return existing;
    return this.prisma.restaurantSetting.create({ data: {} });
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const current = await this.getSettings();
    return this.prisma.restaurantSetting.update({
      where: { id: current.id },
      data: dto,
    });
  }

  private parseHeure(heure: string): { h: number; m: number } {
    const [h, m] = heure.split(':').map(Number);
    return { h, m };
  }

  private formatHeure(date: Date): string {
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  /**
   * Calcule les créneaux de retrait pour une date donnée (par défaut aujourd'hui).
   * Un créneau passé ou déjà plein est marqué indisponible.
   */
  async getAvailableSlots(dateStr?: string): Promise<{
    date: string;
    creneaux: CreneauDisponible[];
  }> {
    const settings = await this.getSettings();
    const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    const year = base.getFullYear();
    const month = base.getMonth();
    const day = base.getDate();

    const ouverture = this.parseHeure(settings.heureOuverture);
    const fermeture = this.parseHeure(settings.heureFermeture);
    const intervalle = settings.intervalleCreneauxMin;
    const buffer = settings.bufferPreparationMin;

    const debut = new Date(year, month, day, ouverture.h, ouverture.m, 0, 0);
    const fin = new Date(year, month, day, fermeture.h, fermeture.m, 0, 0);
    const maintenant = new Date();
    const premierPossible = new Date(maintenant.getTime() + buffer * 60 * 1000);

    // Bornes journalières pour compter les commandes existantes
    const jourDebut = new Date(year, month, day, 0, 0, 0, 0);
    const jourFin = new Date(year, month, day + 1, 0, 0, 0, 0);
    const commandesDuJour = await this.prisma.order.findMany({
      where: {
        heureRetrait: { gte: jourDebut, lt: jourFin },
        statut: { not: 'ANNULEE' },
      },
      select: { heureRetrait: true },
    });

    const creneaux: CreneauDisponible[] = [];
    for (
      let t = new Date(debut);
      t < fin;
      t = new Date(t.getTime() + intervalle * 60 * 1000)
    ) {
      const slotFin = new Date(t.getTime() + intervalle * 60 * 1000);
      const passe = t < premierPossible;
      const nbCommandes = commandesDuJour.filter(
        (c) => c.heureRetrait >= t && c.heureRetrait < slotFin,
      ).length;
      const placesRestantes = Math.max(
        0,
        settings.maxCommandesParCreneau - nbCommandes,
      );
      const complet = placesRestantes === 0;
      creneaux.push({
        heure: this.formatHeure(t),
        iso: t.toISOString(),
        disponible: !passe && !complet,
        passe,
        complet,
        placesRestantes,
      });
    }

    return { date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, creneaux };
  }

  /**
   * Valide qu'une heure de retrait tombe dans un créneau ouvert et non complet.
   * Renvoie un message d'erreur (string) si invalide, sinon null.
   */
  async validatePickupTime(heureRetrait: Date): Promise<string | null> {
    const settings = await this.getSettings();
    const buffer = settings.bufferPreparationMin;
    const maintenant = new Date();

    if (Number.isNaN(heureRetrait.getTime())) {
      return "L'heure de retrait est invalide";
    }
    if (heureRetrait.getTime() < maintenant.getTime() + buffer * 60 * 1000) {
      return `L'heure de retrait doit être au moins ${buffer} minutes après maintenant`;
    }

    const ouverture = this.parseHeure(settings.heureOuverture);
    const fermeture = this.parseHeure(settings.heureFermeture);
    const minutesJour = heureRetrait.getHours() * 60 + heureRetrait.getMinutes();
    const minOuverture = ouverture.h * 60 + ouverture.m;
    const minFermeture = fermeture.h * 60 + fermeture.m;
    if (minutesJour < minOuverture || minutesJour >= minFermeture) {
      return `Le restaurant accepte les retraits entre ${settings.heureOuverture} et ${settings.heureFermeture}`;
    }

    const intervalle = settings.intervalleCreneauxMin;
    const slotDebut = new Date(heureRetrait);
    slotDebut.setSeconds(0, 0);
    // aligner sur le début du créneau
    const minutesDepuisOuverture = minutesJour - minOuverture;
    const offset = minutesDepuisOuverture % intervalle;
    slotDebut.setMinutes(slotDebut.getMinutes() - offset);
    const slotFin = new Date(slotDebut.getTime() + intervalle * 60 * 1000);

    const nbCommandes = await this.prisma.order.count({
      where: {
        heureRetrait: { gte: slotDebut, lt: slotFin },
        statut: { not: 'ANNULEE' },
      },
    });
    if (nbCommandes >= settings.maxCommandesParCreneau) {
      return 'Ce créneau de retrait est complet, veuillez en choisir un autre';
    }

    return null;
  }
}
