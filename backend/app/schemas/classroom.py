from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ClassroomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    building: str = Field(min_length=2, max_length=120)
    capacity: int = Field(gt=0)
    camera_url: str | None = Field(default=None, max_length=500)


class ClassroomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    building: str | None = Field(default=None, min_length=2, max_length=120)
    capacity: int | None = Field(default=None, gt=0)
    camera_url: str | None = Field(default=None, max_length=500)


class ClassroomOut(ClassroomCreate, ORMModel):
    id: int
