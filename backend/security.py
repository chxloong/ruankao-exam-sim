"""认证：bcrypt 密码哈希（与原 bcryptjs 格式兼容）+ JWT（HS256，7 天）"""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from database import connect

JWT_SECRET = os.environ.get("JWT_SECRET", "ruankao-exam-dev-secret")
JWT_EXPIRES = timedelta(days=7)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def make_token(user_row) -> str:
    """user_row: sqlite3.Row 或含 id/username/role 的 dict"""
    now = datetime.now(timezone.utc)
    payload = {
        "id": user_row["id"],
        "username": user_row["username"],
        "role": user_row["role"],
        "iat": now,
        "exp": now + JWT_EXPIRES,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail=message)


def get_current_user(request: Request):
    """镜像原中间件：解析 Bearer Token 并实时查库取用户"""
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise _unauthorized("未登录")
    token = header[len("Bearer "):]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise _unauthorized("登录已过期，请重新登录")

    conn = connect()
    try:
        row = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (payload["id"],)).fetchone()
    finally:
        conn.close()
    if row is None:
        raise _unauthorized("账号不存在")
    return dict(row)


def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user
