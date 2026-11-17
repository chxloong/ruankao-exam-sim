<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <div class="toolbar-title">
          题目录入
          <el-tag v-if="savedCount > 0" type="success" size="small" style="margin-left: 12px">本次已录 {{ savedCount }} 题</el-tag>
        </div>
        <div class="toolbar-spacer"></div>
        <el-select v-model="subjectId" placeholder="选择科目" style="width: 220px">
          <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button @click="addSubject">新增科目</el-button>
      </div>

      <el-form label-width="90px">
        <el-form-item label="题型">
          <el-radio-group v-model="type">
            <el-radio value="single">单选题</el-radio>
            <el-radio value="multiple">多选题</el-radio>
            <el-radio value="text">主观题</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="题干">
          <el-input v-model="stem" type="textarea" :rows="5" placeholder="请输入题干（主观题可含背景材料与问题）" />
        </el-form-item>

        <template v-if="type !== 'text'">
          <el-form-item v-for="(opt, i) in options" :key="i" :label="`选项 ${LETTERS[i]}`">
            <div class="opt-input">
              <el-input v-model="options[i]" :placeholder="`选项 ${LETTERS[i]} 内容`" />
              <el-button v-if="options.length > 2" circle type="danger" plain @click="options.splice(i, 1)">-</el-button>
            </div>
          </el-form-item>
          <el-form-item label="">
            <el-button v-if="options.length < 8" @click="options.push('')">+ 添加选项</el-button>
          </el-form-item>
          <el-form-item label="正确答案">
            <el-select v-if="type === 'single'" v-model="answer" style="width: 120px">
              <el-option v-for="(opt, i) in options" :key="i" :label="LETTERS[i]" :value="LETTERS[i]" />
            </el-select>
            <el-select v-else v-model="answerMultiple" multiple style="width: 260px">
              <el-option v-for="(opt, i) in options" :key="i" :label="LETTERS[i]" :value="LETTERS[i]" />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item v-if="type === 'text'" label="参考答案">
          <el-input v-model="answerText" type="textarea" :rows="6" placeholder="主观题参考答案（考生交卷后对照自评）" />
        </el-form-item>

        <el-form-item label="解析">
          <el-input v-model="analysis" type="textarea" :rows="2" placeholder="（可选）解析说明" />
        </el-form-item>

        <el-form-item label="">
          <el-button type="primary" :loading="saving" @click="save">保存并录入下一题</el-button>
          <el-button @click="clearContent">清空表单</el-button>
          <span class="tip">保存后自动清空题目内容，科目与题型保持不变，适合连续录入</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api, LETTERS } from '../../api';

const subjects = ref([]);
const subjectId = ref(null);
const type = ref('single');
const stem = ref('');
const options = ref(['', '', '', '']);
const answer = ref('');
const answerMultiple = ref([]);
const answerText = ref('');
const analysis = ref('');
const savedCount = ref(0);
const saving = ref(false);

async function loadSubjects() {
  const data = await api('/api/admin/subjects');
  subjects.value = data.subjects;
  if (!subjectId.value && data.subjects.length) subjectId.value = data.subjects[0].id;
}

function clearContent() {
  stem.value = '';
  options.value = ['', '', '', ''];
  answer.value = '';
  answerMultiple.value = [];
  answerText.value = '';
  analysis.value = '';
}

function validate() {
  if (!subjectId.value) return '请选择科目';
  if (!stem.trim()) return '请输入题干';
  if (type.value !== 'text') {
    const filled = options.value.map((o) => o.trim()).filter(Boolean);
    if (filled.length < 2) return '选择题至少需要 2 个选项';
    if (type.value === 'single' && !answer.value) return '请选择正确答案';
    if (type.value === 'multiple' && answerMultiple.value.length < 2) return '多选题至少选 2 个答案';
  } else if (!answerText.trim()) {
    return '请输入主观题参考答案';
  }
  return null;
}

async function save() {
  const err = validate();
  if (err) return ElMessage.warning(err);
  saving.value = true;
  try {
    await api('/api/admin/questions', {
      method: 'POST',
      body: {
        subjectId: subjectId.value,
        type: type.value,
        stem: stem.value.trim(),
        options: type.value === 'text' ? undefined : options.value.map((o) => o.trim()).filter(Boolean),
        answer:
          type.value === 'single' ? answer.value : type.value === 'multiple' ? answerMultiple.value.join('') : undefined,
        answerText: type.value === 'text' ? answerText.value.trim() : undefined,
        analysis: analysis.value.trim() || undefined,
      },
    });
    savedCount.value += 1;
    clearContent();
    ElMessage.success(`已保存第 ${savedCount.value} 题，可继续录入`);
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function addSubject() {
  try {
    const { value } = await ElMessageBox.prompt('请输入科目名称（如：网络工程师）', '新增科目', {
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
    });
    const created = await api('/api/admin/subjects', { method: 'POST', body: { name: value.trim() } });
    await loadSubjects();
    subjectId.value = created.id;
    ElMessage.success('科目已创建');
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  }
}

onMounted(async () => {
  try {
    await loadSubjects();
  } catch (e) {
    ElMessage.error(e.message);
  }
});
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.toolbar-title {
  font-size: 16px;
  font-weight: 700;
}
.toolbar-spacer {
  flex: 1;
}
.opt-input {
  display: flex;
  gap: 8px;
  width: 100%;
}
.tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
</style>
