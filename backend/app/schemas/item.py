from pydantic import BaseModel
from typing import Optional


class ItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    price: float = 0.0


class ItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None


class ItemOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    price: float
    is_active: bool

    model_config = {"from_attributes": True}
