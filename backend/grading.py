"""评分逻辑：客观题自动判分，主观题由考生自评（与原 Node 版规则一致）"""
from __future__ import annotations

from typing import Any, Mapping, Sequence


def grade_submission(paper_questions: Sequence[Mapping[str, Any]], answer_map: Mapping[int, Any]):
    """
    paper_questions: 含 question_id/score/type/answer 的题目列表
    answer_map: question_id -> 用户答案
    返回 (scores 列表, total 总分)
    """
    scores = []
    for pq in paper_questions:
        value = answer_map.get(pq["question_id"])
        item = {"questionId": pq["question_id"], "max": pq["score"], "score": None, "correct": None, "auto": False}

        if pq["type"] == "single":
            item["auto"] = True
            picked = value.strip().upper() if isinstance(value, str) else ""
            item["correct"] = picked == str(pq["answer"] or "").strip().upper()
            item["score"] = pq["score"] if item["correct"] else 0
        elif pq["type"] == "multiple":
            item["auto"] = True
            correct_set = set(str(pq["answer"] or "").upper())
            picked_set = set(str(value or "").upper())
            right = sum(1 for c in picked_set if c in correct_set)
            wrong = len(picked_set) - right
            if wrong > 0 or right == 0:
                item["score"] = 0
                item["correct"] = False
            elif right == len(correct_set):
                item["score"] = pq["score"]
                item["correct"] = True
            else:
                # 少选：按正确选中比例给分
                item["score"] = round(right / len(correct_set) * pq["score"], 2)
                item["correct"] = False
        else:
            # text：待自评
            item["score"] = None

        scores.append(item)

    total = sum(x["score"] or 0 for x in scores)
    return scores, total
