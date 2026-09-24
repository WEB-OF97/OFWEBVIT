import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  basePath,
  query,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function link(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  }

  return (
    <nav className="pager" aria-label="Pagination">
      {page > 1 ? <Link href={link(page - 1)}>Précédent</Link> : <span />}
      <span>
        Page {page} / {totalPages}
      </span>
      {page < totalPages ? <Link href={link(page + 1)}>Suivant</Link> : <span />}
    </nav>
  );
}
