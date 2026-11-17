# 测试夹具：在任何 app/database 导入之前，把数据库隔离到临时目录（绝不碰开发库 backend/data）
import os
import sys
import tempfile
from pathlib import Path

_TEST_DB_DIR = tempfile.mkdtemp(prefix="ruankao-test-")
os.environ["RUANKAO_DB_DIR"] = _TEST_DB_DIR

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from database import connect, init_schema  # noqa: E402
from seed import seed_if_empty  # noqa: E402

_init_done = False


@pytest.fixture(scope="session")
def client():
    """进程内测试客户端 + 已种子的隔离数据库"""
    global _init_done
    from main import app

    if not _init_done:
        init_schema()
        conn = connect()
        seed_if_empty(conn)
        conn.close()
        _init_done = True
    return TestClient(app)


@pytest.fixture(scope="session")
def admin_token(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="session")
def student_token(client):
    r = client.post("/api/auth/login", json={"username": "student", "password": "123456"})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="session")
def seeded_paper(client, student_token):
    """返回一张已发布试卷的 {id, title}（种子数据里的高级卷）"""
    r = client.get("/api/papers", headers={"Authorization": "Bearer " + student_token})
    papers = r.json()["papers"]
    paper = next(p for p in papers if "信息系统项目管理师" in p["title"])
    return paper
