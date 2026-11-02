<template>
  <div class="acc-page">
    <!-- 顶部工具栏 -->
    <div class="page-header">
      <h3>配件管理</h3>
      <div class="header-actions">
        <el-input
          v-model="keyword"
          placeholder="搜索配件名称、参数、备注"
          clearable
          style="width: 260px; margin-right: 12px;"
          @clear="loadList"
          @keyup.enter="loadList"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" :icon="Plus" @click="openCategoryDialog()">管理分类</el-button>
        <el-button type="success" :icon="Plus" @click="openDialog()">新增配件</el-button>
      </div>
    </div>

    <div class="main-body">
      <!-- 左侧分类列表 -->
      <div class="cat-sidebar">
        <div class="cat-title">配件分类</div>
        <div class="cat-list">
          <div
            class="cat-item"
            :class="{ active: activeCatId === null }"
            @click="activeCatId = null; loadList()"
          >全部配件 <span class="cat-count">({{ allCount }})</span></div>
          <div
            v-for="c in categories"
            :key="c.id"
            class="cat-item"
            :class="{ active: activeCatId === c.id }"
            @click="activeCatId = c.id; loadList()"
          >
            {{ c.name }}
            <span class="cat-count">({{ catCount(c.id) }})</span>
          </div>
        </div>
      </div>

      <!-- 右侧配件卡片列表 -->
      <div class="acc-list-area">
        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="filteredList.length === 0" class="empty">暂无配件，点击右上角"新增配件"添加</div>

        <div v-else class="acc-grid">
          <div v-for="item in filteredList" :key="item.id" class="acc-card">
            <div class="acc-img" @click="previewImg(item.image_url)">
              <el-image
                v-if="item.image_url"
                :src="item.image_url"
                fit="cover"
                :preview-src-list="[item.image_url]"
              />
              <div v-else class="no-img">
                <el-icon :size="32"><Picture /></el-icon>
                <span>无图片</span>
              </div>
            </div>
            <div class="acc-info">
              <div class="acc-name">{{ item.name }}</div>
              <el-tag v-if="item.category_name" size="small" type="info" style="margin-top: 4px;">
                {{ item.category_name }}
              </el-tag>
              <div v-if="item.specs" class="acc-specs" :title="item.specs">
                <span class="spec-label">参数：</span>{{ item.specs }}
              </div>
              <div v-if="item.remark" class="acc-remark" :title="item.remark">
                <span class="spec-label">备注：</span>{{ item.remark }}
              </div>
            </div>
            <div class="acc-actions">
              <el-button size="small" link type="primary" @click="openDialog(item)">编辑</el-button>
              <el-popconfirm title="确定删除此配件吗？" @confirm="doDelete(item.id)">
                <template #reference>
                  <el-button size="small" link type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 配件新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑配件' : '新增配件'"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="90px">
        <el-form-item label="所属分类">
          <el-select v-model="form.category_id" placeholder="选择分类" clearable style="width: 100%;">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="配件名称" required>
          <el-input v-model="form.name" placeholder="如：英式插头" />
        </el-form-item>
        <el-form-item label="配件图片">
          <div class="img-upload-wrap">
            <el-upload
              :show-file-list="false"
              :before-upload="handleImgUpload"
              accept="image/*"
            >
              <div v-if="form.image_url" class="upload-img-preview">
                <img :src="form.image_url" />
                <div class="upload-img-mask">点击更换</div>
              </div>
              <div v-else class="upload-placeholder">
                <el-icon :size="28"><Plus /></el-icon>
                <span>点击上传图片</span>
              </div>
            </el-upload>
            <el-button
              v-if="form.image_url"
              size="small"
              type="danger"
              link
              style="margin-top: 6px;"
              @click="form.image_url = ''"
            >移除图片</el-button>
          </div>
        </el-form-item>
        <el-form-item label="基本参数">
          <el-input
            v-model="form.specs"
            type="textarea"
            :rows="3"
            placeholder="如：长度 1.2m / 额定电流 10A"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分类管理弹窗 -->
    <el-dialog
      v-model="catDialogVisible"
      title="配件分类管理"
      width="560px"
      :close-on-click-modal="false"
    >
      <div class="cat-mgmt">
        <div class="cat-add-row">
          <el-input v-model="newCat.name" placeholder="新分类名称" style="width: 180px;" />
          <el-input v-model.number="newCat.sort_order" placeholder="排序" style="width: 90px;" />
          <el-input v-model="newCat.description" placeholder="描述（可选）" style="width: 200px;" />
          <el-button type="primary" @click="addCategory()">添加</el-button>
        </div>
        <el-table :data="categories" border size="small" style="margin-top: 10px;">
          <el-table-column prop="sort_order" label="排序" width="80" />
          <el-table-column prop="name" label="分类名称" />
          <el-table-column prop="description" label="描述" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="editCategory(row)">改</el-button>
              <el-popconfirm title="删除该分类？该分类下的配件将变成未分类" @confirm="handleDeleteCategory(row.id)">
                <template #reference>
                  <el-button size="small" link type="danger">删</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="catDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Picture } from '@element-plus/icons-vue'
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listAccessories, createAccessory, updateAccessory, deleteAccessory
} from '@/api/accessories'

// ========== 状态 ==========
const categories = ref([])
const list = ref([])
const loading = ref(false)
const keyword = ref('')
const activeCatId = ref(null) // null = 全部
const dialogVisible = ref(false)
const catDialogVisible = ref(false)
const saving = ref(false)

const form = reactive({
  id: null,
  category_id: null,
  name: '',
  image_url: '',
  specs: '',
  remark: '',
  sort_order: 0
})

const newCat = reactive({ name: '', sort_order: 0, description: '' })

// ========== 计算 ==========
const filteredList = computed(() => {
  if (!keyword.value) return list.value
  const k = keyword.value.trim().toLowerCase()
  return list.value.filter(
    (x) => !!(
      (x.name && x.name.toLowerCase().includes(k)) ||
      (x.specs && x.specs.toLowerCase().includes(k)) ||
      (x.remark && x.remark.toLowerCase().includes(k))
    )
  )
})
const allCount = computed(() => list.value.length)
const catCount = (cid) => list.value.filter((x) => x.category_id === cid).length

// ========== 加载 ==========
async function loadCategories() {
  categories.value = await listCategories()
}

async function loadList() {
  loading.value = true
  try {
    const params = {}
    if (activeCatId.value !== null) params.category_id = activeCatId.value
    list.value = await listAccessories(params)
  } finally {
    loading.value = false
  }
}

function openCategoryDialog() {
  newCat.name = ''
  newCat.description = ''
  newCat.sort_order = 0
  catDialogVisible.value = true
}

// ========== 配件弹窗 ==========
function openDialog(item) {
  if (item) {
    Object.assign(form, { ...item })
  } else {
    Object.assign(form, {
      id: null, category_id: activeCatId.value,
      name: '', image_url: '', specs: '', remark: '', sort_order: 0
    })
  }
  dialogVisible.value = true
}

async function handleImgUpload(file) {
  const isLt3M = file.size / 1024 / 1024 < 3
  if (!isLt3M) {
    ElMessage.error('图片不能超过 3MB')
    return false
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      // 压缩到 800px
      const img = new Image()
      img.onload = () => {
        const maxW = 800
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        form.image_url = canvas.toDataURL('image/jpeg', 0.8)
        resolve(false) // 阻止 el-upload 自动上传
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

async function doSave() {
  if (!form.name || !form.name.trim()) {
    ElMessage.warning('配件名称不能为空')
    return
  }
  saving.value = true
  try {
    if (form.id) {
      await updateAccessory(form.id, form)
    } else {
      await createAccessory(form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadList()
  } finally {
    saving.value = false
  }
}

async function doDelete(id) {
  await deleteAccessory(id)
  ElMessage.success('已删除')
  await loadList()
}

function previewImg(url) {
  // el-image 自带点击预览，这里不需要额外处理
}

// ========== 分类弹窗 ==========
async function addCategory() {
  if (!newCat.name.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }
  await createCategory(newCat)
  ElMessage.success('已添加')
  newCat.name = ''
  newCat.description = ''
  newCat.sort_order = 0
  await loadCategories()
  await loadList()
}

function editCategory(row) {
  ElMessageBox.prompt('修改分类名称', '编辑分类', {
    inputValue: row.name
  }).then(async ({ value }) => {
    if (!value.trim()) return
    await updateCategory(row.id, { name: value.trim() })
    ElMessage.success('已更新')
    await loadCategories()
  }).catch(() => {})
}

async function handleDeleteCategory(id) {
  await deleteCategory(id)
  if (activeCatId.value === id) activeCatId.value = null
  ElMessage.success('已删除')
  await loadCategories()
  await loadList()
}

onMounted(async () => {
  try {
    await loadCategories()
    await loadList()
  } catch (e) {
    // request 拦截器已弹过 ElMessage，这里忽略
  }
})
</script>

<style scoped>
.acc-page { padding: 12px; }
.page-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.page-header h3 { margin: 0; }
.header-actions { display: flex; align-items: center; }

.main-body {
  display: flex; gap: 16px; min-height: calc(100vh - 150px);
}

.cat-sidebar {
  width: 220px; flex-shrink: 0;
  background: #fff; border-radius: 4px;
  padding: 12px 0;
  border: 1px solid #ebeef5;
  align-self: flex-start;
  position: sticky; top: 12px;
}
.cat-title {
  font-weight: 600; font-size: 14px; color: #303133;
  padding: 0 16px 8px; border-bottom: 1px solid #f0f0f0;
}
.cat-list { margin-top: 8px; }
.cat-item {
  padding: 8px 16px; cursor: pointer; font-size: 14px;
  color: #606266; transition: all 0.2s;
}
.cat-item:hover { background: #f5f7fa; color: #303133; }
.cat-item.active {
  background: #ecf5ff; color: #409eff; font-weight: 600;
  border-left: 3px solid #409eff; padding-left: 13px;
}
.cat-count { color: #909399; font-size: 12px; margin-left: 4px; }
.cat-item.active .cat-count { color: #409eff; }

.acc-list-area { flex: 1; min-width: 0; }
.loading, .empty { text-align: center; padding: 60px; color: #909399; }

.acc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.acc-card {
  background: #fff; border: 1px solid #ebeef5; border-radius: 6px;
  overflow: hidden; display: flex; flex-direction: column;
  transition: box-shadow 0.2s;
}
.acc-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.acc-img {
  width: 100%; height: 160px; background: #fafafa;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; overflow: hidden;
}
.acc-img :deep(.el-image), .acc-img img { width: 100%; height: 100%; }
.no-img {
  color: #c0c4cc; display: flex; flex-direction: column;
  align-items: center; gap: 6px; font-size: 12px;
}
.acc-info { padding: 10px 12px; flex: 1; }
.acc-name {
  font-size: 14px; font-weight: 600; color: #303133;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.acc-specs, .acc-remark {
  font-size: 12px; color: #606266;
  margin-top: 6px; line-height: 1.5;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.spec-label { color: #909399; }
.acc-actions {
  padding: 6px 12px; border-top: 1px solid #f0f0f0;
  display: flex; justify-content: flex-end; gap: 8px;
}

/* 弹窗里的图片上传 */
.img-upload-wrap { display: flex; flex-direction: column; }
.upload-img-preview {
  width: 140px; height: 140px; border: 1px dashed #d9d9d9;
  border-radius: 4px; overflow: hidden; position: relative;
  background: #fafafa; cursor: pointer;
}
.upload-img-preview img { width: 100%; height: 100%; object-fit: cover; }
.upload-img-mask {
  position: absolute; inset: 0; background: rgba(0,0,0,0.5);
  color: #fff; font-size: 12px; display: flex;
  align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.2s;
}
.upload-img-preview:hover .upload-img-mask { opacity: 1; }
.upload-placeholder {
  width: 140px; height: 140px; border: 1px dashed #d9d9d9;
  border-radius: 4px; background: #fafafa;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; color: #8c939d; gap: 6px; cursor: pointer;
  font-size: 12px;
}
.upload-placeholder:hover { border-color: #409eff; color: #409eff; }

.cat-mgmt .cat-add-row {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
}
</style>
