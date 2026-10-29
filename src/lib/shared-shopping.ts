import { getPersonName, personName, subscribePreferences } from "./preferences";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readLocal } from "./offline";
export function shoppingSnapshot(
  items: {
    id: string;
    nome: string;
    setor: string;
    qtd: number;
    preco: number;
    comprado: boolean;
  }[],
) {
  return JSON.stringify(
    [...items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, nome, setor, qtd, preco, comprado }) => ({
        id,
        nome,
        setor,
        qtd: Number(qtd),
        preco: Number(preco),
        comprado,
      })),
  );
}
export function useSharedShopping(
  family: string,
  list: string,
  pending: number,
  sync: () => Promise<void>,
) {
  const qc = useQueryClient(),
    syncRef = useRef(sync),
    listRef = useRef(list),
    channelRef = useRef<any>(null);
  syncRef.current = sync;
  listRef.current = list;
  const device = useRef(crypto.randomUUID());
  const draft = useRef<{ lista: string; dirty: boolean }>({ lista: "", dirty: false });
  const localPending = () =>
    readLocal(family).pending.filter((p) => p.listaId === listRef.current).length +
    (draft.current.lista === listRef.current && draft.current.dirty ? 1 : 0);
  const waiters = useRef(
    new Map<
      string,
      { remaining: Set<string>; resolve: () => void; reject: (error: Error) => void }
    >(),
  );
  const [connected, setConnected] = useState(false),
    [peers, setPeers] = useState(0),
    [peerPending, setPeerPending] = useState(0),
    [peerNames, setPeerNames] = useState<string[]>([]);
  const report = () => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.track({
      device: device.current,
      name: getPersonName(),
      lista: listRef.current,
      pending: localPending(),
    });
  };
  const inspect = () => {
    const entries = Object.values(channelRef.current?.presenceState() || {}).flat() as any[];
    const others = entries.filter(
      (p) => p.device !== device.current && p.lista === listRef.current,
    );
    return {
      names: others.map((p) => personName(p.name) || "Pessoa sem nome"),
      count: others.length,
      pending: others.reduce((sum, p) => sum + Number(p.pending || 0), 0),
    };
  };
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const key of ["itens", "listas", "cartoes", "compras", "analises"])
          void qc.invalidateQueries({ queryKey: [key, family] });
      }, 150);
    };
    const poll = setInterval(() => {
      if (navigator.onLine && document.visibilityState !== "hidden") invalidate();
    }, 3000);
    const focus = () => {
      void syncRef.current();
      invalidate();
      report();
    };
    const onDraft = (event: Event) => {
      draft.current = (event as CustomEvent).detail;
      report();
    };
    const unsubscribePreferences = subscribePreferences(report);
    window.addEventListener("mercado-shopping-draft", onDraft);
    window.addEventListener("online", focus);
    window.addEventListener("focus", focus);
    if (typeof supabase.channel === "function") {
      const channel = supabase.channel(`familia:${family}`, {
        config: { private: true, presence: { key: device.current } },
      });
      channelRef.current = channel;
      for (const table of [
        "itens_lista",
        "listas_compras",
        "cartoes",
        "compras",
        "analises_compras",
      ])
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `familia_id=eq.${family}` },
          invalidate,
        );
      channel.on("presence", { event: "sync" }, () => {
        const p = inspect();
        setPeerNames(p.names);
        setPeers(p.count);
        setPeerPending(p.pending);
      });
      channel.on("broadcast", { event: "conferir_compra" }, ({ payload }: any) => {
        if (payload.lista !== listRef.current) return;
        void syncRef.current().finally(() => {
          report();
          void channel.send({
            type: "broadcast",
            event: "compra_conferida",
            payload: {
              ticket: payload.ticket,
              device: device.current,
              pending: localPending(),
            },
          });
        });
      });
      channel.on("broadcast", { event: "compra_conferida" }, ({ payload }: any) => {
        const waiter = waiters.current.get(payload.ticket);
        if (!waiter || !waiter.remaining.has(payload.device)) return;
        if (payload.pending) {
          waiter.reject(
            new Error("O outro celular tem alterações pendentes. Aguarde a sincronização."),
          );
          return;
        }
        waiter.remaining.delete(payload.device);
        if (!waiter.remaining.size) waiter.resolve();
      });
      channel.subscribe((state: string) => {
        setConnected(state === "SUBSCRIBED");
        if (state === "SUBSCRIBED") {
          report();
          invalidate();
        }
      });
    }
    return () => {
      unsubscribePreferences();
      clearInterval(poll);
      clearTimeout(timer);
      window.removeEventListener("mercado-shopping-draft", onDraft);
      window.removeEventListener("online", focus);
      window.removeEventListener("focus", focus);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [family, qc]);
  useEffect(() => {
    report();
    const p = inspect();
    setPeerNames(p.names);
    setPeers(p.count);
    setPeerPending(p.pending);
  }, [list, pending]);
  async function checkPeers() {
    if (!connected)
      throw new Error(
        "Aguarde a conexão da lista antes de finalizar. Mantenham os dois apps abertos e conectados.",
      );
    const channel = channelRef.current;
    const entries = Object.values(channel?.presenceState() || {}).flat() as any[];
    const devices = entries
      .filter((p) => p.device !== device.current && p.lista === listRef.current)
      .map((p) => String(p.device));
    if (devices.length) {
      if (!connected)
        throw new Error(
          "A conexão com o outro celular caiu. Aguarde a reconexão antes de finalizar.",
        );
      const ticket = crypto.randomUUID();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.current.delete(ticket);
          reject(
            new Error(
              "O outro celular não confirmou a sincronização. Mantenham os dois apps abertos e tentem novamente.",
            ),
          );
        }, 6000);
        const cleanup = () => {
          clearTimeout(timer);
          waiters.current.delete(ticket);
        };
        waiters.current.set(ticket, {
          remaining: new Set(devices),
          resolve: () => {
            cleanup();
            resolve();
          },
          reject: (error) => {
            cleanup();
            reject(error);
          },
        });
        void channel.send({
          type: "broadcast",
          event: "conferir_compra",
          payload: { lista: listRef.current, ticket },
        });
      });
    }
    if (inspect().pending)
      throw new Error(
        "O outro celular ainda tem alterações pendentes. Aguarde a sincronização antes de finalizar.",
      );
  }
  return { connected, peers, peerPending, peerNames, checkPeers };
}
