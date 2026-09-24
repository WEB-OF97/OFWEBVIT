import Link from "next/link";
import type { Category } from "@/lib/types";

export function CategoryList({ categories, active }: { categories: Category[]; active?: string }) {
  if (!categories.length) return null;
  return (
    <ul className="cats">
      {categories.map((category) => (
        <li key={category.code}>
          <Link
            href={`/categorie/${category.code}`}
            className={category.code === active ? "cat active" : "cat"}
          >
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
