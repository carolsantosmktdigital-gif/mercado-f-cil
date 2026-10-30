import { beforeEach, describe, expect, it, vi } from "vitest";
import { budgetState } from "../lib/budget";
import {
  cached,
  saveCache,
  enqueue,
  overlayItems,
  readLocal,
  flushWrites,
  type PendingWrite,
} from "../lib/offline";
const op = (
  id: string,
  values: Record<string, unknown> = {},
  kind: PendingWrite["kind"] = "update",
  listaId = "list",
): PendingWrite => ({ id, listaId, itemId: "rice", values, kind });
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
describe("budget limits", () => {
  it.each([
    [69.99, "normal"],
    [70, "warning"],
    [79.99, "warning"],
    [80, "danger"],
    [100, "danger"],
    [110, "danger"],
  ])("spent %s has %s alert", (spent, level) =>
    expect(budgetState(100, Number(spent)).level).toBe(level),
  );
  it("handles zero and overspending without NaN or hiding negative balances", () => {
    expect(budgetState(0, 0)).toEqual({ remaining: 0, percent: 0, level: "normal" });
    expect(budgetState(100, 110).remaining).toBe(-10);
  });
});
describe("durable shopping edits", () => {
  it("retains price and cart state across reopening, without moving the row", () => {
    const key = ["itens", "family", "list"];
    const items = [
      { id: "rice", preco: 0, comprado: false },
      { id: "beans", preco: 0, comprado: false },
    ];
    const priced = overlayItems(items, [op("1", { preco: 12.5 })], "list");
    enqueue("family", op("1", { preco: 12.5 }), key, priced);
    const bought = overlayItems(priced, [op("2", { comprado: true })], "list");
    enqueue("family", op("2", { comprado: true }), key, bought);
    expect(cached("family", key)).toEqual([{ id: "rice", preco: 12.5, comprado: true }, items[1]]);
    expect(readLocal("other-family").pending).toEqual([]);
    expect(overlayItems(items, readLocal("family").pending, "other-list")).toEqual(items);
  });
  it("does not send while offline and serializes concurrent reconnect attempts", async () => {
    enqueue("family", op("1", { preco: 10 }), [], []);
    enqueue("family", op("2", { comprado: true }), [], []);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const send = vi.fn(async (_op: PendingWrite) => {});
    await flushWrites("family", send);
    expect(send).not.toHaveBeenCalled();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await Promise.all([flushWrites("family", send), flushWrites("family", send)]);
    expect(send.mock.calls.map((args) => args[0].id)).toEqual(["1", "2"]);
    expect(readLocal("family").pending).toEqual([]);
  });
  it("keeps failed writes and retries absolute values without double toggling", async () => {
    enqueue("family", op("1", { comprado: true }), [], []);
    await expect(
      flushWrites("family", async () => {
        throw Error("connection lost");
      }),
    ).rejects.toThrow();
    expect(readLocal("family").pending).toHaveLength(1);
    const send = vi.fn(async (_op: PendingWrite) => {});
    await flushWrites("family", send);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ values: { comprado: true } }));
  });
  it("keeps writes added during synchronization", async () => {
    enqueue("family", op("1", { preco: 10 }), [], []);
    const send = vi.fn(async (write: PendingWrite) => {
      if (write.id === "1") enqueue("family", op("2", { preco: 20 }), [], []);
    });
    await flushWrites("family", send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(readLocal("family").pending).toEqual([]);
  });
  it("overlays stale server data and handles insert/remove without duplication", () => {
    const writes = [
      op("1", { nome: "Rice" }, "insert"),
      op("2", { preco: 5 }),
      op("3", {}, "delete"),
    ];
    expect(overlayItems([], writes, "list")).toEqual([]);
    expect(overlayItems([{ id: "rice", preco: 0 }], writes.slice(0, 2), "list")).toEqual([
      { id: "rice", nome: "Rice", preco: 5 },
    ]);
  });
  it("fails visibly on storage failure, leaving the persisted queue intact", () => {
    saveCache("family", ["cards"], [{ saldo: 100 }]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("quota");
    });
    expect(() => enqueue("family", op("1"), [], [])).toThrow("Libere espaço");
    expect(readLocal("family").pending).toEqual([]);
  });
});
