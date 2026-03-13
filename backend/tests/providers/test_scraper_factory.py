from unittest.mock import patch

import pytest


class TestScraperFactory:
    """Verify scraper factory selects the correct adapter from settings."""

    def test_apify_provider_returns_apify_scraper_adapter(self):
        """When scraper_provider is 'apify', factory returns an ApifyScraperAdapter."""
        with patch("providers.scraper.settings") as mock_settings:
            mock_settings.scraper_provider = "apify"
            mock_settings.apify_api_token = "apify_test_token_abc123"
            from providers.scraper import get_scraper_provider
            from providers.scraper.apify_adapter import ApifyScraperAdapter

            provider = get_scraper_provider()
            assert isinstance(provider, ApifyScraperAdapter)

    def test_unknown_scraper_provider_raises_value_error(self):
        """When scraper_provider is unrecognised, factory raises ValueError."""
        with patch("providers.scraper.settings") as mock_settings:
            mock_settings.scraper_provider = "nonexistent_provider"
            from providers.scraper import get_scraper_provider

            with pytest.raises(ValueError, match="Unknown scraper provider"):
                get_scraper_provider()
