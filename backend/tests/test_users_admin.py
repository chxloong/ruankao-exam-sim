# 用户管理：审核 / 停用启用 / 新增 / 重置密码 / 权限边界
import uuid


def _uname(prefix="admin_added"):
    return prefix + uuid.uuid4().hex[:8]


def _admin_headers(client):
    token = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()["token"]
    return {"Authorization": "Bearer " + token}


def test_admin_endpoints_require_auth(client):
    assert client.get("/api/admin/users").status_code == 401


def test_admin_endpoints_require_admin_role(client):
    token = client.post("/api/auth/login", json={"username": "student", "password": "123456"}).json()["token"]
    r = client.get("/api/admin/users", headers={"Authorization": "Bearer " + token})
    assert r.status_code == 403 and "管理员" in r.json()["error"]


def test_user_lifecycle_pending_approve_disable(client):
    name = _uname("life")
    client.post("/api/auth/register", json={"username": name, "password": "123456"})
    hdr = _admin_headers(client)

    uid = next(u for u in client.get("/api/admin/users", headers=hdr).json()["users"] if u["username"] == name)["id"]

    # 待审核 → 登录 403 → 审核 → 登录 200
    assert client.post("/api/auth/login", json={"username": name, "password": "123456"}).status_code == 403
    r = client.put(f"/api/admin/users/{uid}/status", json={"status": "active"}, headers=hdr)
    assert r.status_code == 200
    token = client.post("/api/auth/login", json={"username": name, "password": "123456"}).json()["token"]
    user_hdr = {"Authorization": "Bearer " + token}

    # 正常使用接口
    assert client.get("/api/papers", headers=user_hdr).status_code == 200

    # 停用 → 已发 token 立即失效 → 登录 403 → 启用恢复
    assert client.put(f"/api/admin/users/{uid}/status", json={"status": "disabled"}, headers=hdr).status_code == 200
    assert client.get("/api/papers", headers=user_hdr).status_code == 401
    assert client.post("/api/auth/login", json={"username": name, "password": "123456"}).status_code == 403
    assert client.put(f"/api/admin/users/{uid}/status", json={"status": "active"}, headers=hdr).status_code == 200
    assert client.post("/api/auth/login", json={"username": name, "password": "123456"}).status_code == 200


def test_admin_add_user_takes_effect_immediately(client):
    name = _uname("added")
    hdr = _admin_headers(client)
    r = client.post(
        "/api/admin/users",
        json={"username": name, "password": "123456", "role": "user"},
        headers=hdr,
    )
    assert r.status_code == 200
    r = client.post("/api/auth/login", json={"username": name, "password": "123456"})
    assert r.status_code == 200  # 无需审核
    # 重复用户名
    r = client.post(
        "/api/admin/users",
        json={"username": name, "password": "123456", "role": "user"},
        headers=hdr,
    )
    assert r.status_code == 400


def test_admin_cannot_change_own_status(client):
    hdr = _admin_headers(client)
    users = client.get("/api/admin/users", headers=hdr).json()["users"]
    me = next(u for u in users if u["username"] == "admin")
    r = client.put(f"/api/admin/users/{me['id']}/status", json={"status": "disabled"}, headers=hdr)
    assert r.status_code == 400
    # 角色亦不可自改
    r = client.put(f"/api/admin/users/{me['id']}", json={"role": "user"}, headers=hdr)
    assert r.status_code == 400


def test_admin_reset_password_invalidates_sessions(client):
    name = _uname("resetpwd")
    hdr = _admin_headers(client)
    client.post(
        "/api/admin/users",
        json={"username": name, "password": "123456", "role": "user"},
        headers=hdr,
    )
    token = client.post("/api/auth/login", json={"username": name, "password": "123456"}).json()["token"]
    uid = next(u for u in client.get("/api/admin/users", headers=hdr).json()["users"] if u["username"] == name)["id"]

    r = client.put(
        f"/api/admin/users/{uid}/reset-password",
        json={"newPassword": "abcdef"},
        headers=hdr,
    )
    assert r.status_code == 200
    # 旧登录态失效
    assert client.get("/api/papers", headers={"Authorization": "Bearer " + token}).status_code == 401
    # 新密码登录、旧密码不可
    assert client.post("/api/auth/login", json={"username": name, "password": "abcdef"}).status_code == 200
    assert client.post("/api/auth/login", json={"username": name, "password": "123456"}).status_code == 400


def test_user_status_validation(client):
    hdr = _admin_headers(client)
    name = _uname("statusval")
    client.post(
        "/api/admin/users",
        json={"username": name, "password": "123456", "role": "user"},
        headers=hdr,
    )
    uid = next(u for u in client.get("/api/admin/users", headers=hdr).json()["users"] if u["username"] == name)["id"]
    r = client.put(f"/api/admin/users/{uid}/status", json={"status": "bogus"}, headers=hdr)
    assert r.status_code == 400
