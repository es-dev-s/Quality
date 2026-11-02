-- Current Chat rubric: retire Urgency Creation (3 pts) and make Correct
-- Tagging Y=5 / N=0 / N/A. Saved audit scores and results stay untouched.
-- Idempotent; matches the template read-time repairs.
UPDATE "form_templates" AS t
SET "sections" = (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(sec -> 'params') = 'array' THEN
      jsonb_set(sec, '{params}', (
        SELECT COALESCE(jsonb_agg(
          CASE WHEN p ->> 'id' = 'chat-correcttag' AND (
            p ->> 'scoring' IN ('Y/Fatal/NA', 'Y/N/Fatal/NA')
            OR p ? 'fatalOptionLabel' OR p ? 'fatalOn'
          ) THEN
            (p - 'fatalOptionLabel' - 'fatalOn') || jsonb_build_object(
              'scoring', 'Y/N/NA',
              'points', jsonb_build_object('Y', COALESCE(p -> 'max', '5'::jsonb), 'N', 0)
            )
          ELSE p END ORDER BY p_ord
        ) FILTER (WHERE p ->> 'id' IS DISTINCT FROM 'chat-urgency'), '[]'::jsonb)
        FROM jsonb_array_elements(sec -> 'params') WITH ORDINALITY AS pp(p, p_ord)
      ))
    ELSE sec END ORDER BY s_ord
  )
  FROM jsonb_array_elements(t."sections") WITH ORDINALITY AS ss(sec, s_ord)
), "updated_at" = NOW()
WHERE jsonb_typeof(t."sections") = 'array'
  AND jsonb_path_exists(t."sections", '$[*].params[*] ? (@.id == "chat-urgency" || (@.id == "chat-correcttag" && (@.scoring == "Y/Fatal/NA" || @.scoring == "Y/N/Fatal/NA" || exists(@.fatalOptionLabel) || exists(@.fatalOn))))');

UPDATE "form_templates"
SET "description" = '100-point chat interaction rubric.', "updated_at" = NOW()
WHERE "id" = 'chat' AND "description" = '103-point chat interaction rubric.';
