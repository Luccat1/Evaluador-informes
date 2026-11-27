// Formas de los datos que circulan entre las funciones. Solo documentación y chequeo de tipos:
// no se sube a Apps Script (.claspignore) ni se ejecuta.

/** Respuestas de un curso/profesor ya agrupadas (resultado de processData). */
interface CourseData {
  professor: string;
  course: string;
  /** Una fila por estudiante; un valor por pregunta de escala (null si no respondió o no aplica). */
  responses: (number | null)[][];
  /** Comentarios dirigidos al profesor/a. */
  comments: string[];
  /** Comentarios sobre la asignatura. */
  commentsCourse: string[];
  langs: { es: number; en: number };
}

interface DimensionStats {
  mean: number;
  /** Porcentaje (0-100) de respuestas 4 o 5. */
  agreement: number;
  /** Respuestas válidas (0 si la pregunta no aplica o no se respondió). */
  n: number;
  /** Cantidad de respuestas con 1, 2, 3, 4 y 5. */
  dist: number[];
}

interface CourseStats {
  /** Por índice de dimensión (0-based). */
  dimensions: Record<number, DimensionStats>;
  /** Media de las medias de las dimensiones de docencia. */
  generalMean: number;
}

interface SemesterStats {
  /** Respuestas totales del semestre. */
  n: number;
  /** Media por nombre de dimensión. */
  meansByDimension: Record<string, number>;
  globalMean: number;
}

type Level = 'ABOVE' | 'EQUAL' | 'BELOW' | 'ATTENTION';

/** Una fila del resumen comparativo (ver buildSummaryRows). */
interface SummaryRow {
  professor: string;
  course: string;
  n: number;
  mean: number;
  diff: number;
  att: number;
  below: number;
  lowest: { name: string; mean: number } | null;
  agreement: number | null;
  comments: number;
  reliable: boolean;
  priority: 'Alta' | 'Media' | 'Baja';
  dims: (number | null)[];
}
