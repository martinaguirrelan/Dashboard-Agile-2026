// Tab navigation for Squad Detail Page
import React, { useState } from 'react'

const TAB_STYLES = {
  container: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid var(--rule)',
    marginBottom: '24px',
  },
  tab: {
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--ink-60)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tabActive: {
    color: 'var(--ink)',
    borderBottomColor: 'var(--accent)',
  },
}

export function SquadTabs({ tabs, defaultTab = 0, onChange }) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  const handleTabChange = (index) => {
    setActiveTab(index)
    onChange?.(index)
  }

  return (
    <div>
      <div style={TAB_STYLES.container}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(index)}
            style={{
              ...TAB_STYLES.tab,
              ...(activeTab === index ? TAB_STYLES.tabActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tabs[activeTab]?.content}
      </div>
    </div>
  )
}
