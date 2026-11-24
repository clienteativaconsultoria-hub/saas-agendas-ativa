const PAGE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };
type PageableQuery<T> = {
  order(column: string, options?: { ascending?: boolean }): {
    range(from: number, to: number): PromiseLike<PageResult<T>>;
  };
};

/**
 * O Supabase devolve no máximo 1.000 linhas por chamada, sem avisar que cortou.
 * Busca todas as páginas, em ordem estável. Recebe uma função porque cada
 * página precisa de uma consulta nova. Lança erro em vez de devolver lista parcial.
 */
export async function fetchAll<T>(buildQuery: () => PageableQuery<T>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) return all;
  }
}
