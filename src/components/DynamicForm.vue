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
                <div v-for="(catalog, index) in formModel.catalogs" :key="catalog.type" class="catalog-item">
                    <label :for="'catalog-' + catalog.type" class="catalog-type-label">
                        {{ catalog.type }}
                    </label>
                    <input
                        :id="'catalog-' + catalog.type"
                        type="text"
                        v-model="catalog.name"
                        placeholder="Catalog Name"
                    />
                    <button type="button" class="delete-button" @click="removeCatalog(index)">
                        <img src="https://icongr.am/feather/trash-2.svg?size=16" alt="Delete Catalog" />
                    </button>
                </div>
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
import { ref, watch, defineProps, defineEmits, onMounted } from 'vue'

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

watch(() => props.manifest, (newManifest) => {
  formModel.value = JSON.parse(JSON.stringify(newManifest));
  jsonModel.value = JSON.stringify(newManifest, null, 2);
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

function toggleEditMode() {
  isAdvancedMode.value = !isAdvancedMode.value;
  if (!isAdvancedMode.value) {
    try {
      formModel.value = JSON.parse(jsonModel.value);
      calculateMaxLabelWidth();
    } catch (e) {
      alert('Invalid JSON format');
    }
  }
}

function handleSubmit() {
  emits('update-manifest', formModel.value);
}

function removeCatalog(index) {
  if (Array.isArray(formModel.value.catalogs)) {
    formModel.value.catalogs.splice(index, 1);
  }
}

function updateFromJson() {
  try {
    formModel.value = JSON.parse(jsonModel.value);
    emits('update-manifest', formModel.value);
    isAdvancedMode.value = false;
  } catch (e) {
    alert('Invalid JSON format');
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

.catalog-item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
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
