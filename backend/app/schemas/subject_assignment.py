from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SubjectAssignmentCreate(BaseModel):
    faculty_id: int
    subject_id: int
    section: str = Field(min_length=1, max_length=10)
    academic_year: str = Field(min_length=4, max_length=20)
    is_active: bool = True


class SubjectAssignmentUpdate(BaseModel):
    faculty_id: int | None = None
    subject_id: int | None = None
    section: str | None = Field(default=None, min_length=1, max_length=10)
    academic_year: str | None = Field(default=None, min_length=4, max_length=20)
    is_active: bool | None = None


class SubjectAssignmentOut(SubjectAssignmentCreate, ORMModel):
    id: int
