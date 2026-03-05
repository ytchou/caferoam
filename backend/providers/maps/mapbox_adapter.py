import logging

import httpx

from models.types import GeocodingResult

logger = logging.getLogger(__name__)


class MapboxMapsAdapter:
    BASE_URL = "https://api.mapbox.com/search/geocode/v6"

    def __init__(self, access_token: str):
        self._token = access_token
        self._client = httpx.AsyncClient(timeout=10.0)

    async def geocode(self, address: str) -> GeocodingResult | None:
        try:
            response = await self._client.get(
                f"{self.BASE_URL}/forward",
                params={
                    "q": address,
                    "access_token": self._token,
                    "country": "TW",
                    "language": "zh",
                    "limit": 1,
                },
            )
            response.raise_for_status()
            data = response.json()
            features = data.get("features", [])
            if not features:
                return None
            feature = features[0]
            coords = feature["geometry"]["coordinates"]
            return GeocodingResult(
                latitude=coords[1],
                longitude=coords[0],
                formatted_address=feature["properties"]["full_address"],
            )
        except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.ConnectError, KeyError) as e:
            logger.warning("Mapbox geocode failed: %s", e)
            return None

    async def reverse_geocode(self, lat: float, lng: float) -> str | None:
        try:
            response = await self._client.get(
                f"{self.BASE_URL}/reverse",
                params={
                    "longitude": lng,
                    "latitude": lat,
                    "access_token": self._token,
                    "language": "zh",
                    "limit": 1,
                },
            )
            response.raise_for_status()
            data = response.json()
            features = data.get("features", [])
            if not features:
                return None
            return str(features[0]["properties"]["full_address"])
        except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.ConnectError, KeyError) as e:
            logger.warning("Mapbox reverse geocode failed: %s", e)
            return None

    async def close(self) -> None:
        await self._client.aclose()
