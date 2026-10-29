export function categoryName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (key === "lavinia") return "Crianças";
  if (["lacticinios", "laticinios"].includes(key)) return "Laticínios";
  return name;
}
export function validateCategory(value: string) {
  const name = categoryName(value);
  if (!name || name.length > 60) throw new Error("Informe uma categoria com até 60 caracteres.");
  if (name.toLocaleLowerCase("pt-BR") === "todos")
    throw new Error("Escolha outro nome: Todos é um filtro da lista.");
  return name;
}
// Rename the old category in cached lists and queued writes, without changing product names.
export function migrateCategoryCache(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(migrateCategoryCache);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === "setor" && typeof item === "string"
          ? categoryName(item)
          : migrateCategoryCache(item),
      ]),
    );
  return value;
}
