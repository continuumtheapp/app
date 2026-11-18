/**
 * Neighbourhoods offered on the request form, for the few cities with the
 * most posts in the group (12 months to Oct 2026). Everywhere else a search
 * is just the city. Informational: not matched on.
 *
 * Keyed by the city's English name and country code, as Photon returns them.
 */
export const CITY_AREAS: Record<string, readonly string[]> = {
  "Berlin|DE": [
    "Mitte", "Kreuzberg", "Neukölln", "Friedrichshain", "Prenzlauer Berg",
    "Wedding", "Moabit", "Schöneberg", "Charlottenburg", "Wilmersdorf",
    "Treptow", "Tempelhof", "Lichtenberg", "Pankow", "Steglitz",
  ],
  "Barcelona|ES": [
    "Ciutat Vella", "El Born", "El Raval", "Gòtic", "Barceloneta", "Eixample",
    "Sant Antoni", "Gràcia", "Poble-sec", "Sants", "Les Corts",
    "Sarrià-Sant Gervasi", "Horta-Guinardó", "Sant Andreu", "Poblenou", "Sant Martí",
  ],
  "Lisbon|PT": [
    "Alfama", "Baixa", "Chiado", "Bairro Alto", "Príncipe Real", "Santos",
    "Estrela", "Campo de Ourique", "Alcântara", "Belém", "Graça", "Mouraria",
    "Arroios", "Avenidas Novas", "Alvalade", "Marvila", "Parque das Nações",
  ],
  "Paris|FR": [
    "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
    "11th", "12th", "13th", "14th", "15th", "16th", "17th", "18th", "19th", "20th",
  ],
  "Amsterdam|NL": [
    "Centrum", "Jordaan", "De Pijp", "Oud-West", "Oud-Zuid", "Oost",
    "Indische Buurt", "De Baarsjes", "Westerpark", "Bos en Lommer", "Noord",
    "Nieuw-West", "Rivierenbuurt", "IJburg", "Zuidoost",
  ],
  "London|GB": [
    "Camden", "Islington", "Hackney", "Shoreditch", "Tower Hamlets", "Stratford",
    "Walthamstow", "Haringey", "Westminster", "Kensington & Chelsea",
    "Hammersmith & Fulham", "Brixton", "Clapham", "Peckham", "Southwark",
    "Greenwich", "Lewisham",
  ],
  "New York|US": [
    "Manhattan", "Brooklyn", "Queens", "The Bronx", "Staten Island",
    "East Village", "Lower East Side", "Harlem", "Upper West Side", "Upper East Side",
    "Williamsburg", "Greenpoint", "Bushwick", "Bed-Stuy", "Crown Heights",
    "Park Slope", "Astoria", "Long Island City",
  ],
};

/** The neighbourhoods we offer for a city, or none. */
export function areasFor(city: string, country: string): readonly string[] {
  return CITY_AREAS[`${city}|${country.toUpperCase()}`] ?? [];
}

/** Anmeldung (registering your address) is a German thing. */
export function hasAnmeldung(country: string | null | undefined): boolean {
  return !country || country.toUpperCase() === "DE";
}
