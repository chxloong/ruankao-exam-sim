# 认证接口：注册校验 / 登录 / 状态拦截 / 修改密码
import uuid


def _uname(prefix="u"):
    return prefix + uuid.uuid4().hex[:8]


def test_register_field_validation(client):
    r = client.post("/api/auth/register", json={"username": "", "password": "123456"})
    assert r.status_code == 400
    r = client.post("/api/auth/register", json={"username": "a", "password": "123456"})  # 太短
    assert r.status_code == 400
    r = client.post("/api/auth/register", json={"username": "bad name!", "password": "123456"})
    assert r.status_code == 400
    r = client.post("/api/auth/register", json={"username": _uname(), "password": "123"})  # 密码太短
    assert r.status_code == 400


def test_register_duplicate_username(client):
    name = _uname("dup")
    r = client.post("/api/auth/register", json={"username": name, "password": "123456"})
    assert r.status_code == 200
    r = client.post("/api/auth/register", json={"username": name, "password": "123456"})
    assert r.status_code == 400 and "已存在" in r.json()["error"]


def test_register_then_pending_login_blocked(client):
    name = _uname("pending")
    r = client.post("/api/auth/register", json={"username": name, "password": "123456"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "pending" and "token" not in body  # 注册不发 token

    r = client.post("/api/auth/login", json={"username": name, "password": "123456"})
    assert r.status_code == 403 and "审核" in r.json()["error"]


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "student", "password": "wrong"})
    assert r.status_code == 400 and "用户名或密码错误" in r.json()["error"]


def test_login_ok_and_me(client):
    r = client.post("/api/auth/login", json={"username": "student", "password": "123456"})
    assert r.status_code == 200
    token = r.json()["token"]
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer " + token})
    assert r.status_code == 200 and r.json()["user"]["username"] == "student"


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer bad.token"}).status_code == 401


def test_change_password_flow(client):
    name = _uname("pwd")
    client.post("/api/auth/register", json={"username": name, "password": "123456"})
    # 管理员审核通过
    admin = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()["token"]
    users = client.get("/api/admin/users", headers={"Authorization": "Bearer " + admin}).json()["users"]
    uid = next(u for u in users if u["username"] == name)["id"]
    client.put(
        f"/api/admin/users/{uid}/status",
        json={"status": "active"},
        headers={"Authorization": "Bearer " + admin},
    )

    token = client.post("/api/auth/login", json={"username": name, "password": "123456"}).json()["token"]
    hdr = {"Authorization": "Bearer " + token}

    # 旧密码错
    r = client.put("/api/auth/change-password", json={"oldPassword": "x", "newPassword": "654321"}, headers=hdr)
    assert r.status_code == 400
    # 成功改密
    r = client.put(
        "/api/auth/change-password",
        json={"oldPassword": "123456", "newPassword": "654321"},
        headers=hdr,
    )
    assert r.status_code == 200
    # 旧 token 立即失效（pw_ver 版本化）
    r = client.get("/api/auth/me", headers=hdr)
    assert r.status_code == 401
    # 新密码可登录，旧密码不可
    assert client.post("/api/auth/login", json={"username": name, "password": "654321"}).status_code == 200
    assert client.post("/api/auth/login", json={"username": name, "password": "123456"}).status_code == 400
