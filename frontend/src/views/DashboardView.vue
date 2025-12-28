<template>
  <v-container class="py-8">
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-8">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1">儀表板</h1>
        <p class="text-body-2 text-medium-emphasis">
          管理你的專案和貢獻記錄
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        建立專案
      </v-btn>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" size="64" />
    </div>

    <!-- Empty State -->
    <v-card v-else-if="projects.length === 0" class="pa-12 text-center" variant="tonal">
      <v-icon icon="mdi-folder-open-outline" size="64" color="primary" class="mb-4" />
      <h3 class="text-h6 mb-2">還沒有專案</h3>
      <p class="text-body-2 text-medium-emphasis mb-4">
        建立你的第一個專案開始追蹤貢獻
      </p>
      <v-btn color="primary" @click="showCreateDialog = true">
        建立專案
      </v-btn>
    </v-card>

    <!-- Project Grid -->
    <v-row v-else>
      <v-col v-for="project in projects" :key="project.id" cols="12" md="6" lg="4">
        <v-card
          class="project-card h-100"
          :to="`/projects/${project.id}`"
        >
          <v-card-item>
            <template #prepend>
              <v-avatar color="primary" variant="tonal">
                <span class="text-h6">{{ project.name.charAt(0).toUpperCase() }}</span>
              </v-avatar>
            </template>
            <v-card-title>{{ project.name }}</v-card-title>
            <v-card-subtitle>
              <v-chip
                size="x-small"
                :color="project.member_role === 'admin' ? 'primary' : 'default'"
                class="mr-2"
              >
                {{ project.member_role === 'admin' ? '管理員' : '成員' }}
              </v-chip>
              <span v-if="project.token_symbol">
                {{ project.token_symbol }}
              </span>
            </v-card-subtitle>
          </v-card-item>

          <v-card-text v-if="project.description">
            <p class="text-body-2 text-medium-emphasis text-truncate">
              {{ project.description }}
            </p>
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-icon icon="mdi-chevron-right" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create Project Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="500">
      <v-card class="pa-4">
        <v-card-title>建立新專案</v-card-title>
        <v-card-text>
          <v-form ref="createFormRef" @submit.prevent="handleCreateProject">
            <v-text-field
              v-model="newProject.name"
              label="專案名稱"
              :rules="[rules.required]"
              class="mb-2"
            />
            <v-textarea
              v-model="newProject.description"
              label="專案描述"
              rows="3"
              class="mb-2"
            />
            <v-text-field
              v-model="newProject.token_symbol"
              label="Token 符號"
              placeholder="例如: BTC"
              hint="選填，用於顯示 Token 獎勵"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreateDialog = false">取消</v-btn>
          <v-btn
            color="primary"
            :loading="creating"
            @click="handleCreateProject"
          >
            建立
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, reactive } from 'vue'
import { api, type Project } from '@/services/api'

const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const projects = ref<Project[]>([])
const loading = ref(true)
const showCreateDialog = ref(false)
const creating = ref(false)
const createFormRef = ref()

const newProject = reactive({
  name: '',
  description: '',
  token_symbol: '',
})

const rules = {
  required: (v: string) => !!v || '此欄位為必填',
}

async function loadProjects() {
  loading.value = true
  try {
    projects.value = await api.projects.list()
  } catch (e: any) {
    showSnackbar(e.message || '載入專案失敗', 'error')
  } finally {
    loading.value = false
  }
}

async function handleCreateProject() {
  const { valid } = await createFormRef.value.validate()
  if (!valid) return

  creating.value = true
  try {
    const project = await api.projects.create({
      name: newProject.name,
      description: newProject.description || undefined,
      token_symbol: newProject.token_symbol || undefined,
    })
    projects.value.unshift(project)
    showCreateDialog.value = false
    showSnackbar('專案建立成功！', 'success')

    // Reset form
    newProject.name = ''
    newProject.description = ''
    newProject.token_symbol = ''
  } catch (e: any) {
    showSnackbar(e.message || '建立專案失敗', 'error')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.project-card {
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
</style>
