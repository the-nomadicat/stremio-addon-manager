<script>
import { inject } from 'vue'

export const dialogSymbol = Symbol('dialog-service')

export function useDialog() {
  const dialog = inject(dialogSymbol)
  if (!dialog) {
    throw new Error('Dialog service is not available. Did you forget to include <DialogHost /> in App.vue?')
  }
  return dialog
}
</script>

<script setup>
import { ref, computed, provide, watch, nextTick } from 'vue'

const queue = ref([])
const activeDialog = ref(null)
const inputValue = ref('')
let idCounter = 0

const isPrompt = computed(() => activeDialog.value?.type === 'prompt')
const isConfirm = computed(() => activeDialog.value?.type === 'confirm')
const isAlert = computed(() => activeDialog.value?.type === 'alert')

let resolveCurrent = null

function showNext() {
  if (activeDialog.value || queue.value.length === 0) return
  const next = queue.value.shift()
  activeDialog.value = next
  resolveCurrent = next.resolve
  inputValue.value = next.defaultValue ?? ''

  nextTick(() => {
    if (typeof document === 'undefined') return
    const el = document.querySelector('[data-dialog-autofocus="true"]')
    if (el instanceof HTMLElement) el.focus()
  })
}

function closeDialog(result) {
  if (!activeDialog.value) return
  if (typeof resolveCurrent === 'function') {
    resolveCurrent(result)
  }
  activeDialog.value = null
  resolveCurrent = null
  inputValue.value = ''
  showNext()
}

function cancelDialog() {
  const type = activeDialog.value?.type
  if (type === 'prompt') {
    closeDialog(null)
  } else if (type === 'confirm') {
    closeDialog(false)
  } else {
    closeDialog(undefined)
  }
}

function confirmDialog() {
  const type = activeDialog.value?.type
  if (type === 'prompt') {
    closeDialog(inputValue.value)
  } else if (type === 'confirm') {
    closeDialog(true)
  } else {
    closeDialog(undefined)
  }
}

function openDialog(options) {
  return new Promise((resolve) => {
    queue.value.push({
      id: `dialog-${++idCounter}`,
      type: options.type,
      title: options.title || defaultTitle(options.type),
      message: options.message || '',
      confirmText: options.confirmText || defaultConfirmText(options.type),
      cancelText: options.cancelText || 'Cancel',
      placeholder: options.placeholder || '',
      defaultValue: options.defaultValue ?? '',
      multiline: Boolean(options.multiline),
      resolve,
    })
    showNext()
  })
}

function defaultTitle(type) {
  if (type === 'confirm') return 'Are you sure?'
  if (type === 'prompt') return 'Input required'
  return 'Notice'
}

function defaultConfirmText(type) {
  if (type === 'confirm') return 'Continue'
  if (type === 'prompt') return 'Submit'
  return 'OK'
}

function handleKeydown(event) {
  if (!activeDialog.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelDialog()
  } else if (event.key === 'Enter') {
    if (isPrompt.value && document.activeElement?.tagName === 'TEXTAREA') return
    event.preventDefault()
    confirmDialog()
  }
}

watch(activeDialog, (dialog, _, onCleanup) => {
  if (dialog) {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handleKeydown)
      document.body.classList.add('dialog-open')
    }
    onCleanup(() => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleKeydown)
        document.body.classList.remove('dialog-open')
      }
    })
  }
})

function confirm(options = {}) {
  return openDialog({ ...options, type: 'confirm' })
}

function prompt(options = {}) {
  return openDialog({ ...options, type: 'prompt' })
}

function alert(options = {}) {
  return openDialog({ ...options, type: 'alert' })
}

provide(dialogSymbol, { confirm, prompt, alert })
</script>

<template>
  <slot />
  <teleport to="body">
    <transition name="dialog-fade">
      <div v-if="activeDialog" class="dialog-backdrop">
        <div class="dialog-panel" role="dialog" :aria-modal="true" :aria-labelledby="activeDialog.id + '-title'">
          <header class="dialog-header">
            <h2 :id="activeDialog.id + '-title'" class="dialog-title">{{ activeDialog.title }}</h2>
          </header>
          <div class="dialog-body">
            <p v-if="activeDialog.message" class="dialog-message">{{ activeDialog.message }}</p>
            <textarea
              v-if="isPrompt && activeDialog.multiline"
              v-model="inputValue"
              class="dialog-input dialog-input--textarea"
              :placeholder="activeDialog.placeholder"
              data-dialog-autofocus="true"
              rows="4"
            ></textarea>
            <input
              v-else-if="isPrompt"
              v-model="inputValue"
              type="text"
              class="dialog-input"
              :placeholder="activeDialog.placeholder"
              data-dialog-autofocus="true"
            >
          </div>
          <footer class="dialog-footer">
            <button v-if="isConfirm || isPrompt" type="button" class="dialog-button dialog-button--secondary" @click="cancelDialog">
              {{ activeDialog.cancelText }}
            </button>
            <button
              type="button"
              class="dialog-button dialog-button--primary"
              :data-dialog-autofocus="!(isPrompt && activeDialog.multiline)"
              @click="confirmDialog"
            >
              {{ activeDialog.confirmText }}
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 16, 19, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 10000;
}

.dialog-panel {
  width: min(560px, 100%);
  background: linear-gradient(160deg, rgba(30, 33, 39, 0.95), rgba(24, 26, 32, 0.95));
  border-radius: 18px;
  box-shadow: 0 28px 68px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: inherit;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dialog-title {
  font-size: 2.00rem;
  font-weight: 700;
  margin: 0;
}

.dialog-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-message {
  margin: 0;
  font-size: 1.50rem;
  line-height: 2.00rem;
  color: rgba(255, 255, 255, 0.97);
  white-space: pre-line;
}

.dialog-input {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(12, 14, 18, 0.75);
  color: inherit;
  padding: 0.9rem 1rem;
  font-size: 1.25rem;
}

.dialog-input:focus {
  outline: none;
  border-color: rgba(21, 205, 116, 0.6);
  box-shadow: 0 0 0 3px rgba(21, 205, 116, 0.18);
}

.dialog-input--textarea {
  resize: vertical;
  min-height: 120px;
}

.dialog-footer {
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.dialog-button {
  border: none;
  border-radius: 10px;
  padding: 0.95rem 1.9rem;
  font-size: 1.5rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
}

.dialog-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.18);
}

.dialog-button:active {
  transform: translateY(1px);
}

.dialog-button--primary {
  background: #15cd74;
  color: #0d1411;
  font-weight: 700;
}

.dialog-button--secondary {
  background: rgba(255, 255, 255, 0.20);
  color: inherit;
}

.dialog-button--secondary:hover {
  opacity: 0.80;
}

.dialog-button--primary:hover {
  opacity: 0.80;
}

@media (max-width: 540px) {
  .dialog-panel {
    border-radius: 14px;
  }

  .dialog-header,
  .dialog-body,
  .dialog-footer {
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }
}
</style>
