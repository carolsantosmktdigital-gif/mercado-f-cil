import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { it, expect, vi } from "vitest";
function setup() {
  const origin = "https://mercado.test",
    events: Record<string, Function> = {},
    stores = new Map<string, any>();
  let offline = false,
    broken = false;
  class Request {
    url: string;
    method = "GET";
    mode = "navigate";
    cache: string;
    constructor(value: any, options: any = {}) {
      this.url = new URL(typeof value === "string" ? value : value.url, origin).href;
      this.mode = value.mode || "navigate";
      this.cache = options.cache || "default";
    }
  }
  const response = (body: string) => ({
    ok: true,
    clone: () => response(body),
    text: async () => body,
  });
  const fetch = vi.fn(async (request: any) => {
    if (offline || (broken && request.url.endsWith("entry.js"))) throw Error("offline");
    return response(
      request.url.endsWith(".js") ? "script" : '<script src="/assets/entry.js"></script>',
    );
  });
  const key = (request: any) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) {
        const entries = new Map<string, any>();
        stores.set(name, {
          entries,
          put: async (k: any, v: any) => {
            entries.set(key(k), v);
          },
          match: async (k: any) => entries.get(key(k)),
          keys: async () => [...entries.keys()].map((url) => new Request(url)),
          add: async (url: any) => {
            const request = new Request(url);
            const value = await fetch(request);
            entries.set(key(request), value);
          },
        });
      }
      return stores.get(name);
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const self = {
    location: { origin },
    addEventListener: (name: string, handler: Function) => {
      events[name] = handler;
    },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  runInNewContext(readFileSync(process.cwd() + "/public/sw.js", "utf8"), {
    self,
    caches,
    fetch,
    Request,
    URL,
    Set,
    Promise,
  });
  const lifecycle = async (name: string) => {
    let task: Promise<any> | undefined;
    events[name]!({ waitUntil: (promise: Promise<any>) => (task = promise) });
    await task;
  };
  const navigate = async () => {
    let task: Promise<any> | undefined;
    events["fetch"]!({
      request: new Request("/"),
      respondWith: (promise: Promise<any>) => (task = promise),
    });
    return task;
  };
  return {
    caches,
    stores,
    self,
    lifecycle,
    navigate,
    response,
    fetch,
    setOffline: () => {
      offline = true;
    },
    breakAsset: () => {
      broken = true;
    },
  };
}
it("retires obsolete HTML while preserving resources for already open tabs", async () => {
  const env = setup(),
    old = await env.caches.open("mercado-shell-v8");
  await old.put("/", env.response("old home"));
  await old.put("/assets/old.js", env.response("old script"));
  await env.lifecycle("activate");
  expect(env.stores.has("mercado-shell-v8")).toBe(false);
  expect(await (await env.caches.open("mercado-assets-v1")).match("/assets/old.js")).toBeDefined();
  expect(env.self.clients.claim).toHaveBeenCalledOnce();
});
it("fetches fresh HTML without browser cache and retains that exact shell offline", async () => {
  const env = setup();
  const current = await env.navigate();
  expect(env.fetch.mock.calls[0]?.[0].cache).toBe("no-store");
  env.setOffline();
  expect(await env.navigate()).toBeDefined();
  expect(await (await env.navigate())!.text()).toBe(await current!.text());
});
it("does not activate an incomplete release when a required script fails to download", async () => {
  const env = setup();
  await env.caches.open("mercado-shell-v8");
  env.breakAsset();
  await expect(env.lifecycle("install")).rejects.toThrow("offline");
  expect(env.self.skipWaiting).not.toHaveBeenCalled();
  expect(env.stores.has("mercado-shell-v8")).toBe(true);
});
