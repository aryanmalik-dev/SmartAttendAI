from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DepartmentCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None


class DepartmentUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=30)
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = None


class DepartmentOut(DepartmentCreate, ORMModel):
    id: int
