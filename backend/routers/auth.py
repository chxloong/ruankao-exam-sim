"""认证路由：注册 / 登录 / 当前用户"""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import connect
from security import get_current_user, hash_password, make_token, verify_password

router = APIRouter()

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$")


def _bad(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


class CredentialsBody(BaseModel):
    username: str
    password: str


def _token_response(conn, username: str, role: str = "user", user_id: int | None = None):
    row = conn.execute(
        "SELECT id, username, role FROM users WHERE username = ?", (username,)
    ).fetchone()
    return {"token": make_token(row), "user": {"id": row["id"], "username": row["username"], "role": row["role"]}}


@router.post("/api/auth/register")
def register(body: CredentialsBody):
    username = body.username
    password = str(body.password)
    if not username or not password:
        raise _bad("用户名和密码不能为空")
    if not USERNAME_RE.match(username):
        raise _bad("用户名需为 2-20 位字母、数字、下划线或中文")
    if len(password) < 6:
        raise _bad("密码至少 6 位")
    conn = connect()
    try:
        exists = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if exists:
            raise _bad("用户名已存在")
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')",
            (username, hash_password(password)),
        )
        conn.commit()
        return _token_response(conn, username)
    finally:
        conn.close()


@router.post("/api/auth/login")
def login(body: CredentialsBody):
    if not body.username or not body.password:
        raise _bad("用户名和密码不能为空")
    conn = connect()
    try:
        row = conn.execute(
            "SELECT id, username, role, password_hash FROM users WHERE username = ?", (body.username,)
        ).fetchone()
        if row is None or not verify_password(body.password, row["password_hash"]):
            raise _bad("用户名或密码错误")
        return {"token": make_token(row), "user": {"id": row["id"], "username": row["username"], "role": row["role"]}}
    finally:
        conn.close()


@router.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    return {"user": user}
