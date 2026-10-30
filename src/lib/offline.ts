import { migrateCategoryCache } from "./categories";
// Each family has one atomic local record: queued writes and cached query data.
export type PendingWrite = {
  id: string;
  listaId: string;
  itemId: string;
  kind: "insert" | "update" | "delete" | "finalize" | "history" | "category";
  values: Record<string, unknown>;
  base?: Record<string, unknown>;
  conflict?: { atual?: Record<string, unknown> | null; motivo: string; bloqueado?: boolean };
};
type LocalData = { cache: Record<string, unknown>; pending: PendingWrite[] };
const prefix = "mercado-facil-offline-v1:";
export function readLocal(family: string): LocalData {
  try {
    return (
      (migrateCategoryCache(
        JSON.parse(localStorage.getItem(prefix + family) || "null"),
      ) as LocalData | null) || { cache: {}, pending: [] }
    );
  } catch {
    return { cache: {}, pending: [] };
  }
}
function writeLocal(family: string, data: LocalData) {
  try {
    localStorage.setItem(prefix + family, JSON.stringify(data));
  } catch {
    throw new Error("Não foi possível salvar neste celular. Libere espaço antes de continuar.");
  }
}
export function cached<T>(family: string, key: readonly unknown[]): T | undefined {
  return readLocal(family).cache[JSON.stringify(key)] as T | undefined;
}
export function saveCache<T>(family: string, key: readonly unknown[], value: T): T {
  const data = readLocal(family);
  data.cache[JSON.stringify(key)] = value;
  writeLocal(family, data);
  return value;
}
export function overlayItems<T extends { id: string }>(
  items: T[],
  pending: PendingWrite[],
  listaId: string,
): T[] {
  let result = [...items];
  for (const op of pending.filter((p) => p.listaId === listaId)) {
    if (op.kind === "finalize" || op.kind === "history" || op.kind === "category") continue;
    if (op.kind === "delete") result = result.filter((i) => i.id !== op.itemId);
    else if (op.kind === "insert" && !result.some((i) => i.id === op.itemId))
      result.push({ id: op.itemId, ...op.values } as T);
    else result = result.map((i) => (i.id === op.itemId ? { ...i, ...op.values } : i));
  }
  return result;
}
export function enqueue(
  family: string,
  op: PendingWrite,
  key: readonly unknown[],
  items: unknown[],
) {
  const data = readLocal(family);
  data.pending.push(op);
  data.cache[JSON.stringify(key)] = items;
  writeLocal(family, data);
  window.dispatchEvent(new Event("mercado-offline-change"));
}
// Persist the receipt, card balance, list changes and queued finalization together.
export function enqueueFinalization(
  family: string,
  op: PendingWrite,
  entries: { key: readonly unknown[]; value: unknown }[],
) {
  const data = readLocal(family);
  if (
    op.kind === "finalize" &&
    data.pending.some((p) => p.kind === "finalize" && p.listaId === op.listaId)
  )
    throw new Error("Esta compra já foi finalizada neste celular.");
  data.pending.push(op);
  for (const entry of entries) data.cache[JSON.stringify(entry.key)] = entry.value;
  writeLocal(family, data);
  window.dispatchEvent(new Event("mercado-offline-change"));
}
export class ItemConflictError extends Error {
  constructor(public conflict: NonNullable<PendingWrite["conflict"]>) {
    super(conflict.motivo);
  }
}
export function resolveWrite(family: string, id: string, keepLocal: boolean) {
  const data = readLocal(family);
  const op = data.pending.find((p) => p.id === id);
  if (!op?.conflict) return;
  if (keepLocal) {
    if (op.conflict.bloqueado || !op.conflict.atual)
      throw new Error("Esta alteração não pode ser reaplicada. Confira a lista atual.");
    const fields =
      op.kind === "delete"
        ? ["nome", "setor", "qtd", "preco", "comprado", "inesperado"]
        : Object.keys(op.values);
    op.base = Object.fromEntries(fields.map((k) => [k, op.conflict!.atual![k]]));
    delete op.conflict;
  } else data.pending = data.pending.filter((p) => p.id !== id);
  writeLocal(family, data);
  window.dispatchEvent(new Event("mercado-offline-change"));
}
const running = new Map<string, Promise<void>>();
export function flushWrites(
  family: string,
  send: (op: PendingWrite) => Promise<void>,
): Promise<void> {
  const active = running.get(family);
  if (active) return active;
  const run = async () => {
    while (typeof navigator === "undefined" || navigator.onLine) {
      const pending = readLocal(family).pending;
      const op = pending.find(
        (p, index) =>
          !p.conflict &&
          !pending
            .slice(0, index)
            .some(
              (earlier) =>
                earlier.conflict &&
                earlier.listaId === p.listaId &&
                (earlier.itemId === p.itemId || p.kind === "finalize" || p.kind === "history"),
            ),
      );
      if (!op) break;
      try {
        await send(op);
      } catch (error) {
        if (!(error instanceof ItemConflictError)) throw error;
        const local = readLocal(family);
        const saved = local.pending.find((p) => p.id === op.id);
        if (saved) saved.conflict = error.conflict;
        writeLocal(family, local);
        window.dispatchEvent(new Event("mercado-offline-change"));
        continue;
      }
      const data = readLocal(family);
      data.pending = data.pending.filter((p) => p.id !== op.id);
      writeLocal(family, data);
      window.dispatchEvent(new Event("mercado-offline-change"));
    }
  };
  const promise = run().finally(() => running.delete(family));
  running.set(family, promise);
  return promise;
}
// Explicitly reopen an offline receipt rejected by the server; reconcile balances from the server next.
export function reopenFinalization(family: string, id: string) {
  const data = readLocal(family),
    op = data.pending.find((p) => p.id === id && p.kind === "finalize");
  if (!op) return;
  const get = (key: unknown[]) => data.cache[JSON.stringify(key)] as any;
  const put = (key: unknown[], value: unknown) => {
    data.cache[JSON.stringify(key)] = value;
  };
  const list = op.values["lista"] as any,
    pendingId = String(op.values["pendenciasId"]);
  const history = (get(["compras", family]) || []) as any[];
  const receipt = history.find((h) => h.id === op.id);
  put(
    ["compras", family],
    history.filter((h) => h.id !== op.id),
  );
  put(
    ["cartoes", family],
    (get(["cartoes", family]) || []).map((c: any) =>
      c.id === list.cartao_id
        ? {
            ...c,
            saldo: Math.round((c.saldo + Number(receipt?.total ?? op.values["total"])) * 100) / 100,
          }
        : c,
    ),
  );
  put(
    ["listas", family],
    [
      list,
      ...(get(["listas", family]) || []).filter((l: any) => l.id !== list.id && l.id !== pendingId),
    ],
  );
  put(
    ["itens", family, list.id],
    [...((op.values["produtos"] as any[]) || []), ...(get(["itens", family, pendingId]) || [])],
  );
  put(["selected"], list.id);
  const originals = (op.values["produtos"] as any[]) || [];
  const edited = (receipt?.produtos as any[]) || originals;
  const fields = ["nome", "setor", "qtd", "preco"];
  const itemWrites: PendingWrite[] = [];
  for (const original of originals) {
    const updated = edited.find((i) => i.id === original.id);
    if (!updated)
      itemWrites.push({
        id: crypto.randomUUID(),
        listaId: list.id,
        itemId: original.id,
        kind: "delete",
        values: {},
        base: Object.fromEntries([...fields, "comprado"].map((k) => [k, original[k]])),
      });
    else {
      const changed = fields.filter((k) => updated[k] !== original[k]);
      if (changed.length)
        itemWrites.push({
          id: crypto.randomUUID(),
          listaId: list.id,
          itemId: original.id,
          kind: "update",
          values: Object.fromEntries(changed.map((k) => [k, updated[k]])),
          base: Object.fromEntries(changed.map((k) => [k, original[k]])),
        });
    }
  }
  for (const added of edited.filter((i) => !originals.some((o) => o.id === i.id)))
    itemWrites.push({
      id: crypto.randomUUID(),
      listaId: list.id,
      itemId: added.id,
      kind: "insert",
      values: { ...Object.fromEntries(fields.map((k) => [k, added[k]])), comprado: true },
    });
  data.pending = [
    ...data.pending.filter(
      (p) =>
        p.id !== id &&
        !(
          p.kind === "history" &&
          (p.values["compraId"] === id || p.values["finalizacaoId"] === id)
        ),
    ),
    ...itemWrites,
  ];
  // Preserve edits to the list of remaining products by moving those operations back to the reopened list.
  for (const pending of data.pending)
    if (pending.listaId === pendingId) {
      pending.listaId = list.id;
      delete pending.conflict;
    }
  writeLocal(family, data);
  window.dispatchEvent(new Event("mercado-offline-change"));
}
