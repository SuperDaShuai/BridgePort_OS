<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索产品类型 / 备注"
        clearable
        style="width: 260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增产品配置</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="product_type" label="产品类型" min-width="180" show-overflow-tooltip />
      <el-table-column label="模块二字段" width="100" align="center">
        <template #default="{ row }">
          {{ configFieldCount(row) }}
        </template>
      </el-table-column>
      <el-table-column label="详细规范" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.spec_fields" type="success" size="small">有</el-tag>
          <span v-else style="color: #cbd5e1;">—</span>
        </template>
      </el-table-column>
      <el-table-column label="字段预览" min-width="300">
        <template #default="{ row }">
          <div v-if="configFieldCount(row) > 0" class="preview-text">
            {{ configFieldPreview(row) }}
          </div>
          <span v-else style="color: #cbd5e1;">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      class="pagination"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      @change="loadList"
    />

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible" :close-on-click-modal="false"
      :title="form.id ? '编辑产品配置' : '新增产品配置'"
      width="860px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="产品类型" prop="product_type">
          <el-input v-model="form.product_type" placeholder="如：通用工业秤、人体秤、厨房秤" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="选填" />
        </el-form-item>

        <el-divider content-position="left">模块二字段定义（核心电气配置）</el-divider>
        <el-form-item label="字段模板">
          <el-input
            v-model="form.config_fields_text"
            type="textarea"
            :rows="8"
            placeholder="输入字段模板，如：&#10;主板型号:&#10;充电模式:&#10;工作电压:&#10;电池规格:&#10;PTC保护:&#10;&#10;每行一个字段，留空则不生成模板"
          />
          <span class="field-editor-hint">用于采购订货单编辑弹窗「模块二」，每行一个字段标签，留空则不填充。</span>
        </el-form-item>

        <el-divider content-position="left">详细规范占位符</el-divider>
        <el-form-item label="占位符内容">
          <el-input
            v-model="form.spec_fields"
            type="textarea"
            :rows="5"
            placeholder="输入详细规范模板内容，如：&#10;1. 主板型号:&#10;2. 充电模式:&#10;3. 工作电压:&#10;留空则不生成模板"
          />
          <span class="field-editor-hint">用于采购订货单明细行「详细规范」，内容将原样填入模板。为空则不填充。</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保 存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus } from '@element-plus/icons-vue';
import request from '@/api/request';

const list = ref([]);
const total = ref(0);
const loading = ref(false);
const query = reactive({ q: '', page: 1, pageSize: 20 });
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref(null);

const blankForm = () => ({
  id: null,
  product_type: '',
  remark: '',
  config_fields_text: '',
  spec_fields: ''
});

const form = reactive(blankForm());

const rules = {
  product_type: [{ required: true, message: '请输入产品类型名称', trigger: 'blur' }]
};

// 从 config_fields JSON 数组生成文本模板（用于编辑弹窗）
function configFieldsToText(fields) {
  if (!Array.isArray(fields) || !fields.length) return '';
  return fields.map((f, i) => `${i + 1}. ${f.label || ''}:`).join('\n');
}

// 从文本模板生成 config_fields JSON 数组（用于保存）
function textToConfigFields(text) {
  const lines = (text || '').split('\n').map(s => s.trim()).filter(Boolean);
  return lines.map((line, idx) => {
    // 去掉行首序号（如 "1. 主板型号:" → "主板型号"）
    const label = line.replace(/^\d+\.\s*/, '').replace(/[:：]\s*$/, '');
    return {
      label,
      key: `f_${idx + 1}`,
      type: 'input'
    };
  });
}

// 列表预览：显示字段标签
function configFieldPreview(row) {
  const fields = row.config_fields || [];
  if (!fields.length) return '';
  return fields.map(f => f.label).join('、');
}

function configFieldCount(row) {
  return (row.config_fields || []).length;
}

async function loadList() {
  loading.value = true;
  try {
    const data = await request.get('/product-configs', { params: query });
    list.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  query.page = 1;
  loadList();
}

function openCreate() {
  Object.assign(form, blankForm());
  dialogVisible.value = true;
}

async function openEdit(row) {
  const data = await request.get(`/product-configs/${row.id}`);
  Object.assign(form, {
    id: data.id,
    product_type: data.product_type || '',
    remark: data.remark || '',
    config_fields_text: configFieldsToText(data.config_fields),
    spec_fields: typeof data.spec_fields === 'string' ? data.spec_fields : ''
  });
  dialogVisible.value = true;
}

async function onSave() {
  if (!form.product_type) {
    ElMessage.warning('请输入产品类型名称');
    return;
  }
  if (!form.config_fields_text.trim()) {
    ElMessage.warning('请输入模块二字段模板');
    return;
  }

  const payload = {
    product_type: form.product_type,
    remark: form.remark,
    config_fields: textToConfigFields(form.config_fields_text),
    spec_fields: (form.spec_fields || '').trim()
  };

  saving.value = true;
  try {
    if (form.id) {
      await request.put(`/product-configs/${form.id}`, payload);
    } else {
      await request.post('/product-configs', payload);
    }
    ElMessage.success(form.id ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确认删除产品配置「${row.product_type}」？`, '提示', { type: 'warning' });
  await request.delete(`/product-configs/${row.id}`);
  ElMessage.success('删除成功');
  loadList();
}

onMounted(loadList);
</script>

<style scoped>
.field-editor-hint {
  font-size: 12px;
  color: #94a3b8;
}
.preview-text {
  font-size: 12px;
  color: #475569;
  line-height: 1.6;
}
</style>
