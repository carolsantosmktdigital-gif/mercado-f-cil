import { describe, expect, it } from "vitest";
import { orcamentoEmAlerta } from "@/lib/demo-store";

describe("alerta de orçamento (20%)", () => {
  it("alerta quando resta exatamente 20%", () => expect(orcamentoEmAlerta(300, 240)).toBe(true));
  it("não alerta quando resta mais de 20%", () => expect(orcamentoEmAlerta(300, 239)).toBe(false));
});
