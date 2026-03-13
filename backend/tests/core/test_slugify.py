import pytest
from core.slugify import generate_slug


class TestGenerateSlug:
    def test_chinese_shop_name_becomes_pinyin(self):
        assert generate_slug("山小孩咖啡") == "shan-xiao-hai-ka-fei"

    def test_english_name_lowercased_and_hyphenated(self):
        assert generate_slug("Café Nomad") == "cafe-nomad"

    def test_mixed_chinese_english(self):
        result = generate_slug("好咖啡 Good Coffee")
        assert result == "hao-ka-fei-good-coffee"

    def test_strips_special_characters(self):
        result = generate_slug("咖啡廳 (大安店)")
        assert "(" not in result
        assert ")" not in result

    def test_truncates_at_60_chars(self):
        long_name = "這是一個非常非常非常非常非常非常非常非常非常長的咖啡廳名字"
        result = generate_slug(long_name)
        assert len(result) <= 60

    def test_empty_string_returns_empty(self):
        assert generate_slug("") == ""

    def test_no_leading_or_trailing_hyphens(self):
        result = generate_slug(" 咖啡 ")
        assert not result.startswith("-")
        assert not result.endswith("-")

    def test_collapses_consecutive_hyphens(self):
        result = generate_slug("咖啡  &  茶")
        assert "--" not in result
