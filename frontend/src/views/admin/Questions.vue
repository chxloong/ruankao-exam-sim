<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="filter.subjectId" placeholder="全部科目" clearable style="width: 200px" @change="load">
          <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-select v-model="filter.type" placeholder="全部题型" clearable style="width: 140px" @change="load">
          <el-option label="单选题" value="single" />
          <el-option label="多选题" value="multiple" />
          <el-option label="主观题" value="text" />
        </el-select>
        <el-input
          v-model="filter.keyword"
          placeholder="按题干关键词搜索"
          clearable
          style="width: 240px"
          @keyup.enter="load"
          @clear="load"
        />
        <el-button type="primary" plain @click="load">查询</el-button>
        <div class="toolbar-spacer"></div>
        <el-button @click="openSubjectDialog">新增科目</el-button>
        <el-button type="success" @click="openImportDialog">导入 JSON</el-button>
        <el-button type="primary" @click="openEditDialog()">新增题目</el-button>
      </div>

      <el-table :data="questions" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="subject_name" label="科目" width="170" />
        <el-table-column label="题型" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'text' ? 'warning' : row.type === 'multiple' ? 'danger' : 'primary'">
              {{ typeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="stem" label="题干" min-width="300" show-overflow-tooltip />
        <el-table-column label="答案" width="120">
          <template #default="{ row }">
            <span v-if="row.type === 'text'" class="muted">参考答案</span>
            <b v-else>{{ row.answer }}</b>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 题目编辑 -->
    <el-dialog v-model="editVisible" :title="editing ? '编辑题目' : '新增题目'" width="680px" top="6vh">
      <el-form :model="form" label-width="90px">
        <el-form-item label="所属科目">
          <el-select v-model="form.subjectId" style="width: 300px">
            <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="题型">
          <el-radio-group v-model="form.type" :disabled="editing">
            <el-radio value="single">单选题</el-radio>
            <el-radio value="multiple">多选题</el-radio>
            <el-radio value="text">主观题</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="题干">
          <el-input v-model="form.stem" type="textarea" :rows="4" placeholder="请输入题干（主观题可含背景材料与问题）" />
        </el-form-item>
        <template v-if="form.type !== 'text'">
          <el-form-item v-for="(opt, i) in form.options" :key="i" :label="`选项 ${LETTERS[i]}`">
            <div class="opt-input">
              <el-input v-model="form.options[i]" :placeholder="`选项 ${LETTERS[i]} 内容`" />
              <el-button
                v-if="form.options.length > 2"
                circle
                type="danger"
                plain
                @click="form.options.splice(i, 1)"
              >-</el-button>
            </div>
          </el-form-item>
          <el-form-item label="">
            <el-button v-if="form.options.length < 8" @click="form.options.push('')">+ 添加选项</el-button>
          </el-form-item>
          <el-form-item :label="form.type === 'single' ? '正确答案' : '正确答案'">
            <el-select v-if="form.type === 'single'" v-model="form.answer" style="width: 120px">
              <el-option v-for="(opt, i) in form.options" :key="i" :label="LETTERS[i]" :value="LETTERS[i]" />
            </el-select>
            <el-select v-else v-model="form.answerMultiple" multiple style="width: 260px">
              <el-option v-for="(opt, i) in form.options" :key="i" :label="LETTERS[i]" :value="LETTERS[i]" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item v-if="form.type === 'text'" label="参考答案">
          <el-input v-model="form.answerText" type="textarea" :rows="6" placeholder="主观题参考答案（考生交卷后对照自评）" />
        </el-form-item>
        <el-form-item label="解析">
          <el-input v-model="form.analysis" type="textarea" :rows="3" placeholder="（可选）解析说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- JSON 导入 -->
    <el-dialog v-model="importVisible" title="JSON 批量导入题目" width="760px" top="6vh">
      <el-alert type="info" :closable="false" style="margin-bottom: 12px">
        <template #title>
          格式：{"subjectName": "科目名（或用 subjectId）", "questions": [{"type": "single|multiple|text", "stem": "题干",
          "options": ["选项内容", …], "answer": "A 或 ABD", "answerText": "主观题参考答案", "analysis": "解析"}]}
        </template>
      </el-alert>
      <el-form label-width="90px">
        <el-form-item label="导入科目">
          <el-select v-model="importForm.subjectId" placeholder="选择已有科目，或在 JSON 中用 subjectName 新建" style="width: 320px">
            <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-input
        v-model="importForm.json"
        type="textarea"
        :rows="14"
        placeholder='在此粘贴 JSON，例如：
{"subjectName":"信息系统项目管理师","questions":[{"type":"single","stem":"…","options":["…","…","…","…"],"answer":"A","analysis":"…"}]}'
      />
      <div style="margin-top: 8px">
        <input type="file" accept=".json,.txt" @change="onFileChange" />
      </div>
      <template #footer>
        <el-button @click="fillSample">填入示例</el-button>
        <el-button type="primary" :loading="importing" @click="doImport">开始导入</el-button>
      </template>
    </el-dialog>

    <!-- 新增科目 -->
    <el-dialog v-model="subjectVisible" title="新增科目" width="420px">
      <el-input v-model="subjectName" placeholder="如：网络工程师" />
      <template #footer>
        <el-button @click="subjectVisible = false">取消</el-button>
        <el-button type="primary" @click="addSubject">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api, LETTERS } from '../../api';

const subjects = ref([]);
const questions = ref([]);
const loading = ref(false);
const filter = reactive({ subjectId: null, type: null, keyword: '' });

const editVisible = ref(false);
const editing = ref(null);
const saving = ref(false);
const form = reactive({ subjectId: null, type: 'single', stem: '', options: ['', '', '', ''], answer: '', answerMultiple: [], answerText: '', analysis: '' });

const importVisible = ref(false);
const importing = ref(false);
const importForm = reactive({ subjectId: null, json: '' });

const subjectVisible = ref(false);
const subjectName = ref('');

function typeLabel(type) {
  return type === 'single' ? '单选题' : type === 'multiple' ? '多选题' : type === 'text' ? '主观题' : type;
}

async function loadSubjects() {
  const data = await api('/api/admin/subjects');
  subjects.value = data.subjects;
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filter.subjectId) params.set('subjectId', filter.subjectId);
    if (filter.type) params.set('type', filter.type);
    if (filter.keyword) params.set('keyword', filter.keyword);
    const data = await api(`/api/admin/questions?${params.toString()}`);
    questions.value = data.questions;
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    loading.value = false;
  }
}

function openEditDialog(row) {
  editing.value = row || null;
  if (row) {
    form.subjectId = row.subject_id;
    form.type = row.type;
    form.stem = row.stem;
    form.options = row.options ? [...row.options] : [];
    form.answer = row.type === 'single' ? row.answer || '' : '';
    form.answerMultiple = row.type === 'multiple' ? (row.answer || '').split('') : [];
    form.answerText = row.answer_text || '';
    form.analysis = row.analysis || '';
  } else {
    form.subjectId = filter.subjectId || subjects.value[0]?.id || null;
    form.type = 'single';
    form.stem = '';
    form.options = ['', '', '', ''];
    form.answer = '';
    form.answerMultiple = [];
    form.answerText = '';
    form.analysis = '';
  }
  editVisible.value = true;
}

async function save() {
  saving.value = true;
  try {
    const body = {
      subjectId: form.subjectId,
      type: form.type,
      stem: form.stem,
      options: form.type === 'text' ? undefined : form.options.filter((o) => o.trim()),
      answer: form.type === 'single' ? form.answer : form.type === 'multiple' ? form.answerMultiple.join('') : undefined,
      answerText: form.type === 'text' ? form.answerText : undefined,
      analysis: form.analysis || undefined,
    };
    if (editing.value) {
      await api(`/api/admin/questions/${editing.value.id}`, { method: 'PUT', body });
      ElMessage.success('题目已更新');
    } else {
      await api('/api/admin/questions', { method: 'POST', body });
      ElMessage.success('题目已创建');
    }
    editVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除题目 #${row.id} 吗？`, '删除确认', { type: 'warning' });
    await api(`/api/admin/questions/${row.id}`, { method: 'DELETE' });
    ElMessage.success('已删除');
    load();
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  }
}

function openImportDialog() {
  importForm.subjectId = filter.subjectId || subjects.value[0]?.id || null;
  importForm.json = '';
  importVisible.value = true;
}

function fillSample() {
  importForm.json = JSON.stringify(
    {
      subjectName: '信息系统项目管理师',
      questions: [
        { type: 'single', stem: '示例单选题：项目管理的三大核心约束不包括（　）。', options: ['范围', '时间', '成本', '团队规模'], answer: 'D', analysis: '三大约束为范围、时间、成本。' },
        { type: 'multiple', stem: '示例多选题：下列属于风险应对策略的有（　）。', options: ['规避', '转移', '减轻', '接受'], answer: 'ABCD' },
        { type: 'text', stem: '示例主观题：简述制定项目管理计划的作用。', answerText: '①为项目执行提供依据；②…' },
      ],
    },
    null,
    2
  );
}

function onFileChange(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => (importForm.json = String(reader.result || ''));
  reader.readAsText(file, 'utf-8');
  ev.target.value = '';
}

async function doImport() {
  let parsed;
  try {
    parsed = JSON.parse(importForm.json);
  } catch (e) {
    return ElMessage.error('JSON 格式错误：' + e.message);
  }
  if (importForm.subjectId) parsed.subjectId = importForm.subjectId;
  importing.value = true;
  try {
    const r = await api('/api/admin/questions/import', { method: 'POST', body: parsed });
    if (r.errors?.length) {
      ElMessage.warning(`成功导入 ${r.insertedCount} 题，${r.errors.length} 条失败，详见控制台`);
      console.warn('导入失败明细：', r.errors);
    } else {
      ElMessage.success(`成功导入 ${r.insertedCount} 道题目`);
    }
    importVisible.value = false;
    await loadSubjects();
    load();
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    importing.value = false;
  }
}

function openSubjectDialog() {
  subjectName.value = '';
  subjectVisible.value = true;
}

async function addSubject() {
  try {
    await api('/api/admin/subjects', { method: 'POST', body: { name: subjectName.value } });
    ElMessage.success('科目已创建');
    subjectVisible.value = false;
    await loadSubjects();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

onMounted(async () => {
  try {
    await loadSubjects();
    await load();
  } catch (e) {
    ElMessage.error(e.message);
  }
});
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.toolbar-spacer {
  flex: 1;
}
.opt-input {
  display: flex;
  gap: 8px;
  width: 100%;
}
.muted {
  color: #909399;
  font-size: 12px;
}
</style>
