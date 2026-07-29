from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CourseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    abbreviation: str = Field(min_length=1, max_length=40)
    duration_years: int = Field(default=4, ge=1, le=10)
    is_active: bool = True


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    abbreviation: str | None = Field(default=None, min_length=1, max_length=40)
    duration_years: int | None = Field(default=None, ge=1, le=10)
    is_active: bool | None = None


class CourseOut(CourseCreate, ORMModel):
    id: int
