-- Remove the retired "Hold (<=1min 3x)" parameter (id "call-hold", 3 pts)
-- from Call Compliance in stored form templates. Call total becomes 97.
--
-- Data-only and idempotent. Saved audits are NOT touched: each audit keeps
-- its own stored scores / rows / catScores / totals / quality %.

UPDATE "form_templates" AS t
SET
  "sections" = (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(sec -> 'params') = 'array' THEN
          jsonb_set(
            sec,
            '{params}',
            COALESCE(
              (
                SELECT jsonb_agg(p ORDER BY p_ord)
                FROM jsonb_array_elements(sec -> 'params') WITH ORDINALITY AS pp(p, p_ord)
                WHERE (p ->> 'id') IS DISTINCT FROM 'call-hold'
              ),
              '[]'::jsonb
            )
          )
        ELSE sec
      END
      ORDER BY s_ord
    )
    FROM jsonb_array_elements(t."sections") WITH ORDINALITY AS ss(sec, s_ord)
  ),
  "updated_at" = NOW()
WHERE jsonb_typeof(t."sections") = 'array'
  AND jsonb_path_exists(t."sections", '$[*].params[*] ? (@.id == "call-hold")');

UPDATE "form_templates"
SET "description" = '97-point call interaction rubric.', "updated_at" = NOW()
WHERE "id" = 'call' AND "description" = '100-point call interaction rubric.';
