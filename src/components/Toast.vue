<script setup>
import { ref, computed } from 'vue'

const toasts = ref([])
let nextId = 1

function show({ message, duration = 3000, onUndo = null }) {
  const id = nextId++
  const toast = {
    id,
    message,
    onUndo,
    visible: true,
  }
  
  toasts.value.push(toast)
  
  if (duration > 0) {
    setTimeout(() => {
      remove(id)
    }, duration)
  }
  
  return id
}

function remove(id) {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
  }
}

function handleUndo(toast) {
  if (toast.onUndo) {
    toast.onUndo()
  }
  remove(toast.id)
}

defineExpose({ show, remove })
</script>

<template>
  <div class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
    >
      <span class="toast-message">{{ toast.message }}</span>
      <button
        v-if="toast.onUndo"
        class="toast-undo"
        @click="handleUndo(toast)"
        type="button"
      >
        <i class="bi bi-arrow-counterclockwise"></i>
        Undo
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: rgba(40, 40, 40, 0.95);
  border: 1px solid rgba(21, 205, 116, 0.8);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5),
              0 0 30px rgba(21, 205, 116, 0.7),
              0 0 60px rgba(21, 205, 116, 0.5),
              0 0 90px rgba(21, 205, 116, 0.3);
  color: #e0e0e0;
  font-size: 1.5rem;
  pointer-events: auto;
  animation: slideUp 0.3s ease-out;
  backdrop-filter: blur(10px);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toast-message {
  flex: 1;
}

.toast-undo {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  color: #15cd74;
  font-size: 1.4rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toast-undo:hover {
  background: rgba(21, 205, 116, 0.15);
  border-color: #15cd74;
}

.toast-undo i {
  font-size: 1.6rem;
}
</style>
