import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Card } from '../../../components/ui'
import { TraceIcon, type TraceIconName } from './TraceIcon'

export interface TraceSection {
  id: string
  label: string
  mobileLabel?: string
  icon: TraceIconName
  content: ReactNode
}

export function TraceSections({ sections }: { sections: TraceSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const [openIds, setOpenIds] = useState<string[]>([sections[0]?.id ?? ''])
  const active = sections.find((section) => section.id === activeId) ?? sections[0]
  const mobileSections = [...sections].sort((a, b) => {
    const order = ['journey', 'temperature', 'documents', 'nft', 'technical']
    return order.indexOf(a.id) - order.indexOf(b.id)
  })

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % sections.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + sections.length) % sections.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = sections.length - 1
    else return
    event.preventDefault()
    setActiveId(sections[next].id)
    const tabs =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[next]?.focus()
  }

  function toggle(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  return (
    <>
      <Card className="trace-desktop-panels">
        <div className="trace-tabs" role="tablist" aria-label="Nội dung truy xuất lô">
          {sections.map((section, index) => (
            <button
              key={section.id}
              id={`trace-tab-${section.id}`}
              type="button"
              role="tab"
              aria-selected={active?.id === section.id}
              aria-controls="trace-active-panel"
              tabIndex={active?.id === section.id ? 0 : -1}
              onClick={() => setActiveId(section.id)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              <TraceIcon name={section.icon} />
              <span>{section.label}</span>
            </button>
          ))}
        </div>
        <div
          id="trace-active-panel"
          className="trace-tab-content"
          role="tabpanel"
          aria-labelledby={`trace-tab-${active?.id}`}
          tabIndex={0}
        >
          {active?.content}
        </div>
      </Card>

      <div className="trace-mobile-panels">
        {mobileSections.map((section) => {
          const open = openIds.includes(section.id)
          return (
            <section className="trace-accordion" key={section.id}>
              <h2>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`trace-accordion-${section.id}`}
                  onClick={() => toggle(section.id)}
                >
                  <span className="trace-accordion-icon">
                    <TraceIcon name={section.icon} />
                  </span>
                  <span className="trace-accordion-title">
                    {section.mobileLabel ?? section.label}
                  </span>
                  <TraceIcon name="down" className="trace-accordion-chevron" />
                </button>
              </h2>
              {open && (
                <div id={`trace-accordion-${section.id}`} className="trace-accordion-content">
                  {section.content}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
