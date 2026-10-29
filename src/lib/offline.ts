// Each family has one atomic local record: queued writes and cached query data.
export type PendingWrite = {
  id: string;
  listaId: string;
  itemId: string;
  kind: "insert" | "update" | "delete" | "finalize";
  values: Record<string, unknown>;
};
type LocalData = { cache: Record<string, unknown>; pending: PendingWrite[] };
const prefix = "mercado-facil-offline-v1:";
export function readLocal(family: string): LocalData {
  try {
    return (
      JSON.parse(localStorage.getItem(prefix + family) || "null") || { cache: {}, pending: [] }
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
    if (op.kind === "finalize") continue;
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
  if (data.pending.some((p) => p.kind === "finalize" && p.listaId === op.listaId))
    throw new Error("Esta compra já foi finalizada neste celular.");
  data.pending.push(op);
  for (const entry of entries) data.cache[JSON.stringify(entry.key)] = entry.value;
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
      const op = readLocal(family).pending[0];
      if (!op) break;
      await send(op); // Absolute values make retries safe, including a lost response.
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
