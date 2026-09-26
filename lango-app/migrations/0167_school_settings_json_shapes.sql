-- 0167_school_settings_json_shapes.sql — SEEDED JSON ARRAYS BECOME THE OBJECTS THE UI EXPECTS.
--
-- SETTINGS-CORE-FIX-01 SCF-03-02. The seed wrote `languages` and `presence_modes`
-- as ARRAYS (["fr","ar"], ["morning","afternoon"]) while the Organisation form,
-- its API schema and the document renderers all read OBJECTS
-- ({francais,arabe,anglais} and the 7 presence toggles). On the VPS that showed
-- up as the "0 / 1" toggles and as a 422 when saving the page unchanged: the form
-- posted back the array it had been given, and the schema rejected it.
--
-- Also fixes `document_header_style` values the enum does not accept
-- ('classic' -> 'classique'); valid values are classique | minimal | moderne.
-- seed-full.ts is corrected in the same change so new databases never need this.
--
-- IDEMPOTENT: every write is guarded by a jsonb_typeof check, so a second run
-- matches nothing. No row is deleted, no column dropped, no trigger bypassed.
-- A value already in object shape is left exactly as it is — this migration
-- repairs the SHAPE, it never re-decides a school's settings.

-- ---------------------------------------------------------------------------
-- 1. school_settings: languages array -> {francais, arabe, anglais}
-- ---------------------------------------------------------------------------
UPDATE school_settings
SET languages = jsonb_build_object(
      'francais', languages ? 'fr',
      'arabe',    languages ? 'ar',
      'anglais',  languages ? 'en'
    )
WHERE jsonb_typeof(languages) = 'array';

-- ---------------------------------------------------------------------------
-- 2. school_settings: presence_modes array -> the 7 toggle keys
-- ---------------------------------------------------------------------------
-- A legacy array that names no absence/lateness status (e.g. just
-- ["morning","afternoon"]) came from a school that never distinguished them,
-- so every status is turned ON rather than silently disabling attendance
-- reasons the school was using.
UPDATE school_settings
SET presence_modes = jsonb_build_object(
      'presence',            true,
      'absenceJustifiee',    CASE WHEN presence_modes ?| ARRAY['absenceJustifiee','absenceNonJustifiee','retard','sortieAnticipee','presence']
                                  THEN presence_modes ? 'absenceJustifiee' ELSE true END,
      'absenceNonJustifiee', CASE WHEN presence_modes ?| ARRAY['absenceJustifiee','absenceNonJustifiee','retard','sortieAnticipee','presence']
                                  THEN presence_modes ? 'absenceNonJustifiee' ELSE true END,
      'retard',              CASE WHEN presence_modes ?| ARRAY['absenceJustifiee','absenceNonJustifiee','retard','sortieAnticipee','presence']
                                  THEN presence_modes ? 'retard' ELSE true END,
      'sortieAnticipee',     CASE WHEN presence_modes ?| ARRAY['absenceJustifiee','absenceNonJustifiee','retard','sortieAnticipee','presence']
                                  THEN presence_modes ? 'sortieAnticipee' ELSE true END,
      'morning',             presence_modes ? 'morning',
      'afternoon',           presence_modes ? 'afternoon'
    )
WHERE jsonb_typeof(presence_modes) = 'array';

-- ---------------------------------------------------------------------------
-- 3. school_settings: document_header_style outside the enum -> 'classique'
-- ---------------------------------------------------------------------------
UPDATE school_settings
SET document_header_style = 'classique'
WHERE document_header_style IS NOT NULL
  AND document_header_style NOT IN ('classique', 'minimal', 'moderne');

-- ---------------------------------------------------------------------------
-- 4. setting_values: the same two shapes under their registry keys
-- ---------------------------------------------------------------------------
-- Only the two keys that exist today are targeted by name; a LIKE would catch
-- a school's own custom key by accident.
UPDATE setting_values
SET value = jsonb_build_object(
      'francais', value ? 'fr',
      'arabe',    value ? 'ar',
      'anglais',  value ? 'en'
    )
WHERE key = 'localization.languages'
  AND jsonb_typeof(value) = 'array';

UPDATE setting_values
SET value = jsonb_build_object(
      'presence',            true,
      'absenceJustifiee',    CASE WHEN value ?| ARRAY['absenceJustifiee','absenceNonJustifiee','retard','sortieAnticipee','presence']
                                  THEN value ? 'absenceJustifiee' ELSE true END,
      'absenceNonJustifiee', CASE WHEN value ?| ARRAY['absenceJustifiee','absenceNonJustifiee','retard','sortieAnticipee','presence']
                                  THEN value ? 'absenceNonJustifiee' ELSE true END,
      'retard',              CASE WHEN value ?| ARRAY['absenceJustifiee','absenceNonJustifiee','retard','sortieAnticipee','presence']
                                  THEN value ? 'retard' ELSE true END,
      'sortieAnticipee',     CASE WHEN value ?| ARRAY['absenceJustifiee','absenceNonJustifiee','retard','sortieAnticipee','presence']
                                  THEN value ? 'sortieAnticipee' ELSE true END,
      'morning',             value ? 'morning',
      'afternoon',           value ? 'afternoon'
    )
WHERE key = 'attendance.presenceModes'
  AND jsonb_typeof(value) = 'array';

UPDATE setting_values
SET value = to_jsonb('classique'::text)
WHERE key = 'organization.documentHeaderStyle'
  AND jsonb_typeof(value) = 'string'
  AND value #>> '{}' NOT IN ('classique', 'minimal', 'moderne');
