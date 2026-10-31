/**
 * Panel codes, shared by Pixel Map ("Panel No"), Simülasyon (tooltips, grid labels) and the printouts:
 * letter = row from the top (A, B, … Z, AA, AB, …), number = column from the left (1, 2, …).
 * A1 = top left; B3 = second row, third column — so on site "the panel at C7" means the same everywhere.
 */

/** Spreadsheet-style letters for a 0-based index: 0 → A, 25 → Z, 26 → AA, 27 → AB, 52 → BA. */
export function rowLetters(index: number): string {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

/** The code of the panel on 0-based `row` (from the top) and `column` (from the left): (1, 2) → "B3". */
export function panelCode(row: number, column: number): string {
  return `${rowLetters(row)}${column + 1}`;
}

/**
 * The code of a Simülasyon / server cell (`column × rows + row`, row 0 = bottom): rows are counted from the top
 * for people, so the bottom row of a 4-row screen is "D".
 */
export function cellCode(cell: number, rows: number): string {
  return panelCode(rows - 1 - (cell % rows), Math.floor(cell / rows));
}
