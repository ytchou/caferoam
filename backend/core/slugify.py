import re
import unicodedata

from pypinyin import lazy_pinyin

_NONALNUM = re.compile(r"[^a-z0-9]+")
_MAX_LEN = 60


def generate_slug(name: str) -> str:
    """Convert a shop name (Chinese/English/mixed) to a URL-safe slug."""
    if not name.strip():
        return ""

    # Convert Chinese characters to pinyin, keep non-Chinese as-is
    parts = lazy_pinyin(name)
    joined = " ".join(parts)

    # Normalize unicode (é → e), lowercase
    normalized = unicodedata.normalize("NFKD", joined)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii").lower()

    # Replace non-alphanumeric with hyphens, collapse multiples
    slug = _NONALNUM.sub("-", ascii_only).strip("-")

    # Truncate to max length without splitting mid-word
    if len(slug) > _MAX_LEN:
        slug = slug[:_MAX_LEN].rsplit("-", 1)[0]

    return slug
