<template>
    <form @submit.prevent="handleSubmit">
        <div v-if="!isAdvancedMode">
            <div class="form-group">
                <label for="name">Name</label>
                <input
                    id="name"
                    name="name"
                    type="text"
                    v-model="formModel.name"
                />
            </div>
            
            <div class="form-group">
                <label for="description">Description</label>
                <textarea
                    id="description"
                    name="description"
                    rows="4"
                    v-model="formModel.description"
                ></textarea>
            </div>

            <div class="form-group">
                <label for="logo">Logo URL</label>
                <input
                    id="logo"
                    name="logo"
                    type="text"
                    v-model="formModel.logo"
                />
            </div>

            <div class="form-group">
                <label for="background">Background URL</label>
                <input
                    id="background"
                    name="background"
                    type="text"
                    v-model="formModel.background"
                />
            </div>
    
            <div v-if="formModel.catalogs && formModel.catalogs.length > 0" class="form-group">
                <label>Catalogs</label>
                <Draggable
                    v-model="formModel.catalogs"
                    item-key="__dragKey"
                    class="catalog-list"
                    ghost-class="catalog-ghost"
                    handle=".drag-handle"
                    @end="onCatalogReorder"
                    tag="div"
                >
                    <template #item="{ element, index }">
                        <div class="catalog-item" :key="element.__dragKey">
                            <span class="drag-handle" aria-label="Reorder catalog">
                                <img src="https://icongr.am/feather/move.svg?size=16" alt="" aria-hidden="true" />
                            </span>
                            <span 
                                v-if="catalogHasRequiredExtra(element)" 
                                class="home-indicator" 
                                :class="{ 'is-home': isCatalogOnHome(element) }"
                                :title="isCatalogOnHome(element) ? 'Shown on Home page' : 'Discover only'"
                                @click="toggleCatalogHomeStatus(element)"
                            >
                                <img src="https://icongr.am/feather/home.svg?size=16" alt="" aria-hidden="true" />
                            </span>
                            <label :for="'catalog-' + element.type" class="catalog-type-label">
                                {{ element.type }}
                            </label>
                            <input
                                :id="'catalog-' + element.type"
                                type="text"
                                v-model="element.name"
                                placeholder="Catalog Name"
                            />
                            <button type="button" class="delete-button" @click="removeCatalog(index)">
                                <img src="https://icongr.am/feather/trash-2.svg?size=16" alt="Delete Catalog" />
                            </button>
                        </div>
                    </template>
                </Draggable>
            </div>
    
            <div class="form-actions">
                <button class="save-button" type="submit">Save</button>
                <button type="button" class="switch-mode-button" @click="toggleEditMode">Advanced mode</button>
            </div>
        </div>
        
        <div v-else>
            <textarea v-model="jsonModel" rows="10" class="json-editor"></textarea>
            <div class="form-actions">
                <button class="save-button" type="button" @click="updateFromJson">Save</button>
                <button type="button" class="switch-mode-button" @click="toggleEditMode">Classic mode</button>
            </div>
        </div>
    </form>
</template>

<script setup>
import { ref, watch, defineEmits, onMounted, nextTick } from 'vue'
import Draggable from 'vuedraggable'
import { useDialog } from './DialogHost.vue'

const props = defineProps({
  manifest: {
    type: Object,
    required: true
  }
})

const emits = defineEmits(['update-manifest'])

const isAdvancedMode = ref(false);
const formModel = ref({
  name: '',
  description: '',
  logo: '',
  background: '',
  catalogs: []
});
const jsonModel = ref('')
const dialog = useDialog()

watch(() => props.manifest, (newManifest) => {
    const clone = JSON.parse(JSON.stringify(newManifest));
    ensureCatalogDragKeys(clone.catalogs);
    formModel.value = clone;
    syncJsonModel();
    nextTick(() => calculateMaxLabelWidth());
}, { immediate: true });

onMounted(() => {
  calculateMaxLabelWidth();
});

function calculateMaxLabelWidth() {
  const labels = document.querySelectorAll('.catalog-type-label');
  let maxWidth = 0;

  labels.forEach(label => {
    maxWidth = Math.max(maxWidth, label.scrollWidth);
  });

  labels.forEach(label => {
    label.style.width = `${maxWidth}px`;
  });
}

async function toggleEditMode() {
  isAdvancedMode.value = !isAdvancedMode.value;
    if (!isAdvancedMode.value) {
        try {
            const parsed = JSON.parse(jsonModel.value);
            ensureCatalogDragKeys(parsed.catalogs);
            formModel.value = parsed;
            nextTick(() => calculateMaxLabelWidth());
        } catch (e) {
            await dialog.alert({
                title: 'Invalid JSON',
                htmlMessage: 'The provided JSON could not be parsed. Please fix any syntax errors and try again.',
                confirmText: 'OK',
            });
        }
    } else {
        syncJsonModel();
    }
}

function handleSubmit() {
    const sanitized = toSanitizedManifest(formModel.value);
    emits('update-manifest', sanitized);
    jsonModel.value = JSON.stringify(sanitized, null, 2);
}

function removeCatalog(index) {
  if (Array.isArray(formModel.value.catalogs)) {
    formModel.value.catalogs.splice(index, 1);
        syncJsonModel();
        nextTick(() => calculateMaxLabelWidth());
  }
}

async function updateFromJson() {
  try {
        const parsed = JSON.parse(jsonModel.value);
        ensureCatalogDragKeys(parsed.catalogs);
        formModel.value = parsed;
        const sanitized = toSanitizedManifest(parsed);
        emits('update-manifest', sanitized);
        jsonModel.value = JSON.stringify(sanitized, null, 2);
    isAdvancedMode.value = false;
        nextTick(() => calculateMaxLabelWidth());
  } catch (e) {
        await dialog.alert({
                title: 'Invalid JSON',
                htmlMessage: 'The provided JSON could not be parsed. Please fix any syntax errors and try again.',
                confirmText: 'OK',
        });
  }
}

function onCatalogReorder() {
    syncJsonModel();
    nextTick(() => calculateMaxLabelWidth());
}

function ensureCatalogDragKeys(catalogs) {
    if (!Array.isArray(catalogs)) return;
    const stamp = Date.now();
    catalogs.forEach((catalog, idx) => {
        if (!catalog.__dragKey) {
            const rand = Math.random().toString(36).slice(2, 8);
            catalog.__dragKey = `${catalog.type || 'catalog'}-${stamp}-${idx}-${rand}`;
        }
    });
}

function toSanitizedManifest(model) {
    const clone = JSON.parse(JSON.stringify(model));
    if (Array.isArray(clone.catalogs)) {
        clone.catalogs.forEach((catalog) => {
            if (catalog && typeof catalog === 'object') {
                delete catalog.__dragKey;
            }
        });
    }
    return clone;
}

function syncJsonModel() {
    jsonModel.value = JSON.stringify(toSanitizedManifest(formModel.value), null, 2);
}

function catalogHasRequiredExtra(catalog) {
    return Array.isArray(catalog.extra) && catalog.extra.length > 0 && 
           catalog.extra.some(e => e && typeof e === 'object' && 'isRequired' in e);
}

function isCatalogOnHome(catalog) {
    if (!Array.isArray(catalog.extra)) return false;
    // Catalog appears on home if NO extras have isRequired: true
    return !catalog.extra.some(e => e && e.isRequired === true);
}

function toggleCatalogHomeStatus(catalog) {
    if (!Array.isArray(catalog.extra)) return;
    
    const currentlyOnHome = isCatalogOnHome(catalog);
    
    // Find first extra with isRequired property and toggle it
    const extraWithRequired = catalog.extra.find(e => e && typeof e === 'object' && 'isRequired' in e);
    
    if (extraWithRequired) {
        // Toggle: if currently on home (all false), set first to true; otherwise set all to false
        if (currentlyOnHome) {
            extraWithRequired.isRequired = true;
        } else {
            // Set all isRequired to false to show on home
            catalog.extra.forEach(e => {
                if (e && 'isRequired' in e) {
                    e.isRequired = false;
                }
            });
        }
        syncJsonModel();
    }
}
</script>

<style scoped>
.save-button {
    padding: 10px 20px;
    border: none;
    background-color: #14854f;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.3s, transform 0.2s;
    margin-right: 10px;
}

.save-button:hover {
    background-color: #14854eef;
}

.save-button:active {
    background-color: #14854eea;
    transform: scale(0.98);
}

.save-button:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
}

.switch-mode-button {
    padding: 10px 20px;
    border: none;
    background-color: #007bff;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.3s, transform 0.2s;
}

.switch-mode-button:hover {
    background-color: #0056b3;
}

.switch-mode-button:active {
    background-color: #004494;
    transform: scale(0.98);
}

.switch-mode-button:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
}

.delete-button {
    padding: 10px 20px;
    border: none;
    background-color: #ac0415;
    color: #00000091;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.3s, transform 0.2s;
}

.delete-button:hover {
    background-color: #ac0415f3;
}

.delete-button:active {
    background-color: #ff273de7;
    transform: scale(0.98);
}

.delete-button:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.6;
}

.delete-button img {
    filter: brightness(0) invert(1);
}

form {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 0;
}

.form-group {
    margin-bottom: 15px;
}

label {
    display: block;
    margin-bottom: 5px;
}

input, textarea {
    width: 100%;
    padding: 10px;
    box-sizing: border-box;
}

textarea {
    resize: vertical;
    background-color: #131316;
    color: #f5f5f5;
}

.catalog-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.catalog-ghost {
    opacity: 0.4;
}

.catalog-item {
    display: flex;
    align-items: center;
    gap: 10px;
}

.drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    cursor: grab;
    border-radius: 6px;
    padding: 0;
    flex-shrink: 0;
}

.drag-handle:hover {
    background: rgba(255, 255, 255, 0.08);
}

.drag-handle:active {
    cursor: grabbing;
}

.drag-handle img {
    pointer-events: none;
    filter: brightness(0) invert(1);
    user-select: none;
}

.home-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    cursor: pointer;
    border-radius: 6px;
    padding: 0;
    flex-shrink: 0;
    transition: background-color 0.2s;
}

.home-indicator:hover {
    background: rgba(255, 255, 255, 0.08);
}

.home-indicator img {
    pointer-events: none;
    filter: brightness(0) invert(0.5);
    user-select: none;
    transition: filter 0.2s;
}

.home-indicator.is-home img {
    filter: brightness(0) saturate(100%) invert(41%) sepia(94%) saturate(2555%) hue-rotate(201deg) brightness(101%) contrast(101%);
}

.catalog-type-label {
    margin-right: 10px;
    color: #f5f5f5;
    font-weight: bold;
    text-align: right;
    white-space: nowrap;
}

.catalog-item input {
    flex: 1;
    margin-right: 10px;
    box-sizing: border-box;
    min-width: 150px;
}

.json-editor {
    padding: 10px;
    box-sizing: border-box;
    margin-bottom: 20px;
}

.form-actions {
    display: flex;
    gap: 10px;
}

@media (max-width: 768px) {
    .catalog-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .drag-handle {
        align-self: flex-end;
    }

    .catalog-type-label {
        margin-right: 0;
        margin-bottom: 5px;
        text-align: left;
        width: 100%;
        max-width: 150px;
        box-sizing: border-box;
    }

    .catalog-item input {
        margin-right: 0;
        margin-bottom: 10px;
        width: 100%;
    }
}
</style>
