export const MEALS = ["Café da manhã", "Almoço", "Jantar", "Lanches"] as const;
export type Meal = (typeof MEALS)[number];
export type TemplateItem = {
  nome: string;
  setor: string;
  qtd: number;
  unidade: string;
  nomeCompleto?: string;
};
export type Preferences = {
  total: number;
  adultos: number;
  criancas: number;
  dias: number;
  refeicoes: Meal[];
};
type Product = [string, string, number, string, Meal[]?];
// Suggested household quantities for two adults over 30 days; not dietary prescriptions.
const products: Product[] = [
  ["Arroz", "Mercearia", 5, "kg", ["Almoço", "Jantar"]],
  ["Feijão", "Mercearia", 2, "kg", ["Almoço", "Jantar"]],
  ["Macarrão", "Mercearia", 3, "pacotes de 500 g", ["Almoço", "Jantar"]],
  ["Molho de tomate", "Mercearia", 4, "sachês", ["Almoço", "Jantar"]],
  ["Óleo", "Mercearia", 1, "garrafa de 900 ml", ["Almoço", "Jantar"]],
  ["Azeite", "Mercearia", 1, "garrafa de 500 ml", ["Almoço", "Jantar"]],
  ["Sal", "Mercearia", 1, "pacote de 1 kg", ["Almoço", "Jantar"]],
  ["Açúcar", "Mercearia", 1, "pacote de 1 kg", ["Café da manhã", "Lanches"]],
  ["Café", "Mercearia", 2, "pacotes de 500 g", ["Café da manhã"]],
  ["Farinha de trigo", "Mercearia", 1, "pacote de 1 kg", ["Café da manhã", "Lanches"]],
  ["Farinha de mandioca", "Mercearia", 1, "pacote de 500 g", ["Almoço", "Jantar"]],
  ["Aveia", "Mercearia", 1, "pacote de 500 g", ["Café da manhã", "Lanches"]],
  ["Milho", "Mercearia", 2, "latas", ["Almoço", "Jantar"]],
  ["Ervilha", "Mercearia", 2, "latas", ["Almoço", "Jantar"]],
  ["Temperos", "Mercearia", 2, "pacotes", ["Almoço", "Jantar"]],
  ["Banana", "Hortifrúti", 3, "kg", ["Café da manhã", "Lanches"]],
  ["Maçã", "Hortifrúti", 2, "kg", ["Café da manhã", "Lanches"]],
  ["Laranja", "Hortifrúti", 2, "kg", ["Café da manhã", "Lanches"]],
  ["Limão", "Hortifrúti", 1, "kg", ["Almoço", "Jantar"]],
  ["Tomate", "Hortifrúti", 2, "kg", ["Almoço", "Jantar"]],
  ["Cebola", "Hortifrúti", 1, "kg", ["Almoço", "Jantar"]],
  ["Alho", "Hortifrúti", 2, "porções de 100 g", ["Almoço", "Jantar"]],
  ["Batata", "Hortifrúti", 2, "kg", ["Almoço", "Jantar"]],
  ["Cenoura", "Hortifrúti", 1, "kg", ["Almoço", "Jantar"]],
  ["Alface", "Hortifrúti", 4, "unidades", ["Almoço", "Jantar"]],
  ["Legumes variados", "Hortifrúti", 2, "kg", ["Almoço", "Jantar"]],
  ["Frango", "Carnes", 3, "kg", ["Almoço", "Jantar"]],
  ["Carne bovina", "Carnes", 1, "kg", ["Almoço", "Jantar"]],
  ["Carne moída", "Carnes", 1, "kg", ["Almoço", "Jantar"]],
  ["Peixe", "Carnes", 1, "kg", ["Almoço", "Jantar"]],
  ["Ovos", "Carnes", 30, "unidades", ["Café da manhã", "Almoço", "Jantar"]],
  ["Leite", "Laticínios", 8, "caixas de 1 L", ["Café da manhã", "Lanches"]],
  ["Queijo", "Laticínios", 1, "pacotes de 500 g", ["Café da manhã", "Lanches"]],
  ["Iogurte", "Laticínios", 8, "unidades", ["Café da manhã", "Lanches"]],
  ["Manteiga ou margarina", "Laticínios", 1, "pote de 500 g", ["Café da manhã", "Lanches"]],
  ["Pão de forma", "Padaria", 4, "pacotes", ["Café da manhã", "Lanches"]],
  ["Pão francês", "Padaria", 20, "unidades", ["Café da manhã", "Lanches"]],
  ["Torradas", "Padaria", 2, "pacotes", ["Café da manhã", "Lanches"]],
  ["Detergente", "Limpeza", 2, "frascos de 500 ml"],
  ["Esponja", "Limpeza", 2, "unidades"],
  ["Sabão para roupas", "Limpeza", 1, "pacote de 1 kg"],
  ["Amaciante", "Limpeza", 1, "frasco de 2 L"],
  ["Água sanitária", "Limpeza", 1, "frasco de 1 L"],
  ["Desinfetante", "Limpeza", 1, "frasco de 2 L"],
  ["Limpador multiuso", "Limpeza", 1, "frasco de 500 ml"],
  ["Saco de lixo", "Limpeza", 1, "rolo de 30 unidades"],
  ["Pano de limpeza", "Limpeza", 1, "unidade"],
  ["Papel higiênico", "Higiene", 1, "pacotes de 12 rolos"],
  ["Sabonete", "Higiene", 4, "unidades"],
  ["Creme dental", "Higiene", 2, "tubos"],
  ["Escova de dentes", "Higiene", 2, "unidades"],
  ["Fio dental", "Higiene", 1, "unidade"],
  ["Shampoo", "Higiene", 1, "frasco"],
  ["Condicionador", "Higiene", 1, "frasco"],
  ["Desodorante", "Higiene", 2, "unidades"],
  ["Absorventes", "Higiene", 2, "pacotes"],
];
export function generateShoppingList(p: Preferences): TemplateItem[] {
  if (
    !Number.isInteger(p.total) ||
    p.total < 1 ||
    p.total > 100 ||
    !Number.isInteger(p.adultos) ||
    !Number.isInteger(p.criancas) ||
    p.adultos < 1 ||
    p.criancas < 0 ||
    p.adultos + p.criancas !== p.total
  )
    throw new Error(
      "A soma de adultos e crianças deve ser igual ao total de pessoas. Informe pelo menos um adulto.",
    );
  if (
    ![7, 15, 30].includes(p.dias) ||
    !p.refeicoes.length ||
    p.refeicoes.some((m) => !MEALS.includes(m))
  )
    throw new Error("Selecione o período e pelo menos uma refeição.");
  const all = [...products];
  if (p.criancas)
    all.push(
      ["Cereal", "Crianças", 2, "caixas", ["Café da manhã", "Lanches"]],
      ["Biscoitos", "Crianças", 4, "pacotes", ["Lanches"]],
      ["Shampoo infantil", "Crianças", 1, "frasco"],
      ["Sabonete infantil", "Crianças", 2, "unidades"],
      ["Escova de dentes infantil", "Crianças", 1, "unidade"],
      ["Creme dental infantil", "Crianças", 1, "tubo"],
    );
  return all.flatMap(([nome, setor, base, unidade, meals]) => {
    const selected = meals?.filter((m) => p.refeicoes.includes(m)).length ?? 1;
    if (!selected) return [];
    const people =
      setor === "Crianças" ? p.criancas : (meals ? p.adultos + p.criancas * 0.7 : p.total) / 2;
    const raw = ((base * people * p.dias) / 30) * (meals ? selected / meals.length : 1);
    return [
      {
        nome,
        setor,
        unidade,
        qtd: Math.max(1, Math.ceil(raw)),
      },
    ];
  });
}
