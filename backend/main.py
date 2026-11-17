"""FastAPI 入口：注册路由、统一错误响应格式（{error: ...}）"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import init_schema
from routers.admin import router as admin_router
from routers.exams import router as exams_router
from routers.my import router as my_router
from routers.papers import router as papers_router
from routers.auth import router as auth_router

init_schema()

app = FastAPI(title="软考机考模拟练习系统 API", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(papers_router)
app.include_router(exams_router)
app.include_router(my_router)
app.include_router(admin_router)


@app.get("/api/health")
def health():
    return {"ok": True}


# 统一错误格式：前端读取 data.error，把 FastAPI 默认的 {detail} 转成 {error}
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    headers = getattr(exc, "headers", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"error": "请求参数不合法", "detail": exc.errors()})


# 404 兜底
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={"error": "接口不存在"})
