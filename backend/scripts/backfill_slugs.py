"""One-time script: generate slugs for all shops missing them."""
import asyncio

from core.config import settings
from core.slugify import generate_slug
from supabase import create_client


async def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_role_key)
    result = db.table("shops").select("id, name").is_("slug", "null").execute()
    shops = result.data or []
    print(f"Found {len(shops)} shops without slugs")

    seen_slugs: set[str] = set()
    for shop in shops:
        slug = generate_slug(shop["name"])
        # Handle collisions by appending short ID prefix
        if slug in seen_slugs:
            slug = f"{slug}-{shop['id'][:8]}"
        seen_slugs.add(slug)

        db.table("shops").update({"slug": slug}).eq("id", shop["id"]).execute()
        print(f"  {shop['name']} → {slug}")

    print(f"Updated {len(shops)} slugs")


if __name__ == "__main__":
    asyncio.run(main())
