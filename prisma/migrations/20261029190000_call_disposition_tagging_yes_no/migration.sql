-- Call Disposition: "All Queries Tagged" and "Correct Tagging" change from
-- Y / FATAL / N/A to the standard Y / N / N/A (Yes = max (5), No = 0,
-- N/A excluded from the total, never fatal).
--
-- Data-only and idempotent: rewrites only those two params (ids
-- call-alltagged / call-correcttag) while they still have a fatal-capable
-- definition, matching the read-time repair in lib/audit/fatal-yn-params.ts.
-- Chat Disposition (chat-alltagged / chat-correcttag) is NOT changed.
-- Saved audits are NOT touched: an audit saved with FATAL on these params
-- keeps its stored rows / totals / quality % / final % (0%, Failed).

UPDATE "form_templates" AS t
SET
  "sections" = (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(sec -> 'params') = 'array' THEN
          jsonb_set(
            sec,
            '{params}',
            (
              SELECT COALESCE(
                jsonb_agg(
                  CASE
                    WHEN p ->> 'id' IN ('call-alltagged', 'call-correcttag')
                      AND (
                        p ->> 'scoring' IN ('Y/Fatal/NA', 'Y/N/Fatal/NA')
                        OR p ? 'fatalOptionLabel'
                        OR p ? 'fatalOn'
                      )
                    THEN
                      (p - 'fatalOptionLabel' - 'fatalOn')
                        || jsonb_build_object(
                          'scoring', 'Y/N/NA',
                          'points', jsonb_build_object(
                            'Y', COALESCE(p -> 'max', '5'::jsonb),
                            'N', 0
                          )
                        )
                    ELSE p
                  END
                  ORDER BY p_ord
                ),
                '[]'::jsonb
              )
              FROM jsonb_array_elements(sec -> 'params') WITH ORDINALITY AS pp(p, p_ord)
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
  AND jsonb_path_exists(
    t."sections",
    '$[*].params[*] ? ((@.id == "call-alltagged" || @.id == "call-correcttag") && (@.scoring == "Y/Fatal/NA" || @.scoring == "Y/N/Fatal/NA" || exists(@.fatalOptionLabel) || exists(@.fatalOn)))'
  );
