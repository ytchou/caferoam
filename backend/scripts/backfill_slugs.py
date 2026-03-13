"""One-time script: generate slugs for all shops missing them."""

from core.slugify import generate_slug
from db.supabase_client import get_service_role_client


def main() -> None:
    db = get_service_role_client()
    result = db.table("shops").select("id, name, slug").execute()
    shops = result.data or []

    existing_slugs: set[str] = {s["slug"] for s in shops if s.get("slug")}
    shops_without_slugs = [s for s in shops if not s.get("slug")]
    print(f"Found {len(shops_without_slugs)} shops without slugs")

    updates: list[dict] = []
    for shop in shops_without_slugs:
        slug = generate_slug(shop["name"])
        if slug in existing_slugs:
            slug = f"{slug}-{shop['id'][:8]}"
        existing_slugs.add(slug)
        updates.append({"id": shop["id"], "slug": slug})
        print(f"  {shop['name']} → {slug}")

    if updates:
        db.table("shops").upsert(updates).execute()
        print(f"Updated {len(updates)} slugs")
    else:
        print("No updates needed")


if __name__ == "__main__":
    main()
