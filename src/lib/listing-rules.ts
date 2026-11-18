/**
 * Posting rules, kept apart from listings.ts so the browser can import them
 * without pulling in the database code.
 */

/**
 * At most this many homes live at once per member: agreed with Boris, to stop
 * one person filling the board. Taken, archived and hidden ones don't count.
 */
export const MAX_ACTIVE_LISTINGS = 2;

/** What every member who posts a place agrees to. Boris's wording to adjust. */
export const FAIR_RENT_PLEDGE =
  "I'm asking a fair price: no more than what the place costs me, plus a fair share of bills and furniture. I won't make a profit on someone who needs a home.";

export const TOO_MANY_LISTINGS =
  `You can have ${MAX_ACTIVE_LISTINGS} places up at once. Mark one as taken or archive it first.`;

