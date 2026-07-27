from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SubjectCreate(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=180)
    course_id: int
    department_id: int
    semester: int = Field(ge=1, le=12)
    credits: int = Field(ge=1, le=30)
    is_active: bool = True


class SubjectUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=40)
    name: str | None = Field(default=None, min_length=2, max_length=180)
    course_id: int | None = None
    department_id: int | None = None
    semester: int | None = Field(default=None, ge=1, le=12)
    credits: int | None = Field(default=None, ge=1, le=30)
    is_active: bool | None = None


class SubjectOut(SubjectCreate, ORMModel):
    id: int
