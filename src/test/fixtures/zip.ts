import JSZip from 'jszip'

export async function loopZipFile(options: {
  perHabitCheckmarks?: boolean
  aggregateCheckmarks?: boolean
  numericalHabit?: boolean
} = {}): Promise<File> {
  const {
    perHabitCheckmarks = true,
    aggregateCheckmarks = false,
    numericalHabit = false
  } = options
  const zip = new JSZip()
  const habitRows = [
    'Position,Name,Type,Question,Description,FrequencyNumerator,FrequencyDenominator,Color,Unit,Target Type,Target Value,Archived?',
    '001,Read,YES_NO,Did you read?,Read books,3,7,#2F80ED,,,,false'
  ]

  if (numericalHabit) {
    habitRows.push('002,Water,NUMERICAL,How many liters?,,1,1,#27AE60,L,AT_LEAST,2,false')
  }

  zip.file('Habits.csv', habitRows.join('\n'))

  if (perHabitCheckmarks) {
    zip.folder('001 Read')!.file('Checkmarks.csv', 'Date,Value,Notes\n2026-05-09,YES_MANUAL,Morning\n')
    if (numericalHabit) {
      zip.folder('002 Water')!.file('Checkmarks.csv', 'Date,Value,Notes\n2026-05-09,2500,Hydrated\n')
    }
  }

  if (aggregateCheckmarks) {
    const header = numericalHabit ? 'Date,Read,Water,' : 'Date,Read,'
    const row = numericalHabit ? '2026-05-08,YES_MANUAL,2000,' : '2026-05-08,YES_MANUAL,'
    zip.file('Checkmarks.csv', `${header}\n${row}\n`)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'loop.zip', { type: 'application/zip' })
}
