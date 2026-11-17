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
        # 自助注册：默认待审核，管理员通过后才能登录
        conn.execute(
            "INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'user', 'pending')",
            (username, hash_password(password)),
        )
        conn.commit()
        return {"status": "pending", "message": "注册成功，账号待管理员审核通过后即可登录"}
    finally:
        conn.close()


@router.post("/api/auth/login")
def login(body: CredentialsBody):
    if not body.username or not body.password:
        raise _bad("用户名和密码不能为空")
    conn = connect()
    try:
        row = conn.execute(
            "SELECT id, username, role, status, pw_ver, password_hash FROM users WHERE username = ?", (body.username,)
        ).fetchone()
        if row is None or not verify_password(body.password, row["password_hash"]):
            raise _bad("用户名或密码错误")
        if row["status"] == "pending":
            raise HTTPException(status_code=403, detail="账号待管理员审核通过后才能登录，请耐心等待")
        if row["status"] == "disabled":
            raise HTTPException(status_code=403, detail="账号已被停用，请联系管理员")
        return {"token": make_token(row), "user": {"id": row["id"], "username": row["username"], "role": row["role"]}}
    finally:
        conn.close()


@router.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    return {"user": user}


class ChangePwdBody(BaseModel):
    oldPassword: str
    newPassword: str


@router.put("/api/auth/change-password")
def change_password(body: ChangePwdBody, user=Depends(get_current_user)):
    if not body.oldPassword or not body.newPassword:
        raise _bad("旧密码和新密码不能为空")
    if len(body.newPassword) < 6:
        raise _bad("新密码至少 6 位")
    if body.newPassword == body.oldPassword:
        raise _bad("新密码不能与旧密码相同")
    conn = connect()
    try:
        row = conn.execute("SELECT password_hash, pw_ver FROM users WHERE id = ?", (user["id"],)).fetchone()
        if row is None:
            raise HTTPException(status_code=401, detail="账号不存在")
        if not verify_password(body.oldPassword, row["password_hash"]):
            raise _bad("旧密码不正确")
        conn.execute(
            "UPDATE users SET password_hash = ?, pw_ver = pw_ver + 1 WHERE id = ?",
            (hash_password(body.newPassword), user["id"]),
        )
        conn.commit()
        return {"ok": True, "message": "密码修改成功，请使用新密码重新登录"}
    finally:
        conn.close()
