import { describe, it, expect } from "vitest";
import { photonLabel, boxAround } from "../geo";

describe("address labels", () => {
  it("is street, number, district and city", () => {
    expect(photonLabel({ street: "Weserstraße", housenumber: "10", district: "Neukölln", city: "Berlin", osm_key: "place" }, "Berlin"))
      .toBe("Weserstraße 10, Neukölln, Berlin");
  });

  it("works outside Berlin", () => {
    expect(photonLabel({ street: "Carrer de Verdi", housenumber: "10", district: "Gràcia", city: "Barcelona", osm_key: "place" }, "Barcelona"))
      .toBe("Carrer de Verdi 10, Gràcia, Barcelona");
  });

  it("names a street on its own", () => {
    expect(photonLabel({ name: "Sonnenallee", osm_key: "highway", district: "Neukölln" }, "Berlin"))
      .toBe("Sonnenallee, Neukölln, Berlin");
  });

  it("puts a named place before its street", () => {
    expect(photonLabel({ name: "Tempelhofer Feld", street: "Columbiadamm", osm_key: "leisure", district: "Tempelhof" }, "Berlin"))
      .toBe("Tempelhofer Feld, Columbiadamm, Tempelhof, Berlin");
  });

  it("doesn't repeat a district named like the city, and gives up without a place", () => {
    expect(photonLabel({ street: "Rua Augusta", housenumber: "1", locality: "Lisbon" }, "Lisbon")).toBe("Rua Augusta 1, Lisbon");
    expect(photonLabel({ district: "Mitte" }, "Berlin")).toBeNull();
  });
});

describe("box around a point", () => {
  it("is about 15 km each way", () => {
    const b = boxAround(52.52, 13.405);
    expect(b.north - b.south).toBeCloseTo(30 / 111, 3);
    expect(b.east).toBeGreaterThan(13.405);
  });
});
