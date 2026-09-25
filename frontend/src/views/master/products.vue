<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索型号 / 中英文品名 / HS编码"
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
      <el-table-column v-if="!userStore.hideSupplierInfo" label="型号 / 供应商" width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <div style="font-weight: bold">{{ row.model || '—' }}</div>
          <div style="font-size: 11px; color: #909399; margin-top: 2px">{{ row.supplier_name || '未绑定' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="中文品名" prop="name_cn" width="130" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.name_cn || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="英文品名与规格" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">
          <strong>{{ row.name_en }}</strong>
          <div v-if="row.spec" style="font-size: 10px; color: #909399; margin-top: 4px; border-top: 1px dashed #ebeef5; padding-top: 2px">{{ row.spec }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="hs_code" label="HS编码" width="110" show-overflow-tooltip>
        <template #default="{ row }">
          <span style="white-space: nowrap;">{{ row.hs_code || '—' }}</span>
        </template>
      </el-table-column>
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
      <el-table-column label="单个重量(kg)" prop="unit_weight_kg" width="100" align="right">
        <template #default="{ row }">
          {{ row.unit_weight_kg != null ? Number(row.unit_weight_kg).toFixed(3) : '—' }}
        </template>
      </el-table-column>
      <el-table-column v-if="!userStore.hidePurchaseAndProfit" prop="purchase_cost_rmb" label="采购价(¥)" width="100" align="right" />
      <el-table-column prop="export_price_usd" label="外销价(¥)" width="100" align="right" />
      <el-table-column label="交货期" prop="delivery_period" width="100" show-overflow-tooltip />
      <el-table-column label="备注" prop="remark" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span style="white-space: pre-wrap;">{{ row.remark || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="info" @click="openView(row)">查看</el-button>
          <el-button link type="warning" @click="openPhotoGallery(row)">📷 相册</el-button>
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
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" :disabled="readonly" label-width="100px">
        <el-divider content-position="left">基本信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="型号" prop="model">
              <el-input v-model="form.model" />
            </el-form-item>
          </el-col>
          <el-col :span="8" v-if="!userStore.hideSupplierInfo">
            <el-form-item label="供应商型号">
              <el-input v-model="form.our_model" placeholder="供应商型号" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="HS编码" prop="hs_code">
              <el-select
                v-model="form.hs_code"
                filterable
                allow-create
                default-first-option
                clearable
                placeholder="选择或输入HS编码"
                style="width: 100%"
              >
                <el-option
                  v-for="h in hsCodeOptions"
                  :key="h.id"
                  :label="h.hs_code"
                  :value="h.hs_code"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8" v-if="!userStore.hideSupplierInfo">
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
            <el-form-item label="中文品名" prop="name_cn">
              <el-input v-model="form.name_cn" placeholder="产品中文名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="英文品名" prop="name_en">
              <el-input v-model="form.name_en" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="英文规格描述">
              <el-input v-model="form.spec" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="中文规格描述">
              <el-input v-model="form.spec_cn" type="textarea" :rows="2" placeholder="关联到生产任务单货物名称及规格" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="多行备注，列表页可换行显示" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="交货期">
              <el-input v-model="form.delivery_period" placeholder="如: 30 days" />
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
            <el-form-item label="单个重量(kg)">
              <el-input-number v-model="form.unit_weight_kg" :controls="false" :precision="3" style="width: 100%" />
            </el-form-item>
          </el-col>
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
          <el-col :span="8" v-if="!userStore.hidePurchaseAndProfit">
            <el-form-item label="采购价(¥)" prop="purchase_cost_rmb">
              <el-input-number v-model="form.purchase_cost_rmb" :min="0" :step="0.0001" :precision="4" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="外销价(¥)">
              <el-input-number v-model="form.export_price_usd" :min="0" :step="0.01" :precision="2" :controls="false" style="width: 100%" />
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

    <!-- 产品多图管理弹窗（所有角色可查看，管理员可上传/删除） -->
    <el-dialog
      v-model="photoDialogVisible"
      :title="`产品相册 - ${photoCurrent?.model || ''}`"
      width="720px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <div v-if="photoList.length === 0 && !photoLoading" style="text-align: center; padding: 40px 0; color: #909399;">
        暂无额外图片
      </div>
      <div v-if="photoList.length > 0" class="photo-grid">
        <div v-for="p in photoList" :key="p.id" class="photo-item">
          <el-image
            :src="p.photo_url"
            :preview-src-list="photoList.map(x => x.photo_url)"
            :initial-index="photoList.indexOf(p)"
            fit="contain"
            class="photo-thumb"
            preview-teleported
          />
          <el-button
            v-if="canEdit"
            link type="danger" size="small"
            class="photo-del"
            @click="onDeletePhoto(p)"
          >✕</el-button>
          <div v-if="p.caption" class="photo-caption">{{ p.caption }}</div>
        </div>
      </div>

      <div v-if="canEdit" class="photo-upload-area">
        <el-upload
          :show-file-list="false"
          :before-upload="handlePhotoUpload"
          accept="image/*"
          :disabled="!photoCurrent"
        >
          <el-button type="primary" plain :loading="photoLoading">+ 上传新图片</el-button>
        </el-upload>
        <span style="margin-left: 12px; font-size: 12px; color: #909399;">
          已选 {{ photoList.length }} 张（建议单张 ≤ 3MB，自动压缩为 800px 宽）
        </span>
      </div>

      <template #footer>
        <el-button @click="photoDialogVisible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { listProducts, createProduct, updateProduct, deleteProduct, listProductPhotos, addProductPhoto, deleteProductPhoto } from '@/api/products'
import { listSuppliers } from '@/api/suppliers'
import { listHsCodes } from '@/api/hsCodes'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const canEdit = userStore.canEdit

// 产品多图状态
const photoDialogVisible = ref(false)
const photoCurrent = ref(null)
const photoList = ref([])
const photoLoading = ref(false)

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const supplierOptions = ref([])
const hsCodeOptions = ref([])
const query = reactive({ q: '', supplierId: null, page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const readonly = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  model: [{ required: true, message: '请输入型号', trigger: 'blur' }],
  hs_code: [{ required: true, message: '请输入HS编码', trigger: 'blur' }],
  name_en: [{ required: true, message: '请输入英文品名', trigger: 'blur' }]
}

const NUMERIC_FIELDS = [
  'prod_length', 'prod_width', 'prod_height',
  'box_length', 'box_width', 'box_height',
  'ctn_length', 'ctn_width', 'ctn_height',
  'net_weight_kg', 'gross_weight_kg', 'unit_weight_kg', 'pcs_per_ctn', 'ctn_cbm',
  'est_qty_20gp', 'est_qty_40gp', 'est_qty_40hq',
  'purchase_cost_rmb', 'export_price_usd'
]

const blankForm = () => ({
  model: '', our_model: '', hs_code: '', supplier_id: null, name_cn: '', name_en: '', spec: '', spec_cn: '', remark: '', delivery_period: '', img_url: '',
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

/* ========== 产品多图 ========== */
async function openPhotoGallery(row) {
  photoCurrent.value = row
  photoDialogVisible.value = true
  photoLoading.value = true
  try {
    const d = await listProductPhotos(row.id)
    photoList.value = d.list || []
  } catch { /* 拦截器 */ }
  finally { photoLoading.value = false }
}

// 压缩上传多图（800px 宽 JPEG，比主图 400px 大一些，浏览体验更好）
function handlePhotoUpload(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = async () => {
        const MAX_WIDTH = 800
        let { width, height } = img
        if (width > MAX_WIDTH) {
          const scale = MAX_WIDTH / width
          width = MAX_WIDTH; height = Math.round(img.height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const photoUrl = canvas.toDataURL('image/jpeg', 0.85)
        try {
          await addProductPhoto(photoCurrent.value.id, { photo_url: photoUrl })
          const d = await listProductPhotos(photoCurrent.value.id)
          photoList.value = d.list || []
          ElMessage.success('图片上传成功')
        } catch { /* 拦截器 */ }
        resolve(false)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

async function onDeletePhoto(p) {
  const ok = await ElMessageBox.confirm('确认删除这张图片？', '删除确认', { type: 'warning' }).catch(() => false)
  if (!ok) return
  try {
    await deleteProductPhoto(photoCurrent.value.id, p.id)
    photoList.value = photoList.value.filter(x => x.id !== p.id)
    ElMessage.success('已删除')
  } catch { /* 拦截器 */ }
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

async function loadHsCodes() {
  try {
    const d = await listHsCodes({ page: 1, pageSize: 500 })
    hsCodeOptions.value = d.list
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
  loadHsCodes()
})
</script>

<style scoped>
/* 产品多图 */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.photo-item {
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
  background: #fafafa;
}
.photo-thumb {
  width: 100%;
  height: 160px;
  display: block;
  cursor: zoom-in;
}
.photo-del {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  line-height: 22px;
  padding: 0;
  font-size: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.photo-caption {
  font-size: 11px;
  color: #909399;
  text-align: center;
  padding: 4px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.photo-upload-area {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #dcdfe6;
  display: flex;
  align-items: center;
}
</style>
