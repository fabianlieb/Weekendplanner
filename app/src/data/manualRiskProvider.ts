import { MANUAL_SOURCE, type AvalancheRiskProvider } from '../engine/risk';
import type { RiskEntry } from '../engine/types';
import type { PlannerDB } from './db';

/** MVP provider: colours tapped in by the user from Skitourenguru. No scraping. */
export class ManualRiskProvider implements AvalancheRiskProvider {
  readonly source = MANUAL_SOURCE;

  constructor(private readonly db: PlannerDB) {}

  async getEntries(candidateIds: readonly string[]): Promise<RiskEntry[]> {
    const rows = await this.db.riskEntries.where('candidateId').anyOf([...candidateIds]).toArray();
    return rows.map(({ candidateId, color, dangerLevel, date, source }) => ({
      candidateId,
      color,
      ...(dangerLevel ? { dangerLevel } : {}),
      date,
      source,
    }));
  }
}
