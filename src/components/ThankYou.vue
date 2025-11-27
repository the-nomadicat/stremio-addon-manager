<template>
    <section id="thanks">
        <div class="thank-you-header">
            <h3>Thank you</h3>
            <div class="donation-menu">
                <button 
                    class="donation-toggle" 
                    :class="{ expanded: isExpanded }"
                    @click="toggleDonation"
                >
                    <span class="donation-text">Ủng hộ mình cốc trà đá để sống qua ngày với khát quá !</span>
                    <span class="toggle-indicator">{{ isExpanded ? '▲' : '▼' }}</span>
                </button>
                <div class="donation-content" :class="{ visible: isExpanded }">
                    <img 
                        src="/icons/donation-qr.jpg" 
                        alt="QR Code để ủng hộ" 
                        class="donation-qr"
                    />
                </div>
            </div>
        </div>
        <p>Big thank you to <code>Sleeyax</code> and <code>&lt;Code/&gt;</code> for the conversations and code
            snippets that made this really easy to implement.</p>
        <h4>Credits</h4>
        <p>
            Originally created by pancake3000, improved and refined by redd-ravenn,
            and further expanded here with multi-account login management,
            a guided step-by-step workflow, backup/restore support,
            catalog search functionality, addon installation and reset features,
            catalog hiding and reordering (including Cinemeta),
            per-addon catalog editing without touching JSON,
            and smart visual feedback for unsaved changes and sync requirements.
        </p>
    </section>
</template>

<script setup>
import { ref } from 'vue'

// Reactive state for donation menu visibility (Requirements 1.2)
const isExpanded = ref(false)

// Toggle method to switch between visible/hidden states (Requirements 1.3)
function toggleDonation() {
    isExpanded.value = !isExpanded.value
}
</script>

<style scoped>
.thank-you-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
}

.thank-you-header h3 {
    margin: 0;
}

.donation-menu {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.donation-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1.4rem;
    font-weight: 600;
    box-shadow: 0 4px 15px rgba(238, 90, 36, 0.4);
    transition: all 0.3s ease;
}

/* Hover effect for toggle button (Requirements 2.2) */
.donation-toggle:hover {
    background: linear-gradient(135deg, #ff5252, #d63031);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(238, 90, 36, 0.5);
}

.donation-toggle:active {
    transform: translateY(0);
}

.donation-text {
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Visual indicator for toggle state (Requirements 2.1) */
.toggle-indicator {
    font-size: 0.85rem;
    color: #fff;
    transition: transform 0.3s ease;
}

.donation-toggle.expanded .toggle-indicator {
    transform: rotate(180deg);
}

/* Collapsible content with smooth transition (Requirements 2.3) */
.donation-content {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transition: max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease;
    margin-top: 0;
}

.donation-content.visible {
    max-height: 300px;
    opacity: 1;
    margin-top: 0.75rem;
}

.donation-qr {
    max-width: 200px;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
