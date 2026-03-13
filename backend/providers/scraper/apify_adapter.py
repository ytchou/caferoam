import asyncio
from typing import Any

import structlog
from apify_client import ApifyClient

from providers.scraper.interface import BatchScrapeInput, BatchScrapeResult, ScrapedShopData

logger = structlog.get_logger()

_ACTOR_ID = "compass/crawler-google-places"


class ApifyScraperAdapter:
    """Apify Google Maps scraper implementation."""

    def __init__(self, api_token: str):
        self._client = ApifyClient(api_token)

    async def scrape_by_url(self, google_maps_url: str) -> ScrapedShopData | None:
        results = await self._run_actor(
            {
                "startUrls": [{"url": google_maps_url}],
                "maxCrawledPlacesPerSearch": 1,
                "maxReviews": 20,
                "maxImages": 10,
                "language": "zh-TW",
                "scrapeReviewerName": False,
            }
        )

        if not results:
            logger.warning("Apify returned no results", url=google_maps_url)
            return None

        return self._parse_place(results[0])

    async def scrape_batch(self, shops: list[BatchScrapeInput]) -> list[BatchScrapeResult]:
        """Scrape multiple shops in a single Apify actor run.

        Matches results back to input shops via userData.shopId, which the
        crawler-google-places actor merges into each output item verbatim.

        URL/path matching is unreliable because Apify converts /maps/place/...
        URLs to /maps/search/?api=1&query=... internally, so the output URL
        never matches the input URL.
        """
        if not shops:
            return []

        url_to_shop_id = {s.google_maps_url: s.shop_id for s in shops}
        start_urls = [{"url": s.google_maps_url} for s in shops]

        results = await self._run_actor(
            {
                "startUrls": start_urls,
                "maxCrawledPlacesPerSearch": 1,
                "maxReviews": 20,
                "maxImages": 10,
                "language": "zh-TW",
                "scrapeReviewerName": False,
            }
        )

        matched: dict[str, ScrapedShopData] = {}
        for place in results:
            # inputStartUrl is the original URL we sent — exact match is reliable.
            # (Apify converts place URLs to search URLs in its output `url` field,
            # making that field useless for correlation.)
            input_url = place.get("inputStartUrl", "")
            shop_id = url_to_shop_id.get(input_url)
            if shop_id:
                matched[shop_id] = self._parse_place(place)
            else:
                logger.warning("scrape_batch: no match for inputStartUrl", url=input_url[:80])

        return [BatchScrapeResult(shop_id=s.shop_id, data=matched.get(s.shop_id)) for s in shops]

    async def scrape_reviews_only(self, google_place_id: str) -> list[dict[str, str | int | None]]:
        results = await self._run_actor(
            {
                "startUrls": [
                    {"url": f"https://www.google.com/maps/place/?q=place_id:{google_place_id}"}
                ],
                "maxCrawledPlacesPerSearch": 1,
                "maxReviews": 5,
                "maxImages": 0,
                "scrapeReviewerName": False,
            }
        )

        if not results:
            return []

        return [
            {
                "text": r.get("text", ""),
                "stars": r.get("stars"),
                "published_at": r.get("publishedAtDate"),
            }
            for r in results[0].get("reviews", [])
            if r.get("text")
        ]

    def _parse_place(self, place: dict[str, Any]) -> ScrapedShopData:
        """Parse a raw Apify place dict into ScrapedShopData."""
        location = place.get("location", {})
        return ScrapedShopData(
            name=place.get("title", ""),
            address=place.get("address", ""),
            latitude=location.get("lat", 0.0),
            longitude=location.get("lng", 0.0),
            google_place_id=place.get("placeId", ""),
            rating=place.get("totalScore"),
            review_count=place.get("reviewsCount", 0),
            opening_hours=[
                f"{h.get('day', '')}: {h.get('hours', '')}".strip(": ")
                for h in place.get("openingHours") or []
                if isinstance(h, dict)
            ]
            or None,
            phone=place.get("phone"),
            website=place.get("website"),
            menu_url=place.get("menu"),
            categories=[place["categoryName"]] if place.get("categoryName") else [],
            reviews=[
                {
                    "text": r.get("text", ""),
                    "stars": r.get("stars"),
                    "published_at": r.get("publishedAtDate"),
                }
                for r in place.get("reviews", [])
                if r.get("text")
            ],
            photo_urls=place.get("imageUrls", [])[:10],
        )

    async def _run_actor(self, run_input: dict[str, Any]) -> list[dict[str, Any]]:
        """Run Apify actor synchronously in a thread pool (client is sync)."""

        def _sync_run() -> list[dict[str, Any]]:
            run = self._client.actor(_ACTOR_ID).call(run_input=run_input)
            if run is None:
                return []
            items = list(self._client.dataset(run["defaultDatasetId"]).iterate_items())
            return items

        return await asyncio.to_thread(_sync_run)

    async def close(self) -> None:
        pass
