// 评分逻辑：客观题自动判分，主观题由考生自评

/**
 * @param {Array<{question_id:number, score:number, type:string, answer:string|null}>} paperQuestions
 * @param {Map<number, any>} answerMap questionId -> 用户答案
 */
export function gradeSubmission(paperQuestions, answerMap) {
  const scores = paperQuestions.map((pq) => {
    const value = answerMap.get(pq.question_id) ?? null;
    const item = { questionId: pq.question_id, max: pq.score, score: null, correct: null, auto: false };

    if (pq.type === 'single') {
      item.auto = true;
      const picked = typeof value === 'string' ? value.trim().toUpperCase() : '';
      item.correct = picked === String(pq.answer || '').trim().toUpperCase();
      item.score = item.correct ? pq.score : 0;
    } else if (pq.type === 'multiple') {
      item.auto = true;
      const correctSet = new Set(String(pq.answer || '').toUpperCase().split(''));
      const pickedSet = new Set(String(value || '').toUpperCase().split(''));
      let right = 0;
      let wrong = 0;
      for (const c of pickedSet) (correctSet.has(c) ? right++ : wrong++);
      if (wrong > 0 || right === 0) {
        item.score = 0;
        item.correct = false;
      } else if (right === correctSet.size) {
        item.score = pq.score;
        item.correct = true;
      } else {
        // 少选：按正确选中比例给分
        item.score = Math.round((right / correctSet.size) * pq.score * 100) / 100;
        item.correct = false;
      }
    } else {
      // text：待自评
      item.score = null;
    }
    return item;
  });

  const total = scores.reduce((s, x) => s + (x.score ?? 0), 0);
  return { scores, total };
}
