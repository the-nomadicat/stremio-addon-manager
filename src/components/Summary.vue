<script setup>
import { ref } from 'vue'

const spotlightSections = [
  {
    id: 'accounts',
    title: 'Accounts & access',
    features: [
      {
        title: 'Flexible sign-in with email / password or AuthKey',
        copy: 'Sign in with your Stremio email + password, or paste an existing AuthKey copied from Stremio Web (no Facebook login support).',
        status: 'core'
      },
      {
        title: 'Saved logins on this device',
        copy: 'Optionally store multiple Stremio accounts locally in this browser. Give them friendly names like “Mum”, “Guest”, “Test”, switch between them instantly, or remove them when you’re done. Never enable this on a shared or public device.',
        status: 'new'
      }
    ]
  },
  {
    id: 'safety',
    title: 'Backups & safety nets',
    features: [
      {
        title: 'Back up your configuration',
        copy: 'Export a snapshot of all addons and catalogs for the current account so you can restore them later or apply the same setup to another account or device.',
        status: 'new'
      },
      {
        title: 'Restore from backup',
        copy: 'Import a previously saved snapshot to roll back to a known good state or clone a working layout onto a different Stremio account.',
        status: 'new'
      },
    ]
  },
  {
    id: 'layout',
    title: 'Layout control',
    features: [
      {
        title: 'Reorder addons',
        copy: 'Drag and drop addons to control which streaming sources and catalogs appear first in Stremio.',
        status: 'core'
      },
      {
        title: 'Per-addon catalog editor',
        copy: 'Open an addon’s editor to rename both the addon and its catalogs, delete catalogs you don’t want, and drag them into the order you prefer — without touching JSON.',
        status: 'new'
      },
      {
        title: 'Control what shows on Home screen',
        copy: 'Show or hide individual catalog rows on the Stremio Home screen by toggling the Home icon, so only the stuff you care about is visible.',
        status: 'new'
      },
      {
        title: 'Hide Cinemeta on Home screen',
        copy: 'You can now hide the default Cinemeta catalogs without uninstalling the Cinemeta addon — something Stremio doesn’t support natively.',
        status: 'new'
      }
    ]
  }
]

const workflowSteps = [
  {
    step: 'Step 0',
    title: 'Authenticate',
    items: [
      'If you want fast account switching, turn on “Enable saved logins on this device”. This keeps multiple accounts (email / password / AuthKey) in this browser only.',
      'Either enter your Stremio email + password, or paste an existing AuthKey directly.',
      'To copy an AuthKey manually: log into <a href="https://web.stremio.com/" target="_blank" rel="noopener">https://web.stremio.com/</a>, open the browser console, and run<div><code>JSON.parse(localStorage.getItem("profile")).auth.key</code></div>Copy that value here into the AuthKey field.'
    ]
  },
  {
    step: 'Step 1',
    title: 'Load / Backup',
    items: [
      'Click “Load Addons” to pull in your current addons and catalogs from the authenticated account.',
      'Click “Backup” to download a JSON snapshot. Keep that file safe — it’s your rollback point and your way to migrate to another account.',
      'Use “Restore…” later to import that snapshot if you want to undo changes or clone the setup somewhere else.'
    ]
  },
  {
    step: 'Step 2',
    title: 'Edit & Reorder',
    items: [
      'Reorder addons by dragging their handles. This affects which sources and catalogs show up first in Stremio.',
      'Open an addon’s editor to rename both the addon and its catalogs, delete catalogs you don’t need, and drag them into a better order — no manual JSON required.',
      'Toggle the Home icon on any catalog to show or hide that row on Stremio’s Home screen.',
      'Review the updated configuration, so you’re happy with what will surface first, and what catalogs are hidden on the Home screen.'
    ]
  },
  {
    step: 'Step 3',
    title: 'Sync to Stremio',
    items: [
      'Check everything one last time: the addons order, and within an addon also check the catalog names, their order, and which catalogs are visible on the Home screen.',
      'Click “Sync to Stremio” to apply the new layout to the currently signed-in account.',
      'If you don’t like the result, use the backup from Step 1 and restore it.'
    ]
  }
]

const deepDiveSections = [
  {
    title: 'Why this exists',
    content: `Stremio doesn’t let you properly reorder addons or control which catalogs appear first, and moving a tuned setup to another account normally means uninstalling and reinstalling addons in a specific order. This tool uses Stremio’s API so you can reorder, tidy, back up, restore, and sync in minutes.`
  },
  {
    title: 'Safety first',
    content: `This is an unofficial tool. Use it at your own risk. Saved logins never leave this browser, and turning the feature off wipes them, but anyone with access to this device could reuse those credentials. Don’t enable saved logins on shared or public machines.`
  }
]

const panelDefinitions = [
  {
    id: 'spotlights',
    title: 'Everything you can do here',
    subtitle: 'Scan the feature set before you start rearranging anything.',
    kind: 'spotlights',
  },
  {
    id: 'workflow',
    title: 'Step-by-step workflow',
    subtitle: 'Follow this guide from sign-in to syncing your final layout.',
    kind: 'workflow',
  },
]

const PANEL_STATE_KEY = 'sam.summary.openPanels.v1'
const defaultOpenPanels = panelDefinitions.map(panel => panel.id)

function loadStoredPanels() {
  if (typeof window === 'undefined') return [...defaultOpenPanels]
  try {
    const raw = window.localStorage.getItem(PANEL_STATE_KEY)
    if (!raw) return [...defaultOpenPanels]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...defaultOpenPanels]
    const validIds = new Set(panelDefinitions.map(panel => panel.id))
    const sanitized = parsed.filter((panel) => typeof panel === 'string' && validIds.has(panel))
    if (parsed.length === 0) return []
    if (sanitized.length) return sanitized
    return [...defaultOpenPanels]
  } catch {
    return [...defaultOpenPanels]
  }
}

function persistPanels(panels) {
  if (typeof window === 'undefined') return
  try {
    const validIds = new Set(panelDefinitions.map(panel => panel.id))
    const sanitized = panels.filter(id => validIds.has(id))
    window.localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(sanitized))
  } catch {
    /* ignore */
  }
}

const accordionPanels = panelDefinitions

const openPanels = ref(loadStoredPanels())

function isPanelOpen(id) {
  return openPanels.value.includes(id)
}

function togglePanel(id) {
  if (isPanelOpen(id)) {
    const next = openPanels.value.filter(panelId => panelId !== id)
    openPanels.value = next
    persistPanels(next)
  } else {
    const next = Array.from(new Set([...openPanels.value, id]))
    openPanels.value = next
    persistPanels(next)
  }
}
</script>

<template>
  <section id="summary" class="summary">
    <section
      v-for="panel in accordionPanels"
      :key="panel.id"
      class="summary-accordion"
    >
      <button
        type="button"
        class="summary-accordion__toggle"
        :aria-expanded="isPanelOpen(panel.id)"
        @click="togglePanel(panel.id)"
      >
        <div class="summary-accordion__copy">
          <p class="summary-accordion__title">{{ panel.title }}</p>
          <p class="summary-accordion__subtitle">{{ panel.subtitle }}</p>
        </div>
        <i :class="['uil', isPanelOpen(panel.id) ? 'uil-angle-up' : 'uil-angle-down']"></i>
      </button>
      <transition name="summary-fade">
        <div v-if="isPanelOpen(panel.id)" class="summary-accordion__content">
          <template v-if="panel.kind === 'spotlights'">
            <div class="summary-panel__header summary-panel__header--inline">
            </div>
            <div
              v-for="section in spotlightSections"
              :key="section.id"
              class="summary-spotlight-section"
            >
              <div class="summary-spotlight-section__header">
                <h4>{{ section.title }}</h4>
              </div>
              <div class="summary-chips summary-chips--spotlight">
                <article
                  v-for="feature in section.features"
                  :key="feature.title"
                  :class="['summary-chip', { 'summary-chip--new': feature.status === 'new' }]"
                >
                  <div class="summary-chip__heading">
                    <h4 class="summary-chip__title">{{ feature.title }}</h4>
                    <span v-if="feature.status === 'new'" class="summary-chip__badge">New</span>
                  </div>
                  <p>{{ feature.copy }}</p>
                </article>
              </div>
            </div>
          </template>
          <template v-else-if="panel.kind === 'workflow'">
            <div class="summary-panel__header summary-panel__header--inline">
            </div>
            <div class="summary-steps">
              <article v-for="step in workflowSteps" :key="step.step" class="summary-step">
                <h4><span>{{ step.step }}</span>{{ step.title }}</h4>
                <p v-if="step.copy">{{ step.copy }}</p>
                <ul v-else class="summary-step__list">
                  <li v-for="item in step.items" :key="item" v-html="item"></li>
                </ul>
              </article>
            </div>
            <div class="summary-deep summary-deep--inline">
              <h3>Summary</h3>
              <article v-for="section in deepDiveSections" :key="section.title" class="summary-deep__block">
                <h5>{{ section.title }}</h5>
                <p>{{ section.content }}</p>
              </article>
              <p class="summary-disclaimer">
                Unofficial tool. Not affiliated with Stremio. Use it at your own risk.
              </p>
            </div>
          </template>
        </div>
      </transition>
    </section>
  </section>
</template>

<style scoped>

.summary {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 2.25rem;
}

.summary-panel {
  border-radius: 18px;
  padding: 1.6rem;
  background: rgba(12, 14, 18, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.summary-panel__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.summary-panel__header--inline {
  gap: 0.2rem;
}

.summary-panel__label {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.summary-panel__header h3 {
  margin: 0;
  font-size: 1.75rem;
}

.summary-accordion {
  width: 100%;
  display: block;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(12, 14, 18, 0.6);
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.38);
  overflow: hidden;
}

.summary-accordion + .summary-accordion {
  margin-top: 0.35rem;
}

.summary-accordion__toggle {
  width: 100%;
  background: linear-gradient(130deg, rgba(21, 205, 116, 0.25), rgba(21, 205, 116, 0.05));
  color: inherit;
  border: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.1rem 1.4rem;
  border-radius: 18px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  text-align: left;
}

.summary-accordion__toggle:hover {
  transform: translateY(-1px);
  box-shadow: 0 15px 36px rgba(21, 205, 116, 0.32);
}

.summary-accordion__toggle i {
  font-size: 3rem;
  color: #15cd74;
}

.summary-accordion__copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.summary-accordion__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  text-align: left;
}

.summary-accordion__subtitle {
  margin: 0.15rem 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.1rem;
  text-align: left;
}

.summary-accordion__content {
  padding: 0 1.4rem 1.35rem;
}

.summary-accordion__content:first-child,
.summary-accordion__content > :first-child {
  margin-top: 0.8rem;
}

.summary-chips {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.summary-chips--spotlight {
  gap: 1.15rem;
}

.summary-spotlight-section {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.summary-spotlight-section + .summary-spotlight-section {
  margin-top: 1.45rem;
}

.summary-spotlight-section__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-spotlight-section__header h4 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}

.summary-chip {
  border-radius: 14px;
  padding: 1.05rem 1.2rem;
  background: rgba(21, 205, 116, 0.08);
  border: 1px solid rgba(21, 205, 116, 0.24);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.summary-chip--new {
  background: rgba(21, 205, 116, 0.16);
  border-color: rgba(21, 205, 116, 0.34);
  box-shadow: 0 12px 28px rgba(21, 205, 116, 0.22);
}

.summary-chip__heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
}

.summary-chip__badge {
  background: rgba(21, 205, 116, 0.22);
  color: #15cd74;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
}

.summary-chip__title {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.summary-chip p {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

.summary-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-step {
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.summary-step h4 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.summary-step h4 span {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(21, 205, 116, 0.8);
}

.summary-step p {
  margin: 0;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.55;
}

.summary-step__list {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-step__list li {
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.55;
}

.summary-deep {
  display: grid;
  gap: 1.5rem;
}

.summary-deep--inline {
  margin-top: 1.6rem;
  gap: 1.35rem;
}

.summary-deep__block {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.summary-deep__block h4,
.summary-deep__block h5 {
  margin: 0 0 0.5rem;
}

.summary-deep__block p {
  margin: 0;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.55;
}

.summary-disclaimer {
  margin: 0;
  font-style: italic;
  color: #d0a060;
  font-size: 0.95rem;
}

.summary-fade-enter-active,
.summary-fade-leave-active {
  transition: opacity 0.2s ease;
}
.summary-fade-enter-from,
.summary-fade-leave-to {
  opacity: 0;
}
</style>
