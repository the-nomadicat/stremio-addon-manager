<script setup>
import { ref } from 'vue'
import draggable from 'vuedraggable'
import AddonItem from './AddonItem.vue'
import Authentication from './Authentication.vue'
import DynamicForm from './DynamicForm.vue'

const stremioAPIBase = "https://api.strem.io/api/"
const dragging = false
let stremioAuthKey = ref('');
let addons = ref([])
let loadAddonsButtonText = ref('Load Addons')

let isEditModalVisible = ref(false);
let currentManifest = ref({});
let currentEditIdx = ref(null);

// current email coming from Authentication.vue
const currentEmail = ref('')

/* ===============================
   STEP 4: BACKUP & RESTORE
   (only save/restore addons)
================================ */
const restoreInput = ref(null)

function safeForFilename(s) {
  return (s || '')
    .replace(/[^a-zA-Z0-9@.+-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function backupConfig() {
  const payload = { addons: Array.isArray(addons.value) ? addons.value : [] }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })

  const who = safeForFilename(currentEmail.value || 'no-email')
  const now = new Date()
  const ts = now.toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '-')
  const filename = `stremio-addons-${who}-${ts}.json`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function triggerRestore() {
  restoreInput.value?.click()
}

function restoreFromFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || '{}'))
      if (Array.isArray(data.addons)) {
        addons.value = data.addons
      } else {
        console.warn('Restore file missing "addons" array.')
      }
    } catch (err) {
      console.error('Restore failed', err)
    } finally {
      if (restoreInput.value) restoreInput.value.value = ''
    }
  }
  reader.onerror = () => {
    console.error('Failed to read the selected file.')
    if (restoreInput.value) restoreInput.value.value = ''
  }
  reader.readAsText(file)
}

/* ===============================
   Existing logic
================================ */
function loadUserAddons() {
    const key = stremioAuthKey.value
    if (!key) {
        console.error('No auth key provided')
        return
    }

    loadAddonsButtonText.value = 'Loading...'
    console.log('Loading addons...')

    const url = `${stremioAPIBase}addonCollectionGet`
    fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            type: 'AddonCollectionGet',
            authKey: key,
            update: true,
        })
    }).then((resp) => {
        resp.json().then((data) => {
            console.log(data)
            if (!("result" in data) || data.result == null) {
                console.error("Failed to fetch user addons: ", data)
                alert('Failed to fetch user addons - are you sure you pasted the correct Stremio AuthKey?')
                return
            }
            addons.value = data.result.addons
        })
    }).catch((error) => {
        console.error('Error fetching user addons', error)
    }).finally(() => {
        loadAddonsButtonText.value = 'Load Addons'
    })
}

function syncUserAddons() {
    const key = stremioAuthKey.value
    if (!key) {
        console.error('No auth key provided')
        return
    }
    console.log('Syncing addons...')

    const url = `${stremioAPIBase}addonCollectionSet`
    fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            type: 'AddonCollectionSet',
            authKey: key,
            addons: addons.value,
        })
    }).then((resp) => {
        resp.json().then((data) => {
            if (!("result" in data) || data.result == null) {
                console.error("Sync failed: ", data)
                alert('Sync failed if unknown error')
                return
            } else if (!data.result.success) {
                alert("Failed to sync addons: " + data.result.error)
            } else {
                console.log("Sync complete: + ", data)
                alert('Sync complete!')
            }
        })
    }).catch((error) => {
        alert("Error syncing addons: " + error)
        console.error('Error fetching user addons', error)
    })
}

function removeAddon(idx) {
    addons.value.splice(idx, 1)
}

function getNestedObjectProperty(obj, path, defaultValue = null) {
    try {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj)
    } catch (e) {
        return defaultValue
    }
}

function setAuthKey(authKey) {
    stremioAuthKey.value = authKey
}

function setUserEmail(val) {
  currentEmail.value = (val || '').trim()
}

function openEditModal(idx) {
    isEditModalVisible.value = true;
    currentEditIdx.value = idx;
    currentManifest.value = { ...addons.value[idx].manifest };
    document.body.classList.add('modal-open');
}

function closeEditModal() {
    isEditModalVisible.value = false;
    currentManifest.value = {};
    currentEditIdx.value = null;
    document.body.classList.remove('modal-open');
}

function saveManifestEdit(updatedManifest) {
    try {
        addons.value[currentEditIdx.value].manifest = updatedManifest;
        closeEditModal();
    } catch (e) {
        alert('Failed to update manifest');
    }
}

function resetAddons() {
    addons.value = [];
}

function clearAddons() {
    if (addons.value.length === 0) return;
    resetAddons();
}
</script>

<template>
    <section id="configure">
        <h2>Configure</h2>
        <form onsubmit="return false;">
            <fieldset>
                <Authentication
                    :stremioAPIBase="stremioAPIBase"
                    @auth-key="setAuthKey"
                    @user-email="setUserEmail"
                    @reset-addons="resetAddons"
                />
            </fieldset>

            <fieldset id="form_step1">
                <legend>Step 1: Load Addons / Backup</legend>
                <div class="action-row">
                    <div class="left-actions">
                        <button v-if="stremioAuthKey" class="button primary" @click="loadUserAddons">
                            {{ loadAddonsButtonText }}
                        </button>
                        <button v-if="addons.length" type="button" class="button danger" @click="clearAddons" title="Clear all addons">
                            Clear Addons
                        </button>
                    </div>
                    <div class="right-actions" v-if="stremioAuthKey">
                         <button v-if="addons.length" type="button" class="button" @click="backupConfig" title="Export config to file">
                            <i class="uil uil-export" style="margin-right:.35rem;"></i> Backup
                        </button>
                        <button type="button" class="button" @click="triggerRestore" title="Import config from file">
                            <i class="uil uil-import" style="margin-right:.35rem;"></i> Restore…
                        </button>
                        <input
                            ref="restoreInput"
                            type="file"
                            accept="application/json"
                            style="display:none"
                            @change="restoreFromFile"
                        />
                    </div>
                </div>
            </fieldset>

            <fieldset id="form_step2">
                <legend>Step 2: Re-Order Addons</legend>
                <draggable :list="addons" item-key="transportUrl" class="sortable-list" ghost-class="ghost"
                    @start="dragging = true" @end="dragging = false">
                    <template #item="{ element, index }">
                        <AddonItem :name="element.manifest.name" :idx="index" :manifestURL="element.transportUrl"
                            :logoURL="element.manifest.logo"
                            :isDeletable="!getNestedObjectProperty(element, 'flags.protected', false)"
                            :isConfigurable="getNestedObjectProperty(element, 'manifest.behaviorHints.configurable', false)"
                            @delete-addon="removeAddon"
                            @edit-manifest="openEditModal" />
                    </template>
                </draggable>
            </fieldset>

            <fieldset id="form_step3">
                <legend>Step 3: Sync Addons</legend>
                <div class="action-row">
                    <div class="left-actions">
                        <button v-if="addons.length" type="button" class="button primary icon" @click="syncUserAddons">
                            Sync to Stremio
                            <img src="https://icongr.am/feather/loader.svg?size=16&amp;color=ffffff" alt="icon">
                        </button>
                    </div>
                </div>
            </fieldset>
        </form>
    </section>

    <div v-if="isEditModalVisible" class="modal" @click.self="closeEditModal">
        <div class="modal-content">
            <h3>Edit manifest</h3>
            <DynamicForm :manifest="currentManifest" @update-manifest="saveManifestEdit" />
        </div>
    </div>
</template>

<style scoped>
.sortable-list {
    padding: 25px;
    border-radius: 7px;
    padding: 30px 25px 20px;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
}
.item.dragging { opacity: 0.6; }
.item.dragging :where(.details, i) { opacity: 0; }

.action-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: space-between;
    flex-wrap: wrap;
}

.left-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.right-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.button.danger {
    background-color: #dc3545;
}

.button.danger:hover {
    background-color: #c82333;
}

.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: auto;
}

.modal-content {
    background: #2e2e2e; 
    color: #e0e0e0; 
    width: 75vw;
    max-width: 900px;
    max-height: 90vh;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.7);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

button {
    padding: 10px 20px;
    border: none;
    background-color: #ffa600;
    color: white;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
}
</style>
