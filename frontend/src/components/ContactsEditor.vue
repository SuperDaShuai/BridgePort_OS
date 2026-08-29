<template>
  <div class="contacts-editor">
    <el-table :data="contacts" size="small" border empty-text="暂无联系人，点击下方按钮添加">
      <el-table-column type="index" label="#" width="42" align="center" />
      <el-table-column min-width="110">
        <template #header><span class="required-mark">姓名</span></template>
        <template #default="{ row }">
          <el-input v-model="row.name" placeholder="姓名" />
        </template>
      </el-table-column>
      <el-table-column label="职位" min-width="100">
        <template #default="{ row }">
          <el-input v-model="row.position" placeholder="职位" />
        </template>
      </el-table-column>
      <el-table-column label="电话" min-width="120">
        <template #default="{ row }">
          <el-input v-model="row.phone" placeholder="电话" />
        </template>
      </el-table-column>
      <el-table-column label="邮箱" min-width="150">
        <template #default="{ row }">
          <el-input v-model="row.email" placeholder="邮箱" />
        </template>
      </el-table-column>
      <el-table-column label="WhatsApp" min-width="120">
        <template #default="{ row }">
          <el-input v-model="row.whatsapp" placeholder="WhatsApp" />
        </template>
      </el-table-column>
      <el-table-column label="主联系人" width="80" align="center">
        <template #default="{ $index }">
          <el-checkbox
            :model-value="!!contacts[$index].is_primary"
            @change="setPrimary($index)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="56" align="center">
        <template #default="{ $index }">
          <el-button link type="danger" @click="removeRow($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-button class="add-btn" type="primary" plain size="small" @click="addRow">
      + 添加联系人
    </el-button>
  </div>
</template>

<script setup>
// 联系人数组整体双向绑定：整组随客户/供应商表单一起提交
const contacts = defineModel({ type: Array, default: () => [] })

function addRow() {
  contacts.value.push({
    name: '', position: '', phone: '', email: '', whatsapp: '',
    is_primary: contacts.value.length === 0
  })
}

function removeRow(index) {
  contacts.value.splice(index, 1)
}

// 勾选为主联系人时取消其他人的主联系人标记
function setPrimary(index) {
  const willBePrimary = !contacts.value[index].is_primary
  contacts.value.forEach((c, i) => {
    c.is_primary = willBePrimary && i === index
  })
}
</script>

<style scoped>
.contacts-editor .add-btn {
  margin-top: 8px;
}
.required-mark::before {
  content: '*';
  color: #f56c6c;
  margin-right: 4px;
}
</style>
