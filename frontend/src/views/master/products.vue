﻿﻿﻿<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索型号 / 品名 / HS编码"
        clearable
        style="width: 240px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select
        v-model="query.supplierId"
        placeholder="全部供应商"
        clearable
        style="width: 200px"
        @change="onSearch"
      >
        <el-option
          v-for="s in supplierOptions"
          :key="s.id"
          :label="s.name"
          :value="s.id"
        />
      </el-select>
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button v-if="canEdit" type="primary" :icon="Plus" @click="openCreate">新增产品</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column label="图片" width="60" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.img_url"
            :src="row.img_url"
            :preview-src-list="[row.img_url]"
            preview-teleported
            fit="contain"
            style="width: 40px; height: 40px; border-radius: 4px"
          />
          <span v-else style="color: #c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column label="型号 / 供应商" width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <strong>{{ row.model }}</strong>
          <div style="font-size: 11px; color: #909399; margin-top: 2px">{{ row.supplier_name || '未绑定' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="英文品名与规格" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <strong>{{ row.name_en }}</strong>
          <div v-if="row.spec" style="font-size: 10px; color: #909399; margin-top: 4px; border-top: 1px dashed #ebeef5; padding-top: 2px">{{ row.spec }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="hs_code" label="HS编码" width="100" />
      <el-table-column label="尺寸 (cm)" width="120">
        <template #default="{ row }">
          <div style="font-size: 11px; line-height: 1.6; color: #606266">
            <div>产品: {{ formatDim(row, 'prod_') }}</div>
            <div>彩盒: {{ formatDim(row, 'box_') }}</div>
            <div>外箱: {{ formatDim(row, 'ctn_') }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="装箱与重量" width="130">
        <template #default="{ row }">
          <div style="font-size: 11px; line-height: 1.6; color: #606266">
            <div>{{ row.pcs_per_ctn || '-' }} PCS / {{ row.net_weight_kg || '-' }}kg / {{ row.gross_weight_kg || '-' }}kg</div>
            <div style="color: var(--el-color-primary); font-weight: bold">装柜: {{ row.est_qty_20gp || '-' }} / {{ row.est_qty_40gp || '-' }} / {{ row.est_qty_40hq || '-' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="purchase_cost_rmb" label="采购价(¥)" width="100" align="right" />
      <el-table-column prop="export_price_usd" label="外销价($)" width="100" align="right" />
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="info" @click="openView(row)">查看</el-button>
          <el-button v-if="canEdit" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="canEdit" link type="danger" @click="onDelete(row)">删除</el-button>
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
      v-model="dialogVisible"
      :title="readonly ? '查看产品' : (form.id ? '编辑产品' : '新增产品')"
      width="860px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" :disabled="readonly" label-width="100px">
        <el-divider content-position="left">基本信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="型号" prop="model">
              <el-input v-model="form.model" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="HS编码" prop="hs_code">
              <el-input v-model="form.hs_code" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="供应商">
              <el-select v-model="form.supplier_id" clearable style="width: 100%">
                <el-option
                  v-for="s in supplierOptions"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="英文品名" prop="name_en">
              <el-input v-model="form.name_en" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="规格描述">
              <el-input v-model="form.spec" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">尺寸 (cm)</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="产品长">
              <el-input-number v-model="form.prod_length" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产品宽">
              <el-input-number v-model="form.prod_width" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产品高">
              <el-input-number v-model="form.prod_height" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="彩盒长">
              <el-input-number v-model="form.box_length" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="彩盒宽">
              <el-input-number v-model="form.box_width" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="彩盒高">
              <el-input-number v-model="form.box_height" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="外箱长">
              <el-input-number v-model="form.ctn_length" :controls="false" style="width: 100%" @change="autoCalcCbm" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="外箱宽">
              <el-input-number v-model="form.ctn_width" :controls="false" style="width: 100%" @change="autoCalcCbm" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="外箱高">
              <el-input-number v-model="form.ctn_height" :controls="false" style="width: 100%" @change="autoCalcCbm" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">重量与装箱</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="箱净重(kg)">
              <el-input-number v-model="form.net_weight_kg" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="箱毛重(kg)">
              <el-input-number v-model="form.gross_weight_kg" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="件/箱">
              <el-input-number v-model="form.pcs_per_ctn" :min="0" :controls="false" style="width: 100%" @change="autoCalcContainerQty" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="箱体积(cbm)">
              <el-input-number v-model="form.ctn_cbm" :controls="false" :precision="3" style="width: 100%" @change="autoCalcContainerQty" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="20GP估装">
              <el-input-number v-model="form.est_qty_20gp" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="40GP估装">
              <el-input-number v-model="form.est_qty_40gp" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="40HQ估装">
              <el-input-number v-model="form.est_qty_40hq" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">价格与图片</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="采购价(¥)" prop="purchase_cost_rmb">
              <el-input-number v-model="form.purchase_cost_rmb" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="外销价($)">
              <el-input-number v-model="form.export_price_usd" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产品图片">
              <div style="display: flex; align-items: center; gap: 12px">
                <el-image
                  v-if="form.img_url"
                  :src="form.img_url"
                  fit="contain"
                  style="width: 50px; height: 50px; border: 1px dashed #dcdfe6; border-radius: 4px"
                />
                <div v-else style="width: 50px; height: 50px; border: 1px dashed #dcdfe6; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #c0c4cc; font-size: 12px">无</div>
                <el-upload
                  :show-file-list="false"
                  :before-upload="handleProductImg"
                  accept="image/*"
                >
                  <el-button size="small" type="primary" plain>选择图片</el-button>
                </el-upload>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ readonly ? '关 闭' : '取 消' }}</el-button>
        <el-button v-if="!readonly" type="primary" :loading="saving" @click="onSave">保 存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { listProducts, createProduct, updateProduct, deleteProduct } from '@/api/products'
import { listSuppliers } from '@/api/suppliers'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const canEdit = userStore.canEdit

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const supplierOptions = ref([])
const query = reactive({ q: '', supplierId: null, page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const readonly = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  model: [{ required: true, message: '请输入型号', trigger: 'blur' }],
  hs_code: [{ required: true, message: '请输入HS编码', trigger: 'blur' }],
  name_en: [{ required: true, message: '请输入英文品名', trigger: 'blur' }],
  purchase_cost_rmb: [{ required: true, message: '请输入采购价', trigger: 'blur' }]
}

const NUMERIC_FIELDS = [
  'prod_length', 'prod_width', 'prod_height',
  'box_length', 'box_width', 'box_height',
  'ctn_length', 'ctn_width', 'ctn_height',
  'net_weight_kg', 'gross_weight_kg', 'pcs_per_ctn', 'ctn_cbm',
  'est_qty_20gp', 'est_qty_40gp', 'est_qty_40hq',
  'purchase_cost_rmb', 'export_price_usd'
]

const blankForm = () => ({
  model: '', hs_code: '', supplier_id: null, name_en: '', spec: '', img_url: '',
  ...Object.fromEntries(NUMERIC_FIELDS.map((k) => [k, undefined]))
})

// 外箱尺寸 → 自动算 CBM = L×W×H / 1000000（@change 触发，此时 v-model 已更新）
function autoCalcCbm() {
  const l = Number(form.value.ctn_length) || 0
  const w = Number(form.value.ctn_width) || 0
  const h = Number(form.value.ctn_height) || 0
  if (l > 0 && w > 0 && h > 0) {
    form.value.ctn_cbm = Number(((l * w * h) / 1000000).toFixed(3))
    autoCalcContainerQty()
  }
}

// CBM + 件/箱 → 自动算 20GP(28cbm) / 40GP(58cbm) / 40HQ(68cbm)
function autoCalcContainerQty() {
  const cbm = Number(form.value.ctn_cbm) || 0
  const pcs = Number(form.value.pcs_per_ctn) || 1
  if (cbm > 0) {
    form.value.est_qty_20gp = Math.floor(28 / cbm) * pcs
    form.value.est_qty_40gp = Math.floor(58 / cbm) * pcs
    form.value.est_qty_40hq = Math.floor(68 / cbm) * pcs
  }
}

// 图片上传：压缩为 400px 宽 JPEG base64
function handleProductImg(file) {
  const reader = new FileReader()
  reader.onload = (evt) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX_WIDTH = 400
      const scale = MAX_WIDTH / img.width
      canvas.width = MAX_WIDTH
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      form.value.img_url = canvas.toDataURL('image/jpeg', 0.7)
    }
    img.src = evt.target.result
  }
  reader.readAsDataURL(file)
  return false // 阻止自动上传，只做本地压缩
}

// 列表尺寸格式化
function formatDim(row, prefix) {
  const l = row[`${prefix}length`]
  const w = row[`${prefix}width`]
  const h = row[`${prefix}height`]
  return l || w || h ? `${l || '-'}×${w || '-'}×${h || '-'}` : '-'
}

async function loadList() {
  loading.value = true
  try {
    const d = await listProducts({
      q: query.q, supplierId: query.supplierId, page: query.page, pageSize: query.pageSize
    })
    list.value = d.list
    total.value = d.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

async function loadSuppliers() {
  try {
    const d = await listSuppliers({ page: 1, pageSize: 200 })
    supplierOptions.value = d.list
  } catch {
    /* 拦截器已提示 */
  }
}

function onSearch() {
  query.page = 1
  loadList()
}

function openCreate() {
  readonly.value = false
  form.value = blankForm()
  dialogVisible.value = true
}

function openView(row) {
  readonly.value = true
  form.value = { ...row }
  dialogVisible.value = true
}

function openEdit(row) {
  readonly.value = false
  form.value = { ...row }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (form.value.id) {
      await updateProduct(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createProduct(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  const ok = await ElMessageBox.confirm(
    `确认删除产品「${row.model}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteProduct(row.id)
    ElMessage.success('删除成功')
  } catch {
    /* 拦截器已提示 */
  }
  loadList()
}

onMounted(() => {
  loadList()
  loadSuppliers()
})
</script>
