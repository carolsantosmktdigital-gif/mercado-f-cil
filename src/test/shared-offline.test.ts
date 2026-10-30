import { beforeEach, it, expect, vi } from "vitest";
import {
  enqueue,
  flushWrites,
  readLocal,
  ItemConflictError,
  resolveWrite,
  saveCache,
  reopenFinalization,
  cached,
} from "@/lib/offline";
import { shoppingSnapshot } from "@/lib/shared-shopping";
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
it("retains conflicting edits, continues unrelated products, blocks checkout until resolved", async () => {
  enqueue(
    "f",
    {
      id: "a",
      listaId: "l",
      itemId: "rice",
      kind: "update",
      values: { preco: 12 },
      base: { preco: 10 },
    },
    [],
    [],
  );
  enqueue(
    "f",
    {
      id: "b",
      listaId: "l",
      itemId: "rice",
      kind: "update",
      values: { comprado: true },
      base: { comprado: false },
    },
    [],
    [],
  );
  enqueue(
    "f",
    {
      id: "c",
      listaId: "l",
      itemId: "beans",
      kind: "update",
      values: { preco: 5 },
      base: { preco: 0 },
    },
    [],
    [],
  );
  enqueue("f", { id: "d", listaId: "l", itemId: "l", kind: "finalize", values: {} }, [], []);
  const sent: string[] = [];
  await flushWrites("f", async (op) => {
    sent.push(op.id);
    if (op.id === "a")
      throw new ItemConflictError({ motivo: "Preço alterado", atual: { preco: 11 } });
  });
  expect(sent).toEqual(["a", "c"]);
  expect(readLocal("f").pending.map((p) => p.id)).toEqual(["a", "b", "d"]);
  resolveWrite("f", "a", true);
  expect(readLocal("f").pending[0]?.base).toEqual({ preco: 11 });
  await flushWrites("f", async (op) => {
    sent.push(op.id);
  });
  expect(sent).toEqual(["a", "c", "a", "b", "d"]);
  expect(readLocal("f").pending).toEqual([]);
});
it("discarding a conflict keeps remote data and a closed-list conflict cannot be forced", () => {
  const op = {
    id: "a",
    listaId: "l",
    itemId: "i",
    kind: "update" as const,
    values: { preco: 12 },
    conflict: { motivo: "Finalizada", bloqueado: true },
  };
  enqueue("f", op, [], []);
  expect(() => resolveWrite("f", "a", true)).toThrow();
  resolveWrite("f", "a", false);
  expect(readLocal("f").pending).toEqual([]);
});
it("reopening a rejected offline checkout refunds its local debit and keeps remaining-item edits", () => {
  saveCache("f", ["cartoes", "f"], [{ id: "c", saldo: 80 }]);
  saveCache("f", ["listas", "f"], [{ id: "p" }]);
  saveCache("f", ["itens", "f", "p"], [{ id: "beans", preco: 7 }]);
  saveCache("f", ["compras", "f"], [{ id: "finish", total: 20 }]);
  enqueue(
    "f",
    {
      id: "finish",
      listaId: "l",
      itemId: "l",
      kind: "finalize",
      values: {
        total: 20,
        lista: { id: "l", cartao_id: "c" },
        pendenciasId: "p",
        produtos: [{ id: "rice", preco: 20 }],
      },
    },
    [],
    [],
  );
  enqueue(
    "f",
    { id: "edit", listaId: "p", itemId: "beans", kind: "update", values: { preco: 7 } },
    [],
    [],
  );
  reopenFinalization("f", "finish");
  expect(cached("f", ["cartoes", "f"])).toEqual([{ id: "c", saldo: 100 }]);
  expect(cached("f", ["compras", "f"])).toEqual([]);
  expect(readLocal("f").pending[0]?.listaId).toBe("l");
  expect(cached("f", ["itens", "f", "l"])).toEqual([
    { id: "rice", preco: 20 },
    { id: "beans", preco: 7 },
  ]);
});
it("snapshot includes product identity and quantities, independent of row order", () => {
  const a = { id: "a", nome: "A", setor: "Mercearia", qtd: 1, preco: 10, comprado: true },
    b = { ...a, id: "b", nome: "B" };
  expect(shoppingSnapshot([a, b])).toBe(shoppingSnapshot([b, a]));
  expect(shoppingSnapshot([a])).not.toBe(shoppingSnapshot([{ ...a, nome: "Outro" }]));
});
