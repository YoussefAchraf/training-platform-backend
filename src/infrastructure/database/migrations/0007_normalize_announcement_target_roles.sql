DO $$
DECLARE
  n bigint;
  sample int[];
BEGIN
  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample
  FROM feature_announcements WHERE jsonb_typeof(target_roles) <> 'array';
  IF n > 0 THEN
    RAISE EXCEPTION 'feature_announcements.target_roles must be a JSON array; % row(s) are not (example ids %). Nothing was changed.', n, sample;
  END IF;

  SELECT count(*), (array_agg(DISTINCT a.id))[1:10] INTO n, sample
  FROM feature_announcements a
  CROSS JOIN LATERAL jsonb_array_elements_text(a.target_roles) AS t(name)
  WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = t.name);
  IF n > 0 THEN
    RAISE EXCEPTION 'feature_announcements.target_roles names a role that does not exist in % element(s) (example announcement ids %). Nothing was changed.', n, sample;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS feature_announcement_target_roles (
  announcement_id INTEGER NOT NULL REFERENCES feature_announcements(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  PRIMARY KEY (announcement_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_target_roles_role ON feature_announcement_target_roles (role_id);

INSERT INTO feature_announcement_target_roles (announcement_id, role_id)
SELECT a.id, r.id
FROM feature_announcements a
CROSS JOIN LATERAL jsonb_array_elements_text(a.target_roles) AS t(name)
JOIN roles r ON r.name = t.name
ON CONFLICT DO NOTHING;

ALTER TABLE feature_announcements
  ADD CONSTRAINT ck_announcements_target_roles_array CHECK (jsonb_typeof(target_roles) = 'array') NOT VALID;

CREATE OR REPLACE FUNCTION sync_announcement_target_roles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.target_roles) AS t(name)
    WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = t.name)
  ) THEN
    RAISE EXCEPTION 'new row for relation "feature_announcements" violates check constraint "ck_announcements_target_roles_known"'
      USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM feature_announcement_target_roles WHERE announcement_id = NEW.id;
  INSERT INTO feature_announcement_target_roles (announcement_id, role_id)
  SELECT NEW.id, r.id
  FROM jsonb_array_elements_text(NEW.target_roles) AS t(name)
  JOIN roles r ON r.name = t.name
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_announcement_target_roles ON feature_announcements;

CREATE TRIGGER trg_sync_announcement_target_roles
  AFTER INSERT OR UPDATE OF target_roles ON feature_announcements
  FOR EACH ROW EXECUTE FUNCTION sync_announcement_target_roles();
