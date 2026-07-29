from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    abbreviation: str = Field(min_length=1, max_length=30)
    course_id: int
    description: str | None = None
    low_attendance_threshold: float = Field(default=75.0, ge=0, le=100)


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    abbreviation: str | None = Field(default=None, min_length=1, max_length=30)
    course_id: int | None = None
    description: str | None = None
    low_attendance_threshold: float | None = Field(default=None, ge=0, le=100)


class DepartmentOut(DepartmentCreate, ORMModel):
    id: int
