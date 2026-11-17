/**
 * Code → label maps for the demographic filters.
 *
 * MIRRORS coke_eu/config/codes.py. The export is label-valued and ingest maps
 * each label to a questionnaire code, so the API's /maxdiff/meta returns
 * `filter_values` as bare integers — there is no label dictionary in the
 * database to serve alongside them. Until meta carries labels of its own,
 * this file is the display layer, and it has to be kept in step with codes.py.
 *
 * Market names DO come from the API (Market.name), so there is no market map
 * here — only the language codes used to annotate a market chip.
 */

/** S1H, hidden and derived from S1. Expanded from the bare questionnaire
 *  labels ("18-29 (Gen Z)") to something that reads in a filter chip. */
export const GENERATION_LABELS: Record<number, string> = {
  1: "Gen Z 18–29",
  2: "Millennials 30–45",
  3: "Gen X 46–54",
};

/**
 * The gender BANNER, not raw S2. codes.py collapses Male / Female+Other per
 * the Quotas sheet and deliberately leaves "Prefer not to say" unmapped, so
 * those respondents are null here and drop out of any gender cut.
 */
export const GENDER_BANNER_LABELS: Record<number, string> = {
  1: "Male",
  2: "Female / Other",
};

/** Raw S2, exposed by the API as `gender_raw`. Not currently a filter chip. */
export const GENDER_LABELS: Record<number, string> = {
  1: "Male",
  2: "Female",
  3: "Other",
  4: "Prefer not to say",
};

/** S1. Codes 1 and 9 terminate the survey, so they never appear in the data. */
export const AGE_LABELS: Record<number, string> = {
  1: "17 or under",
  2: "18–24",
  3: "25–29",
  4: "30–34",
  5: "35–39",
  6: "40–45",
  7: "46–49",
  8: "50–54",
  9: "55+",
};

/**
 * S3 collapsed to a band. The raw income code is market-specific (101–110 UK,
 * 201–211 DE, …) and not comparable across markets; only the band is, which is
 * why the banner uses it and why the raw ladder is not offered as a chip.
 */
export const INCOME_BAND_LABELS: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
};

/** S4. */
export const AREA_LABELS: Record<number, string> = {
  1: "Urban",
  2: "Suburban",
  3: "Rural",
  4: "Don't know",
};

/** S5. */
export const HOUSEHOLD_SIZE_LABELS: Record<number, string> = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "More than 4",
};

/** S6, asked only when S5 is 2–5. */
export const NUM_CHILDREN_LABELS: Record<number, string> = {
  1: "None",
  2: "1",
  3: "2",
  4: "3",
  5: "More than 3",
};

export const LANGUAGE_LABELS: Record<number, string> = {
  1: "English",
  2: "German",
  3: "French",
  4: "Spanish",
  5: "Polish",
  6: "Romanian",
};

/** Falls back to the bare code so an unmapped value is visible, not hidden. */
export function labelFor(
  map: Record<number, string>,
  code: number | string
): string {
  return map[Number(code)] ?? String(code);
}
