# 评分逻辑单元测试（纯函数，无 HTTP）
from grading import grade_submission


def _q(qid, qtype, answer, score=1):
    return {"question_id": qid, "type": qtype, "answer": answer, "score": score}


def test_single_correct_and_wrong():
    qs = [_q(1, "single", "B", 1)]
    scores, total = grade_submission(qs, {1: "B"})
    assert scores[0]["score"] == 1 and scores[0]["correct"] is True
    scores, total = grade_submission(qs, {1: "A"})
    assert scores[0]["score"] == 0 and scores[0]["correct"] is False
    assert total == 0


def test_single_case_insensitive_and_blank():
    qs = [_q(1, "single", "C", 1)]
    scores, _ = grade_submission(qs, {1: "c"})
    assert scores[0]["score"] == 1
    scores, _ = grade_submission(qs, {1: None})
    assert scores[0]["score"] == 0


def test_multiple_full_score():
    qs = [_q(1, "multiple", "ABDE", 1)]
    scores, total = grade_submission(qs, {1: "ABDE"})
    assert scores[0]["score"] == 1 and scores[0]["correct"] is True


def test_multiple_partial_credit():
    # 少选 AB（应选 ABDE）→ 2/4 比例给分
    qs = [_q(1, "multiple", "ABDE", 1)]
    scores, _ = grade_submission(qs, {1: "AB"})
    assert scores[0]["score"] == 0.5 and scores[0]["correct"] is False


def test_multiple_wrong_selection_zero():
    qs = [_q(1, "multiple", "ABDE", 1)]
    scores, _ = grade_submission(qs, {1: "ABC"})  # 多选了 C
    assert scores[0]["score"] == 0
    scores, _ = grade_submission(qs, {1: ""})
    assert scores[0]["score"] == 0


def test_multiple_multiple_letters_and_score_scale():
    # 分值 2 分的多选，少选一半 → 1 分
    qs = [_q(1, "multiple", "ABCD", 2)]
    scores, _ = grade_submission(qs, {1: "AB"})
    assert scores[0]["score"] == 1.0


def test_text_pending_not_auto_scored():
    qs = [_q(1, "text", None, 25)]
    scores, total = grade_submission(qs, {1: "我的作答"})
    assert scores[0]["score"] is None and scores[0]["auto"] is False
    assert total == 0  # 主观题不计入自动总分


def test_total_sum_over_questions():
    qs = [_q(1, "single", "A", 1), _q(2, "multiple", "ABC", 2), _q(3, "text", None, 25)]
    scores, total = grade_submission(qs, {1: "A", 2: "ABC"})
    assert [s["score"] for s in scores] == [1, 2, None]
    assert total == 3
