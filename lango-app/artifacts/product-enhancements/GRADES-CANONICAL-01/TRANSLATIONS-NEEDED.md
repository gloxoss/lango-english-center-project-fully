# Translation keys needed (for the translation agent)

The new parent grades page (`/dashboard/parent/grades`, `features/parent/ui/GradesView.tsx`) and its menu entry use these keys. They are not in `locales/{fr,en,ar}.json` yet, so the page shows raw keys (and an error overlay in dev) until they are added.

| Key | FR |
|---|---|
| `Navigation.parentGrades` | Notes de mes enfants |
| `Parent.gradesTitle` | Notes |
| `Parent.gradesSubtitle` | Notes publiées par l'école, par matière. |
| `Parent.gradesEmpty` | Aucune note publiée pour le moment. |
| `Parent.gradesError` | Impossible de charger les notes. |
| `Parent.gradesNoAccess` | Vous n'avez pas accès au suivi scolaire de cet enfant. |
| `Parent.gradesAverage` | Moyenne provisoire : {value} / 20 |
| `Parent.gradeExempted` | Dispensé |
| `Parent.gradeAbsent` | Absent |
| `Parent.gradeTypeQuiz` | Contrôle |
| `Parent.gradeTypeExam` | Examen écrit |
| `Parent.gradeTypeOnlineExam` | Examen en ligne |
| `Parent.gradeTypeHomework` | Devoir |
| `Parent.gradeTypeProject` | Projet |
| `Parent.gradeTypeOral` | Oral |
| `Parent.gradeTypePractical` | Pratique |

Also hard-coded French to move to keys later: `features/academics/data/evaluations-config.ts` (ASSESSMENT_TYPE_LABELS) and the "Classe · Matière" picker labels in `features/academics/ui/exam-planning-client.tsx`.
