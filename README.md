# Open Habits Fixed

Frontend responsive en React + Vite + TypeScript para replicar la experiencia básica de Loop Habit Tracker.

## Ejecutar

```bash
npm install
npm run dev
```

Abre:

```text
http://localhost:5173
```

## Importar ZIP

Pulsa **Importar ZIP** y selecciona una exportación de Loop Habit Tracker / Android Habits.

Soporta:

```text
Habits.csv
Checkmarks.csv
Scores.csv
001 Nombre/Checkmarks.csv
001 Nombre/Scores.csv
```

La app importa `Habits.csv` y los `Checkmarks.csv`. Los `Scores.csv` no se importan como verdad fuente: se recalculan desde las entradas.

## Exportar ZIP

Pulsa **Exportar ZIP**. Exporta:

```text
Habits.csv
Checkmarks.csv
Scores.csv
001 Nombre/Checkmarks.csv
001 Nombre/Scores.csv
```

## Nota

Esta versión corrige la anterior: ahora la importación no solo cuenta archivos del ZIP, sino que parsea hábitos y registros y actualiza la UI.
