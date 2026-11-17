"""Windows 桌面版入口：进程内启动 FastAPI，托管前端 dist，pywebview 窗口展示。

- 打包（PyInstaller --onefile --windowed --add-data "..\\frontend\\dist;frontend_dist" desktop_app.py）
- 数据库：exe 同级 data/app.db（开发模式仍为 backend/data/app.db）
- 首次启动库为空时自动写入演示数据
"""
import logging
import socket
import sys
import threading
import time
from pathlib import Path

import uvicorn
import webview

from database import DATA_DIR, DB_PATH, connect, init_schema
from main import app  # FastAPI 实例（API 路由已注册）
from seed import seed_if_empty

# ---------- 日志（打包后无控制台，写文件便于排障） ----------
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = DATA_DIR / "desktop.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(LOG_PATH, encoding="utf-8")],
)
log = logging.getLogger("desktop")


def frontend_dist() -> Path:
    """开发模式直接用 frontend/dist；打包后从 PyInstaller 资源目录取"""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS")) / "frontend_dist"
    return Path(__file__).resolve().parent.parent / "frontend" / "dist"


def mount_frontend(dist: Path) -> None:
    """托管构建产物 + SPA 回退（history 路由深链接可直达）"""
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    if not (dist / "index.html").exists():
        log.warning("未找到前端构建产物: %s", dist)
        return

    assets = dist / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    from fastapi import HTTPException

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="接口不存在")
        candidate = (dist / full_path).resolve()
        if full_path and candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(dist / "index.html")

    log.info("前端静态资源已托管: %s", dist)


def pick_port() -> int:
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]
    finally:
        s.close()


class DesktopServer(uvicorn.Server):
    """运行在子线程，不能装信号处理器"""

    def install_signal_handlers(self) -> None:  # noqa: D102
        pass


def main() -> None:
    init_schema()
    conn = connect()
    seeded = seed_if_empty(conn)
    conn.close()
    log.info("数据库: %s（自动种子: %s）", DB_PATH, seeded)

    dist = frontend_dist()
    mount_frontend(dist)

    port = pick_port()
    server = DesktopServer(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    threading.Thread(target=server.run, daemon=True).start()
    for _ in range(200):
        if server.started:
            break
        time.sleep(0.1)
    if not server.started:
        raise RuntimeError("内嵌服务启动失败")
    log.info("内嵌服务已启动: http://127.0.0.1:%s", port)

    webview.create_window(
        "软考机考模拟练习系统",
        f"http://127.0.0.1:{port}/",
        width=1280,
        height=840,
        min_size=(1024, 700),
    )
    webview.start()  # 阻塞至窗口关闭；随主线程退出，守护线程自动结束
    log.info("窗口已关闭，退出")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log.exception("启动失败")
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(
                None, f"启动失败，详见日志：\n{LOG_PATH}", "软考机考模拟练习系统", 0x10
            )
        except Exception:
            pass
        sys.exit(1)
