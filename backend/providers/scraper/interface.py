from typing import Protocol, runtime_checkable

from pydantic import BaseModel


class ScrapedShopData(BaseModel):
    """Data scraped from Google Maps via Apify."""

    name: str
    address: str
    latitude: float
    longitude: float
    google_place_id: str
    rating: float | None = None
    review_count: int = 0
    opening_hours: list[str] | None = None
    phone: str | None = None
    website: str | None = None
    menu_url: str | None = None
    country_code: str | None = None
    price_range: str | None = None
    permanently_closed: bool = False
    categories: list[str] = []
    reviews: list[dict[str, str | int | None]] = []
    photo_urls: list[str] = []


class BatchScrapeInput(BaseModel):
    shop_id: str
    google_maps_url: str


class BatchScrapeResult(BaseModel):
    shop_id: str
    data: ScrapedShopData | None


@runtime_checkable
class ScraperProvider(Protocol):
    async def scrape_by_url(self, google_maps_url: str) -> ScrapedShopData | None:
        """Scrape a shop by Google Maps URL. Returns None if not found."""
        ...

    async def scrape_batch(self, shops: list[BatchScrapeInput]) -> list[BatchScrapeResult]:
        """Scrape multiple shops in a single Apify actor run."""
        ...

    async def scrape_reviews_only(self, google_place_id: str) -> list[dict[str, str | int | None]]:
        """Scrape only reviews for a known place (for staleness check)."""
        ...

    async def close(self) -> None:
        """Clean up resources."""
        ...
