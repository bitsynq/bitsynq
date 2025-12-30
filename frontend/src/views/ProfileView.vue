<template>
  <v-container class="py-8">
    <div class="d-flex align-center gap-2 mb-6">
      <v-btn icon size="small" variant="text" @click="$router.back()">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h4 font-weight-bold">{{ $t('profile.title') }}</h1>
    </div>

    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card :loading="loading" class="pa-6">
          <div class="d-flex justify-center mb-6">
            <v-avatar size="100" color="primary" class="text-h3">
              <v-img v-if="user.avatar_url" :src="user.avatar_url" />
              <span v-else>{{ user.display_name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
          </div>

          <v-form ref="form" @submit.prevent="saveProfile">
            <v-text-field
              v-model="user.email"
              :label="$t('common.email')"
              readonly
              variant="filled"
              prepend-icon="mdi-email"
              class="mb-4"
            />

            <v-text-field
              v-model="user.display_name"
              :label="$t('profile.displayName')"
              :rules="[v => !!v || '名稱為必填']"
              prepend-icon="mdi-account"
              class="mb-4"
            />

            <v-combobox
              v-model="user.aliases"
              :label="$t('profile.aliases')"
              chips
              multiple
              closable-chips
              :hint="$t('profile.aliasesHint')"
              persistent-hint
              prepend-icon="mdi-tag-multiple"
              class="mb-6"
            />

            <div class="d-flex align-center mb-6">
              <v-text-field
                v-model="user.wallet_address"
                :label="$t('profile.walletAddress')"
                prepend-icon="mdi-wallet"
                placeholder="0x..."
                hide-details
                :readonly="!!user.has_custodial_wallet"
                class="flex-grow-1"
              >
                <template #append-inner v-if="user.has_custodial_wallet">
                  <v-chip color="primary" size="small" variant="flat" label class="mr-2">
                    {{ $t('profile.custodialWallet') }}
                  </v-chip>
                </template>
              </v-text-field>

              <div class="ml-4 d-flex flex-column gap-2" style="width: 160px">
                <v-btn
                  v-if="!user.wallet_address"
                  color="secondary"
                  variant="tonal"
                  block
                  :loading="generatingWallet"
                  @click="generateWallet"
                >
                  <v-icon start>mdi-plus</v-icon>
                  {{ $t('profile.createWallet') }}
                </v-btn>

                <v-btn
                  v-if="user.has_custodial_wallet"
                  color="warning"
                  variant="text"
                  size="small"
                  block
                  @click="showPrivateKeyDialog = true"
                >
                  {{ $t('profile.exportPrivateKey') }}
                </v-btn>
              </div>
            </div>

            <div class="d-flex justify-end gap-2">
              <v-btn
                color="primary"
                size="large"
                type="submit"
                :loading="saving"
              >
                {{ $t('profile.saveChanges') }}
              </v-btn>
            </div>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <!-- Private Key Dialog -->
  <v-dialog v-model="showPrivateKeyDialog" max-width="500">
    <v-card>
      <v-card-title>{{ $t('profile.dialog.title') }}</v-card-title>
      <v-card-text>
        <v-alert type="warning" variant="tonal" class="mb-4">
          {{ $t('profile.dialog.warning') }}
        </v-alert>

        <div v-if="revealedPrivateKey" class="bg-grey-lighten-4 pa-4 rounded text-center font-weight-bold text-mono mb-4 text-break">
          {{ revealedPrivateKey }}
        </div>

        <v-btn v-else color="error" variant="outlined" block @click="revealPrivateKey" :loading="revealingKey">
          {{ $t('profile.dialog.reveal') }}
        </v-btn>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="text" @click="showPrivateKeyDialog = false">{{ $t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { api, type User } from '@/services/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const loading = ref(true)
const saving = ref(false)
const generatingWallet = ref(false)
const showPrivateKeyDialog = ref(false)
const revealingKey = ref(false)
const revealedPrivateKey = ref<string | null>(null)

const user = ref<Partial<User>>({
  email: '',
  display_name: '',
  aliases: [],
  wallet_address: '',
  avatar_url: '',
  has_custodial_wallet: false,
})

async function loadProfile() {
  loading.value = true
  try {
    const data = await api.users.me()
    user.value = {
      ...data,
      aliases: data.aliases || [],
    }
  } catch (e: any) {
    showSnackbar(e.message || t('profile.errorLoad'), 'error')
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  saving.value = true
  try {
    const updatedUser = await api.users.update({
      display_name: user.value.display_name,
      aliases: user.value.aliases,
      wallet_address: user.value.wallet_address || undefined,
      avatar_url: user.value.avatar_url || undefined,
    })
    user.value = { ...user.value, ...updatedUser } // Update local state
    showSnackbar(t('profile.successUpdate'), 'success')
  } catch (e: any) {
    showSnackbar(e.message || t('profile.errorSave'), 'error')
  } finally {
    saving.value = false
  }
}

async function generateWallet() {
  generatingWallet.value = true
  try {
    const result = await api.users.generateWallet()
    user.value.wallet_address = result.wallet_address
    user.value.has_custodial_wallet = result.has_custodial_wallet
    showSnackbar(t('profile.successWallet'), 'success')
  } catch (e: any) {
    showSnackbar(e.message || t('profile.errorWallet'), 'error')
  } finally {
    generatingWallet.value = false
  }
}

async function revealPrivateKey() {
  revealingKey.value = true
  try {
    const result = await api.users.getPrivateKey()
    revealedPrivateKey.value = result.private_key
  } catch (e: any) {
    showSnackbar(e.message || t('profile.dialog.errorReveal'), 'error')
  } finally {
    revealingKey.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>
