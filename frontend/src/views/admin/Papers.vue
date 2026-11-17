<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <div class="toolbar-title">试卷管理</div>
        <div class="toolbar-spacer"></div>
        <el-button type="primary" @click="openEditDialog()">新建试卷</el-button>
      </div>

      <el-table :data="papers" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="试卷标题" min-width="220" show-overflow-tooltip />
        <el-table-column prop="subject_name" label="科目" width="170" />
        <el-table-column prop="question_count" label="题数" width="70" />
        <el-table-column prop="total_score" label="满分" width="70" />
        <el-table-column prop="duration_minutes" label="时长(分)" width="90" />
        <el-table-column prop="pass_score" label="及格线" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="exam_count" label="考试次数" width="90" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button v-if="row.status === 'draft'" link type="success" @click="setStatus(row, 'published')">发布</el-button>
            <el-button v-else link type="warning" @click="setStatus(row, 'draft')">下架</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 试卷编辑 -->
    <el-dialog v-model="editVisible" :title="editing ? '编辑试卷' : '新建试卷'" width="820px" top="5vh">
      <el-form :model="form" label-width="90px">
        <el-form-item label="试卷标题">
          <el-input v-model="form.title" placeholder="如：信息系统项目管理师 模拟练习卷（二）" />
        </el-form-item>
        <el-form-item label="所属科目">
          <el-select v-model="form.subjectId" style="width: 320px">
            <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="考试时长">
          <el-input-number v-model="form.durationMinutes" :min="10" :max="480" /> 分钟
        </el-form-item>
        <el-form-item label="及格线">
          <el-input-number v-model="form.passScore" :min="0" :max="600" /> 分
        </el-form-item>

        <el-form-item label="试卷结构">
          <div class="sections">
            <div v-for="(sec, i) in form.sections" :key="i" class="section-row">
              <el-input v-model="sec.name" placeholder="节名称，如：综合知识" style="width: 160px" />
              <el-input-number v-model="sec.score" :min="0.5" :max="100" :step="0.5" style="width: 140px" />
              <span class="score-unit">分/题</span>
              <el-select
                v-model="sec.questionIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择题目（可搜索）"
                style="flex: 1"
              >
                <el-option
                  v-for="q in questionsFor(form.subjectId)"
                  :key="q.id"
                  :label="`#${q.id} [${typeLabel(q.type)}] ${q.stem.slice(0, 30)}`"
                  :value="q.id"
                />
              </el-select>
              <span class="q-count">{{ sec.questionIds.length }} 题</span>
              <el-button circle type="danger" plain @click="form.sections.splice(i, 1)">-</el-button>
            </div>
            <el-button @click="form.sections.push({ name: '', score: 1, questionIds: [] })">+ 添加节</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../../api';

const subjects = ref([]);
const allQuestions = ref([]);
const papers = ref([]);
const loading = ref(false);

const editVisible = ref(false);
const editing = ref(null);
const saving = ref(false);
const form = reactive({
  title: '',
  subjectId: null,
  durationMinutes: 150,
  passScore: 45,
  sections: [{ name: '综合知识', score: 1, questionIds: [] }],
});

function typeLabel(type) {
  return type === 'single' ? '单选' : type === 'multiple' ? '多选' : '主观';
}

function questionsFor(subjectId) {
  return allQuestions.value.filter((q) => q.subject_id === subjectId);
}

async function load() {
  loading.value = true;
  try {
    const [s, q, p] = await Promise.all([api('/api/admin/subjects'), api('/api/admin/questions'), api('/api/admin/papers')]);
    subjects.value = s.subjects;
    allQuestions.value = q.questions;
    papers.value = p.papers;
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    loading.value = false;
  }
}

async function openEditDialog(row) {
  editing.value = row || null;
  if (row) {
    form.title = row.title;
    form.subjectId = row.subject_id;
    form.durationMinutes = row.duration_minutes;
    form.passScore = row.pass_score;
    // 已有结构：按 section 分组还原
    try {
      const detail = await api(`/api/admin/papers/${row.id}`);
      const bySection = new Map();
      for (const q of detail.paper.questions) {
        if (!bySection.has(q.section)) bySection.set(q.section, { name: q.section, score: q.score, questionIds: [] });
        bySection.get(q.section).questionIds.push(q.question_id);
      }
      form.sections = [...bySection.values()];
    } catch (e) {
      form.sections = [{ name: '综合知识', score: 1, questionIds: [] }];
    }
  } else {
    form.title = '';
    form.subjectId = subjects.value[0]?.id || null;
    form.durationMinutes = 150;
    form.passScore = 45;
    form.sections = [{ name: '综合知识', score: 1, questionIds: [] }];
  }
  editVisible.value = true;
}

async function save() {
  if (!form.title.trim()) return ElMessage.warning('请输入试卷标题');
  const questions = form.sections
    .filter((s) => s.name.trim() && s.questionIds.length)
    .flatMap((s) => s.questionIds.map((id) => ({ questionId: id, section: s.name.trim(), score: s.score })));
  if (!questions.length) return ElMessage.warning('请至少在一个节中勾选题目');
  const body = {
    title: form.title,
    subjectId: form.subjectId,
    durationMinutes: form.durationMinutes,
    passScore: form.passScore,
    questions,
  };
  saving.value = true;
  try {
    if (editing.value) {
      await api(`/api/admin/papers/${editing.value.id}`, { method: 'PUT', body });
      ElMessage.success('试卷已更新');
    } else {
      await api('/api/admin/papers', { method: 'POST', body });
      ElMessage.success('试卷已创建（草稿），发布后考生可见');
    }
    editVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function setStatus(row, status) {
  try {
    await api(`/api/admin/papers/${row.id}/status`, { method: 'PUT', body: { status } });
    ElMessage.success(status === 'published' ? '已发布，考生可见' : '已下架');
    load();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除试卷「${row.title}」吗？`, '删除确认', { type: 'warning' });
    await api(`/api/admin/papers/${row.id}`, { method: 'DELETE' });
    ElMessage.success('已删除');
    load();
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  }
}

onMounted(load);
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar-title {
  font-size: 16px;
  font-weight: 700;
}
.toolbar-spacer {
  flex: 1;
}
.sections {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.section-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.score-unit {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}
.q-count {
  color: #909399;
  font-size: 12px;
  width: 44px;
  flex-shrink: 0;
}
</style>
