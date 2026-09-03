

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected', 'deactivated');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE assignment_status AS ENUM ('unassigned', 'pending', 'accepted', 'refused');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE training_duration_unit AS ENUM ('days', 'hours');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('pending', 'present', 'absent');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE feedback_category AS ENUM ('bug', 'enhancement', 'other');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    firstname       VARCHAR(100) NOT NULL,
    lastname        VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         INTEGER NOT NULL REFERENCES roles(id),
    status          user_status NOT NULL DEFAULT 'pending',
    approved_by     INTEGER REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    has_seen_tour   BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS providers (
    id          SERIAL PRIMARY KEY,




    name        VARCHAR(150) NOT NULL,
    description TEXT,


    logo_url    VARCHAR(500),
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS trainings (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    provider_id   INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    description   TEXT,
    duration      INTEGER,
    duration_unit training_duration_unit,
    created_by    INTEGER REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS clients (
    id            SERIAL PRIMARY KEY,
    company_name  VARCHAR(150) NOT NULL,
    email         VARCHAR(150),
    phone         VARCHAR(30),
    created_by    INTEGER REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS instructors (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instructor_skills (
    instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
    training_id   INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    PRIMARY KEY (instructor_id, training_id)
);

CREATE TABLE IF NOT EXISTS training_sessions (
    id                  SERIAL PRIMARY KEY,
    training_id         INTEGER NOT NULL REFERENCES trainings(id),
    client_id           INTEGER NOT NULL REFERENCES clients(id),
    instructor_id       INTEGER REFERENCES instructors(id),
    start_date          TIMESTAMPTZ NOT NULL,
    end_date            TIMESTAMPTZ NOT NULL,
    session_status      session_status NOT NULL DEFAULT 'scheduled',
    assignment_status   assignment_status NOT NULL DEFAULT 'unassigned',
    include_weekends    BOOLEAN NOT NULL DEFAULT false,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS session_attendees (
    id                  SERIAL PRIMARY KEY,
    session_id          INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    name                VARCHAR(150) NOT NULL,
    email               VARCHAR(150),
    survey_submitted    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    event_date  TIMESTAMPTZ NOT NULL,
    end_date    TIMESTAMPTZ,
    title       VARCHAR(200) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surveys (
    id                  SERIAL PRIMARY KEY,
    session_id          INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    instructor_id       INTEGER NOT NULL REFERENCES instructors(id),
    attendee_id         INTEGER REFERENCES session_attendees(id),
    instructor_score    INTEGER NOT NULL CHECK (instructor_score BETWEEN 0 AND 5),
    nps_score           INTEGER NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
    comments            TEXT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER UNIQUE NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    pdf_url         VARCHAR(255),
    average_score   NUMERIC(4,2),
    nps_average     NUMERIC(5,2),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id            SERIAL PRIMARY KEY,
    actor_id      INTEGER REFERENCES users(id),
    action        VARCHAR(40) NOT NULL,
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     INTEGER NOT NULL,
    before        JSONB,
    after         JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);




CREATE TABLE IF NOT EXISTS push_subscriptions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint      TEXT NOT NULL UNIQUE,
    p256dh        TEXT NOT NULL,
    auth          TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_reports (
    id            SERIAL PRIMARY KEY,
    submitted_by  INTEGER NOT NULL REFERENCES users(id),
    category      feedback_category NOT NULL,
    message       TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_announcements (
    id            SERIAL PRIMARY KEY,
    created_by    INTEGER NOT NULL REFERENCES users(id),
    title         VARCHAR(150) NOT NULL,
    description   TEXT NOT NULL,
    target_roles  JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_announcement_ratings (
    id                SERIAL PRIMARY KEY,
    announcement_id   INTEGER NOT NULL REFERENCES feature_announcements(id) ON DELETE CASCADE,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stars             INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (announcement_id, user_id)
);


INSERT INTO roles (name) VALUES ('Sales'), ('Manager'), ('Instructor'), ('SuperAdmin'), ('Developer')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_sessions_instructor ON training_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON training_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_surveys_session ON surveys(session_id);
CREATE INDEX IF NOT EXISTS idx_attendees_session ON session_attendees(session_id);

CREATE INDEX IF NOT EXISTS idx_providers_active ON providers(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trainings_active ON trainings(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(id) WHERE deleted_at IS NULL;





ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_name_active ON providers(name) WHERE deleted_at IS NULL;



ALTER TABLE providers ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

ALTER TABLE trainings ADD COLUMN IF NOT EXISTS duration_unit training_duration_unit;

ALTER TABLE calendar ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

ALTER TABLE session_attendees ADD COLUMN IF NOT EXISTS attendance_status attendance_status NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_attendees_email ON session_attendees (LOWER(email));

UPDATE calendar
SET end_date = training_sessions.end_date
FROM training_sessions
WHERE calendar.session_id = training_sessions.id
  AND calendar.end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE reports ALTER COLUMN nps_average TYPE NUMERIC(5,2);

UPDATE training_sessions SET assignment_status = 'accepted' WHERE assignment_status = 'pending';

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_tour BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS include_weekends BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE audit_log ALTER COLUMN action TYPE VARCHAR(40);

ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_sessions_start_date ON training_sessions(start_date);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_submitted_by ON feedback_reports(submitted_by);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_created_at ON feedback_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_feature_announcements_created_at ON feature_announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_feature_announcement_ratings_announcement ON feature_announcement_ratings(announcement_id);
