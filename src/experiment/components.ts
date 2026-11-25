/**
 * Single source of truth for the *component values* of the experiment.
 *
 * Both the physical kit board (silk-screened resistor nameplates, `kitBase`) and
 * the circuit model (`physics/netlist`) derive their numbers from here, so the
 * displayed value can never drift from the value the solver uses.
 */

/** The three resistors of the Fig-1 T-network, in ohms. */
export interface ResistorSet {
  r1: number;
  r2: number;
  r3: number;
}

/** Values the student may select for each resistor (a realistic fixed set). */
export const STANDARD_RESISTOR_OHMS = [100, 150, 220, 330, 470, 560, 680, 1000] as const;

/** Values silk-screened on the kit board at start-up. */
export const DEFAULT_RESISTOR_SET: ResistorSet = { r1: 100, r2: 100, r3: 100 };

/** Human label for a resistance, e.g. 100 → "100 Ω", 1000 → "1 kΩ". */
export function formatOhms(ohms: number): string {
  if (ohms >= 1000 && ohms % 1000 === 0) return `${ohms / 1000} kΩ`;
  return `${ohms} Ω`;
}

/** Stable string signature of a resistor set, used to tag observations. */
export function resistorSignature({ r1, r2, r3 }: ResistorSet): string {
  return `${r1}/${r2}/${r3}`;
}
