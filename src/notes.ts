/** One shared campaign pad. Everyone can edit. Author + time stamp the last save. */
export interface SharedNote {
  body: string
  author: string
  at: number
}

export const emptyNote = (): SharedNote => ({ body: '', author: '', at: 0 })
