import { describe, it, expect } from "vitest";
import { applyRange } from "../../components/availability-editor";

const empty = { days: [], flexible: [] };

describe("marking availability", () => {
  it("marks a whole range, in either direction", () => {
    expect(applyRange(empty, 10, 13, "available")).toEqual({ days: [10, 11, 12, 13], flexible: [] });
    expect(applyRange(empty, 13, 10, "available").days).toEqual([10, 11, 12, 13]);
  });

  it("clears a range that's already available", () => {
    const v = applyRange(empty, 10, 15, "available");
    expect(applyRange(v, 11, 12, "available")).toEqual({ days: [10, 13, 14, 15], flexible: [] });
  });

  it("marks 'not sure yet' directly, without marking available first", () => {
    expect(applyRange(empty, 20, 22, "flexible")).toEqual({ days: [20, 21, 22], flexible: [20, 21, 22] });
  });

  it("turns 'not sure' days back to certain with the not-sure brush", () => {
    const v = applyRange(empty, 20, 22, "flexible");
    expect(applyRange(v, 20, 22, "flexible")).toEqual({ days: [20, 21, 22], flexible: [] });
  });

  it("makes 'not sure' days certain with the available brush, instead of clearing", () => {
    const v = applyRange(applyRange(empty, 1, 5, "available"), 3, 4, "flexible");
    expect(applyRange(v, 1, 5, "available")).toEqual({ days: [1, 2, 3, 4, 5], flexible: [] });
  });
});
