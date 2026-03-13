from models.types import TaxonomyTag, ShopModeScores


class TestCamelCaseSerialization:
    def test_taxonomy_tag_serializes_label_zh_as_camel_case(self):
        """When a TaxonomyTag is serialized to dict, label_zh becomes labelZh."""
        tag = TaxonomyTag(id="quiet", dimension="ambience", label="Quiet", label_zh="安靜")
        data = tag.model_dump(by_alias=True)
        assert "labelZh" in data
        assert "label_zh" not in data
        assert data["labelZh"] == "安靜"

    def test_shop_mode_scores_fields_stay_simple(self):
        """ShopModeScores has no multi-word fields, so output is unchanged."""
        scores = ShopModeScores(work=0.8, rest=0.5, social=0.3)
        data = scores.model_dump(by_alias=True)
        assert data == {"work": 0.8, "rest": 0.5, "social": 0.3}

    def test_taxonomy_tag_can_be_constructed_with_snake_case(self):
        """Python code can still use snake_case field names thanks to populate_by_name."""
        tag = TaxonomyTag(id="wifi", dimension="functionality", label="Wi-Fi", label_zh="有 Wi-Fi")
        assert tag.label_zh == "有 Wi-Fi"
