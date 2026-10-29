-- Add "Urgency Creation" (Yes = 3 / No = 0, N/A excluded) to the
-- "Sales & Compliance" section of the built-in Call and Chat templates,
-- right after "Client Nurturing". Sales & Compliance 18 -> 21 pts,
-- Call 97 -> 100 pts, Chat 100 -> 103 pts.
--
-- Data-only and idempotent: a template that already has the parameter, or
-- whose Sales & Compliance section no longer exists, is left alone. Custom
-- templates are not changed. Saved audits are NOT touched: each audit keeps
-- its own stored scores / rows / catScores / totals / quality %.

UPDATE "form_templates" AS t
SET
  "sections" = (
    SELECT jsonb_agg(
      CASE
        WHEN sec ->> 'id' = v.section_id AND jsonb_typeof(sec -> 'params') = 'array' THEN
          jsonb_set(
            sec,
            '{params}',
            (
              SELECT jsonb_agg(x.p ORDER BY x.k)
              FROM (
                SELECT pp.p, pp.p_ord::numeric AS k
                FROM jsonb_array_elements(sec -> 'params') WITH ORDINALITY AS pp(p, p_ord)
                UNION ALL
                SELECT
                  jsonb_set(v.param, '{cat}', COALESCE(sec -> 'name', v.param -> 'cat')),
                  COALESCE(
                    (
                      SELECT a.a_ord
                      FROM jsonb_array_elements(sec -> 'params') WITH ORDINALITY AS a(ap, a_ord)
                      WHERE a.ap ->> 'id' = v.after_id
                      LIMIT 1
                    ),
                    jsonb_array_length(sec -> 'params')
                  )::numeric + 0.5
              ) AS x
            )
          )
        ELSE sec
      END
      ORDER BY s_ord
    )
    FROM jsonb_array_elements(t."sections") WITH ORDINALITY AS ss(sec, s_ord)
  ),
  "updated_at" = NOW()
FROM (
  VALUES
    (
      'call',
      'call-sales',
      'call-nurturing',
      '{"id": "call-urgency", "name": "Urgency Creation", "max": 3, "cat": "Sales & Compliance", "scoring": "Y/N/NA", "points": {"Y": 3, "N": 0}}'::jsonb
    ),
    (
      'chat',
      'chat-sales',
      'chat-nurturing',
      '{"id": "chat-urgency", "name": "Urgency Creation", "max": 3, "cat": "Sales & Compliance", "scoring": "Y/N/NA", "points": {"Y": 3, "N": 0}}'::jsonb
    )
) AS v(template_id, section_id, after_id, param)
WHERE t."id" = v.template_id
  AND jsonb_typeof(t."sections") = 'array'
  AND jsonb_path_exists(
    t."sections",
    '$[*] ? (@.id == $sid)',
    jsonb_build_object('sid', v.section_id)
  )
  AND NOT jsonb_path_exists(
    t."sections",
    '$[*].params[*] ? (@.id == $pid)',
    jsonb_build_object('pid', v.param ->> 'id')
  );

UPDATE "form_templates"
SET "description" = '100-point call interaction rubric.', "updated_at" = NOW()
WHERE "id" = 'call' AND "description" = '97-point call interaction rubric.';

UPDATE "form_templates"
SET "description" = '103-point chat interaction rubric.', "updated_at" = NOW()
WHERE "id" = 'chat' AND "description" = '100-point chat interaction rubric.';
