from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

SHOP_ROW = {
    "id": "shop-001",
    "name": "山小孩咖啡",
    "slug": "shan-xiao-hai-ka-fei",
    "address": "台北市大安區仁愛路四段122號",
    "latitude": 25.033,
    "longitude": 121.543,
    "rating": 4.6,
    "review_count": 100,
    "mode_work": 0.8,
    "mode_rest": 0.5,
    "mode_social": 0.3,
    "processing_status": "live",
}


def _make_table_mock(table_responses: dict) -> MagicMock:
    """Build a mock Supabase client where table(name) returns a per-table mock chain."""

    def _table_side_effect(name: str) -> MagicMock:
        return table_responses.get(name, MagicMock())

    mock_client = MagicMock()
    mock_client.table.side_effect = _table_side_effect
    return mock_client


def _simple_select_chain(data) -> MagicMock:
    """Return a chainable mock that ends with .execute() -> data."""
    execute_mock = MagicMock(return_value=MagicMock(data=data))
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain
    chain.maybe_single.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.not_.return_value = chain
    chain.offset.return_value = chain
    chain.execute = execute_mock
    return chain


class TestShopsAPI:
    def test_list_shops_is_public(self):
        """GET /shops should not require auth."""
        with patch("api.shops.get_anon_client") as mock_sb:
            mock_client = MagicMock()
            mock_client.table = MagicMock(
                return_value=MagicMock(
                    select=MagicMock(
                        return_value=MagicMock(execute=MagicMock(return_value=MagicMock(data=[])))
                    )
                )
            )
            mock_sb.return_value = mock_client
            response = client.get("/shops")
            assert response.status_code == 200

    def test_get_shop_by_id_is_public(self):
        """GET /shops/{id} should not require auth."""
        with patch("api.shops.get_anon_client") as mock_sb:
            mock_client = MagicMock()
            mock_client.table = MagicMock(
                return_value=MagicMock(
                    select=MagicMock(
                        return_value=MagicMock(
                            eq=MagicMock(
                                return_value=MagicMock(
                                    single=MagicMock(
                                        return_value=MagicMock(
                                            execute=MagicMock(
                                                return_value=MagicMock(
                                                    data={"id": "shop-1", "name": "Test Cafe"}
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
            mock_sb.return_value = mock_client
            response = client.get("/shops/shop-1")
            assert response.status_code == 200

    def test_get_shop_detail_includes_photo_urls(self):
        """GET /shops/{id} response includes photoUrls extracted from nested shop_photos JOIN data."""
        shop_with_photos = {
            **SHOP_ROW,
            "shop_photos": [
                {"photo_url": "https://example.com/p1.jpg"},
                {"photo_url": "https://example.com/p2.jpg"},
            ],
            "shop_tags": [],
        }
        shop_chain = _simple_select_chain(shop_with_photos)

        with patch("api.shops.get_anon_client") as mock_sb:
            mock_sb.return_value = MagicMock(table=MagicMock(return_value=shop_chain))
            response = client.get("/shops/shop-001")

        assert response.status_code == 200
        data = response.json()
        assert data["photoUrls"] == [
            "https://example.com/p1.jpg",
            "https://example.com/p2.jpg",
        ]

    def test_get_shop_detail_returns_slug_from_db(self):
        """GET /shops/{id} returns the slug stored in the DB (set by backfill script)."""
        shop_chain = _simple_select_chain({**SHOP_ROW, "shop_photos": [], "shop_tags": []})

        with patch("api.shops.get_anon_client") as mock_sb:
            mock_sb.return_value = MagicMock(table=MagicMock(return_value=shop_chain))
            response = client.get("/shops/shop-001")

        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "shan-xiao-hai-ka-fei"

    def test_get_shop_detail_includes_mode_scores(self):
        """GET /shops/{id} returns modeScores dict built from mode_work/rest/social columns."""
        shop_chain = _simple_select_chain({**SHOP_ROW, "shop_photos": [], "shop_tags": []})

        with patch("api.shops.get_anon_client") as mock_sb:
            mock_sb.return_value = MagicMock(table=MagicMock(return_value=shop_chain))
            response = client.get("/shops/shop-001")

        assert response.status_code == 200
        data = response.json()
        assert data["modeScores"] == {"work": 0.8, "rest": 0.5, "social": 0.3}

    def test_get_shop_detail_returns_structured_taxonomy_tags(self):
        """GET /shops/{id} returns taxonomyTags as array of {id, dimension, label, labelZh}."""
        shop_data = {
            **SHOP_ROW,
            "shop_photos": [],
            "shop_tags": [
                {
                    "tag_id": "quiet",
                    "tag_name": "quiet",
                    "taxonomy_tags": {
                        "id": "quiet",
                        "dimension": "ambience",
                        "label": "Quiet",
                        "label_zh": "安靜",
                    },
                }
            ],
        }
        shop_chain = _simple_select_chain(shop_data)

        with patch("api.shops.get_anon_client") as mock_sb:
            mock_sb.return_value = MagicMock(table=MagicMock(return_value=shop_chain))
            response = client.get("/shops/shop-001")

        data = response.json()
        assert "taxonomyTags" in data
        assert "tags" not in data
        assert data["taxonomyTags"] == [
            {"id": "quiet", "dimension": "ambience", "label": "Quiet", "labelZh": "安靜"}
        ]

    def test_get_shop_detail_returns_camel_case_keys(self):
        """GET /shops/{id} response uses camelCase keys (photoUrls, modeScores, not photo_urls, mode_scores)."""
        shop_chain = _simple_select_chain(
            {
                **SHOP_ROW,
                "shop_photos": [{"photo_url": "https://example.com/p1.jpg"}],
                "shop_tags": [],
            }
        )
        with patch("api.shops.get_anon_client") as mock_sb:
            mock_sb.return_value = MagicMock(table=MagicMock(return_value=shop_chain))
            response = client.get("/shops/shop-001")

        data = response.json()
        assert "photoUrls" in data
        assert "photo_urls" not in data
        assert "modeScores" in data
        assert "mode_scores" not in data

    def test_list_shops_featured_returns_live_shops_only(self):
        """GET /shops?featured=true filters to processing_status=live shops."""
        live_shops = [
            {**SHOP_ROW, "id": "shop-001"},
            {**SHOP_ROW, "id": "shop-002"},
        ]

        chain = _simple_select_chain(live_shops)

        with patch("api.shops.get_anon_client") as mock_sb:
            mock_sb.return_value = MagicMock(table=MagicMock(return_value=chain))
            response = client.get("/shops?featured=true&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # The chain must have had .eq("processing_status", "live") applied
        chain.eq.assert_any_call("processing_status", "live")
        chain.limit.assert_called()
