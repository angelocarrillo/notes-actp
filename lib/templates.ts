import { type NoteType, type NewNote, type NoteItem, itemId } from './notes'

export interface TemplateDef {
  type: NoteType
  name: string
  blurb: string
  accent: string
  // one or more SVG path segments (space-separated ' M' groups, like the nav icons)
  icon: string
}

export const TEMPLATES: TemplateDef[] = [
  {
    type: 'blank',
    name: 'Blank Note',
    blurb: 'A plain page to jot anything down.',
    accent: '#7c8fa8',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
  },
  {
    type: 'todo',
    name: 'To-Do List',
    blurb: 'A checklist with tap-to-complete items.',
    accent: '#8a7ad8',
    icon: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  },
  {
    type: 'timeline',
    name: 'Project Timeline',
    blurb: 'Milestones with target dates and status.',
    accent: '#5b8fd4',
    icon: 'M12 2v20 M12 7h8 M12 13h5 M12 19h9 M8 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M8 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  },
  {
    type: 'grocery',
    name: 'Grocery List',
    blurb: 'A shopping list grouped by aisle.',
    accent: '#5ba871',
    icon: 'M6 6h15l-1.5 9h-12z M6 6L5 3H2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  },
  {
    type: 'meal',
    name: 'Meal Plan',
    blurb: 'A weekly planner for breakfast, lunch & dinner.',
    accent: '#d4995b',
    icon: 'M4 3v18 M4 8h4 M6 3v18 M15 3c-1.5 1.5-2 3-2 5 0 2 1 3 2 3s2-1 2-3c0-2-.5-3.5-2-5z M15 11v10',
  },
]

export const GROCERY_CATEGORIES = [
  'Produce', 'Dairy', 'Meat & Seafood', 'Bakery', 'Frozen', 'Pantry', 'Household', 'Other',
]

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner']

export function templateByType(type: NoteType): TemplateDef {
  return TEMPLATES.find(t => t.type === type) ?? TEMPLATES[0]
}

/** Produce a fresh, ready-to-save note for a given template type. */
export function seedNote(type: NoteType): NewNote {
  const t = templateByType(type)
  let items: NoteItem[] = []
  let body = ''

  switch (type) {
    case 'todo':
      items = [1, 2, 3].map(() => ({ id: itemId(), text: '', done: false }))
      break
    case 'grocery':
      items = [
        { id: itemId(), text: '', done: false, category: 'Produce' },
        { id: itemId(), text: '', done: false, category: 'Dairy' },
        { id: itemId(), text: '', done: false, category: 'Pantry' },
      ]
      break
    case 'timeline':
      items = [
        { id: itemId(), text: 'Kickoff', date: '', done: false },
        { id: itemId(), text: 'Phase 1', date: '', done: false },
        { id: itemId(), text: 'Launch',  date: '', done: false },
      ]
      break
    case 'meal':
      items = WEEKDAYS.flatMap(day =>
        MEAL_SLOTS.map(slot => ({ id: itemId(), text: '', day, slot })),
      )
      break
    case 'blank':
    default:
      body = ''
      break
  }

  return { title: '', type, folder: '', body, items }
}
