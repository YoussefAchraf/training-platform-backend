













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
    action        VARCHAR(20) NOT NULL,
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


INSERT INTO roles (name) VALUES ('Sales'), ('Manager'), ('Instructor'), ('SuperAdmin')
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

UPDATE calendar
SET end_date = training_sessions.end_date
FROM training_sessions
WHERE calendar.session_id = training_sessions.id
  AND calendar.end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE reports ALTER COLUMN nps_average TYPE NUMERIC(5,2);
