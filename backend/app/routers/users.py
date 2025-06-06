from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserRead
from app.auth import hash_password, require_role  # ВАЖНО!

from app.auth import verify_password, create_access_token
from app.schemas import UserCreate, UserRead, UserLogin, Token, UserUpdate, PasswordChange

from app.auth import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserRead)
async def register_user(user: UserCreate, db: AsyncSession = Depends(get_db)):

    new_user = User(
        fullname=user.fullname,
        email=user.email,
        password=hash_password(user.password),
        avatar_url=user.avatar_url,
        phone=user.phone,
        position=user.position,
        role="user"
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
async def login_user(user: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user.email))
    db_user = result.scalar_one_or_none()

    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    access_token = create_access_token({"sub": str(db_user.id), "role": db_user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "fullname": current_user.fullname
    }

@router.get("/admin-only")
async def admin_page(user: User = Depends(require_role(["admin", "superadmin"]))):
    return {"message": f"Привет, {user.fullname}. У тебя есть доступ!"}

@router.patch("/me", response_model=UserRead)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    for field, value in data.dict(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.put("/change-password", status_code=204)
async def change_password(
    data: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(data.current_password, current_user.password):
        raise HTTPException(status_code=400, detail="Қазіргі құпиясөз дұрыс емес")
    
    current_user.password = hash_password(data.new_password)
    await db.commit()
