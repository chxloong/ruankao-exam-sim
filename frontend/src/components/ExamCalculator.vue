<template>
  <el-dialog v-model="visible" title="计算器" width="320px" align-center :close-on-click-modal="true">
    <div class="calc">
      <div class="calc-screen">{{ screenText }}</div>
      <div class="calc-keys">
        <el-button v-for="k in keys" :key="k.label" class="calc-key" :class="{ wide: k.wide, op: k.op }" @click="press(k)">
          {{ k.label }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';

const visible = defineModel({ type: Boolean, default: false });

const display = ref('');
const error = ref('');

const keys = [
  { label: 'C', act: 'clear', op: true },
  { label: '←', act: 'back', op: true },
  { label: '(', act: 'char' },
  { label: ')', act: 'char' },
  { label: '7', act: 'char' },
  { label: '8', act: 'char' },
  { label: '9', act: 'char' },
  { label: '/', act: 'char', op: true },
  { label: '4', act: 'char' },
  { label: '5', act: 'char' },
  { label: '6', act: 'char' },
  { label: '*', act: 'char', op: true },
  { label: '1', act: 'char' },
  { label: '2', act: 'char' },
  { label: '3', act: 'char' },
  { label: '-', act: 'char', op: true },
  { label: '0', act: 'char' },
  { label: '.', act: 'char' },
  { label: '=', act: 'equals', op: true, wide: true },
  { label: '+', act: 'char', op: true },
];

function press(k) {
  error.value = '';
  if (k.act === 'clear') return (display.value = '');
  if (k.act === 'back') return (display.value = display.value.slice(0, -1));
  if (k.act === 'char') return (display.value += k.label);
  if (k.act === 'equals') {
    if (!display.value) return;
    try {
      const v = evaluate(display.value);
      display.value = String(v);
    } catch (e) {
      error.value = e.message;
      display.value = '';
    }
  }
}

// 无 eval 的四则运算求值：递归下降解析，仅支持 + - * / ( ) 与小数
function evaluate(expr) {
  const src = expr.replace(/\s+/g, '');
  if (!/^[\d.+\-*/()]+$/.test(src)) throw new Error('表达式含非法字符');
  let pos = 0;

  function parseExpr() {
    let v = parseTerm();
    while (src[pos] === '+' || src[pos] === '-') {
      const op = src[pos++];
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (src[pos] === '*' || src[pos] === '/') {
      const op = src[pos++];
      const r = parseFactor();
      if (op === '/' && r === 0) throw new Error('除数不能为零');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function parseFactor() {
    if (src[pos] === '(') {
      pos++;
      const v = parseExpr();
      if (src[pos] !== ')') throw new Error('括号不匹配');
      pos++;
      return v;
    }
    if (src[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    const start = pos;
    while (pos < src.length && /[\d.]/.test(src[pos])) pos++;
    if (start === pos) throw new Error('表达式格式错误');
    const num = Number(src.slice(start, pos));
    if (!Number.isFinite(num)) throw new Error('数字格式错误');
    return num;
  }

  const result = parseExpr();
  if (pos !== src.length) throw new Error('表达式格式错误');
  return Math.round(result * 1e10) / 1e10;
}

const screenText = computed(() => (error.value ? error.value : display.value || '0'));
</script>

<style scoped>
.calc {
  user-select: none;
}
.calc-screen {
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 10px 14px;
  text-align: right;
  font-size: 20px;
  font-family: Consolas, monospace;
  margin-bottom: 12px;
  min-height: 44px;
  word-break: break-all;
}
.calc-keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.calc-key {
  margin: 0 !important;
  font-size: 16px;
}
.calc-key.op {
  --el-button-bg-color: #fdf6ec;
  --el-button-border-color: #f3d19e;
}
.calc-key.wide {
  grid-column: span 2;
}
</style>
