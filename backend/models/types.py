from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, field_validator

TaxonomyDimension = Literal["functionality", "time", "ambience", "mode", "coffee"]


class ShopModeScores(BaseModel):
    work: float = 0.0
    rest: float = 0.0
    social: float = 0.0


class TaxonomyTag(BaseModel):
    id: str
    dimension: TaxonomyDimension
    label: str
    label_zh: str


class Shop(BaseModel):
    id: str
    name: str
    address: str
    latitude: float
    longitude: float
    mrt: str | None = None
    phone: str | None = None
    website: str | None = None
    opening_hours: list[str] | None = None
    rating: float | None = None
    review_count: int
    price_range: str | None = None
    description: str | None = None
    photo_urls: list[str]
    menu_url: str | None = None
    taxonomy_tags: list[TaxonomyTag]
    mode_scores: ShopModeScores | None = None
    cafenomad_id: str | None = None
    google_place_id: str | None = None
    created_at: datetime
    updated_at: datetime


class User(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    pdpa_consent_at: datetime | None = None
    deletion_requested_at: datetime | None = None
    created_at: datetime


class List(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: datetime
    updated_at: datetime


class ListItem(BaseModel):
    list_id: str
    shop_id: str
    added_at: datetime


class CheckIn(BaseModel):
    id: str
    user_id: str
    shop_id: str
    photo_urls: list[str]
    menu_photo_url: str | None = None
    note: str | None = None
    created_at: datetime

    @field_validator("photo_urls")
    @classmethod
    def at_least_one_photo(cls, v: list[str]) -> list[str]:
        if len(v) < 1:
            raise ValueError("At least one photo is required for check-in")
        return v


class Stamp(BaseModel):
    id: str
    user_id: str
    shop_id: str
    check_in_id: str
    design_url: str
    earned_at: datetime


class SearchFilters(BaseModel):
    dimensions: dict[TaxonomyDimension, list[str]] | None = None
    near_latitude: float | None = None
    near_longitude: float | None = None
    radius_km: float | None = None


class SearchQuery(BaseModel):
    text: str
    filters: SearchFilters | None = None
    limit: int | None = None


class SearchResult(BaseModel):
    shop: Shop
    similarity_score: float
    taxonomy_boost: float
    total_score: float


class ShopEnrichmentInput(BaseModel):
    name: str
    reviews: list[str]
    description: str | None = None
    categories: list[str] = []
    price_range: str | None = None
    socket: str | None = None
    limited_time: str | None = None
    rating: float | None = None
    review_count: int | None = None


# --- Provider result types ---


class EnrichmentResult(BaseModel):
    tags: list[TaxonomyTag]
    tag_confidences: dict[str, float] = {}
    summary: str
    confidence: float
    mode_scores: ShopModeScores | None = None


class MenuExtractionResult(BaseModel):
    items: list[dict[str, str | int | float | bool | None]]
    raw_text: str | None = None


class GeocodingResult(BaseModel):
    latitude: float
    longitude: float
    formatted_address: str


class EmailMessage(BaseModel):
    to: str
    subject: str
    html: str
    from_address: str | None = None


class EmailSendResult(BaseModel):
    id: str


# --- Job queue types ---


class JobType(StrEnum):
    ENRICH_SHOP = "enrich_shop"
    ENRICH_MENU_PHOTO = "enrich_menu_photo"
    GENERATE_EMBEDDING = "generate_embedding"
    STALENESS_SWEEP = "staleness_sweep"
    WEEKLY_EMAIL = "weekly_email"
    SCRAPE_SHOP = "scrape_shop"
    PUBLISH_SHOP = "publish_shop"
    ADMIN_DIGEST_EMAIL = "admin_digest_email"


class JobStatus(StrEnum):
    PENDING = "pending"
    CLAIMED = "claimed"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


class Job(BaseModel):
    id: str
    job_type: JobType
    payload: dict[str, Any]
    status: JobStatus
    priority: int = 0
    attempts: int = 0
    max_attempts: int = 3
    last_error: str | None = None
    scheduled_at: datetime
    claimed_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


# --- Pipeline types ---


class ProcessingStatus(StrEnum):
    PENDING = "pending"
    PENDING_URL_CHECK = "pending_url_check"
    PENDING_REVIEW = "pending_review"
    SCRAPING = "scraping"
    ENRICHING = "enriching"
    EMBEDDING = "embedding"
    PUBLISHING = "publishing"
    LIVE = "live"
    FAILED = "failed"
    FILTERED_DEAD_URL = "filtered_dead_url"


class ShopSubmission(BaseModel):
    id: str
    submitted_by: str
    google_maps_url: str
    shop_id: str | None = None
    status: str = "pending"
    failure_reason: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ActivityFeedEvent(BaseModel):
    id: str
    event_type: str
    actor_id: str | None = None
    shop_id: str | None = None
    metadata: dict[str, Any] = {}
    created_at: datetime | None = None
