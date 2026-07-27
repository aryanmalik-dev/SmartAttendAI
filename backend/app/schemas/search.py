from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SearchResultOut(BaseModel):
    entity_type: str
    id: int
    title: str
    subtitle: str | None = None
    meta: dict[str, str | int | float | bool | None] | None = None


class GlobalSearchOut(BaseModel):
    query: str
    total: int
    items: list[SearchResultOut]
