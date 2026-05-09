from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.item import Item
from ..schemas.item import ItemCreate, ItemUpdate, ItemOut
from ..services.auth_service import require_admin

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=List[ItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).filter(Item.is_active == True).all()


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    return item


@router.post("/", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(body: ItemCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    item = Item(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, body: ItemUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    db.delete(item)
    db.commit()
