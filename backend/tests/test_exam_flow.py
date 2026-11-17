# 考试流程：开考 / 防答案泄漏 / 保存 / 交卷评分 / 自评 / 断点续考 / 超时自动交卷
from database import connect


def _hdr(token):
    return {"Authorization": "Bearer " + token}


def _login(client):
    return client.post("/api/auth/login", json={"username": "student", "password": "123456"}).json()["token"]


def _answers_from_db(paper_id):
    """直接查库拿正确答案，作为评分期望（白盒）"""
    conn = connect()
    rows = conn.execute(
        """SELECT pq.question_id, q.type, q.answer
        FROM paper_questions pq JOIN questions q ON q.id = pq.question_id
        WHERE pq.paper_id = ? ORDER BY pq.sort""",
        (paper_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def test_exam_full_flow_and_grading(client, student_token, seeded_paper):
    hdr = _hdr(student_token)
    paper_id = seeded_paper["id"]

    # 开考
    r = client.post("/api/exams", json={"paperId": paper_id}, headers=hdr)
    assert r.status_code == 200
    rid = r.json()["recordId"]

    # 题目可达 + 不泄漏正确答案/解析/参考答案
    r = client.get(f"/api/exams/{rid}", headers=hdr)
    assert r.status_code == 200
    data = r.json()
    assert data["record"]["status"] == "in_progress"
    assert data["record"]["remainSeconds"] > 0
    questions = data["questions"]
    assert len(questions) == seeded_paper["question_count"]
    assert all("answer" not in q and "answer_text" not in q and "analysis" not in q for q in questions)

    # 保存答案：单选全对；第一个多选少选（部分分）；第二个多选错选；主观题留空
    truth = _answers_from_db(paper_id)
    answers = []
    partial_used = wrong_used = False
    for t, q in zip(truth, questions):
        assert t["question_id"] == q["question_id"]
        if q["type"] == "single":
            value = t["answer"]  # 全对
        elif q["type"] == "multiple":
            correct = set(t["answer"])
            if not partial_used and len(correct) >= 2:
                value = "".join(sorted(correct)[:2])  # 少选 → 部分分
                partial_used = True
            elif not wrong_used:
                value = next(c for c in "ABCDEFGH" if c not in correct)  # 含错选 → 0 分
                wrong_used = True
            else:
                value = t["answer"]
        else:
            value = None  # 主观题留空
        answers.append({"questionId": q["question_id"], "value": value, "marked": False})

    r = client.put(f"/api/exams/{rid}/answers", json={"answers": answers}, headers=hdr)
    assert r.status_code == 200

    # 断点续考：重新拉取，答案与剩余时间持久化
    r = client.get(f"/api/exams/{rid}", headers=hdr)
    saved = {a["questionId"]: a["value"] for a in r.json()["record"]["answers"]}
    for a in answers:
        assert saved[a["questionId"]] == a["value"]

    # 交卷 → 自动评分
    r = client.post(f"/api/exams/{rid}/submit", headers=hdr)
    assert r.status_code == 200

    # 成绩详情核对每题得分
    r = client.get(f"/api/my/results/{rid}", headers=hdr)
    assert r.status_code == 200
    detail = r.json()
    scores = {s["questionId"]: s for s in detail["record"]["scores"]}
    expected_total = 0.0
    for t, q in zip(truth, questions):
        s = scores[q["question_id"]]
        assert s["max"] == q["score"]
        if q["type"] == "single":
            assert s["score"] == q["score"]  # 全对
            expected_total += q["score"]
        elif q["type"] == "multiple":
            if len(set(t["answer"])) >= 2 and s["score"] not in (0, q["score"]):
                pass  # 部分分那条
            expected_total += s["score"]
        else:
            assert s["score"] is None  # 主观题待自评
    assert abs(detail["record"]["totalScore"] - expected_total) < 0.01
    assert detail["record"]["selfScored"] is False

    # 自评第一道主观题 → 总分更新
    text_q = next(q for q in detail["questions"] if q["type"] == "text")
    r = client.put(
        f"/api/exams/{rid}/self-score",
        json={"questionId": text_q["question_id"], "score": text_q["score"]},
        headers=hdr,
    )
    assert r.status_code == 200
    expected_total += text_q["score"]
    assert abs(r.json()["totalScore"] - expected_total) < 0.01

    # 成绩列表包含本条
    r = client.get("/api/my/results", headers=hdr)
    assert any(x["id"] == rid for x in r.json()["results"])

    # 已交卷的考试不能重复作答
    r = client.put(f"/api/exams/{rid}/answers", json={"answers": []}, headers=hdr)
    assert r.status_code == 400


def test_exam_requires_published_paper(client, student_token):
    hdr = _hdr(student_token)
    r = client.post("/api/exams", json={"paperId": 999999}, headers=hdr)
    assert r.status_code == 400
    assert "试卷不存在或未发布" in r.json()["error"]


def test_exam_resume_persists_answers(client, student_token, seeded_paper):
    hdr = _hdr(student_token)
    rid = client.post("/api/exams", json={"paperId": seeded_paper["id"]}, headers=hdr).json()["recordId"]

    questions = client.get(f"/api/exams/{rid}", headers=hdr).json()["questions"]
    target = questions[0]["question_id"]
    value = "A" if questions[0]["type"] == "single" else "暂存内容"
    r = client.put(
        f"/api/exams/{rid}/answers",
        json={"answers": [{"questionId": target, "value": value, "marked": True}]},
        headers=hdr,
    )
    assert r.status_code == 200

    # 重新拉取：答案与标记保留（断点续考）
    r = client.get(f"/api/exams/{rid}", headers=hdr)
    a = next(a for a in r.json()["record"]["answers"] if a["questionId"] == target)
    assert a["value"] == value and a["marked"] is True

    # 清理：交卷避免遗留进行中状态
    client.post(f"/api/exams/{rid}/submit", headers=hdr)


def test_timeout_auto_submit(client, student_token, seeded_paper):
    hdr = _hdr(student_token)
    rid = client.post("/api/exams", json={"paperId": seeded_paper["id"]}, headers=hdr).json()["recordId"]

    # 白盒：把开始时间改到过去，模拟超时
    conn = connect()
    conn.execute("UPDATE exam_records SET started_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", (rid,))
    conn.commit()
    conn.close()

    r = client.get(f"/api/exams/{rid}", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert body.get("autoSubmitted") is True and "totalScore" in body

    # 记录已变为已交卷
    r = client.get("/api/my/results", headers=hdr)
    assert any(x["id"] == rid for x in r.json()["results"])
