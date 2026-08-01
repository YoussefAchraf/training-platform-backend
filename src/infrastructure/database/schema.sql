



CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected', 'deactivated');
CREATE TYPE session_status AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled');
CREATE TYPE assignment_status AS ENUM ('unassigned', 'pending', 'accepted', 'refused');

CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE users (
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

CREATE TABLE providers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE trainings (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    description TEXT,
    duration    INTEGER,
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE clients (
    id            SERIAL PRIMARY KEY,
    company_name  VARCHAR(150) NOT NULL,
    email         VARCHAR(150),
    phone         VARCHAR(30),
    created_by    INTEGER REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

CREATE TABLE instructors (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE instructor_skills (
    instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
    training_id   INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    PRIMARY KEY (instructor_id, training_id)
);

CREATE TABLE training_sessions (
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

CREATE TABLE session_attendees (
    id                  SERIAL PRIMARY KEY,
    session_id          INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    name                VARCHAR(150) NOT NULL,
    email               VARCHAR(150),
    survey_submitted    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE calendar (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    event_date  TIMESTAMPTZ NOT NULL,
    title       VARCHAR(200) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE surveys (
    id                  SERIAL PRIMARY KEY,
    session_id          INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    instructor_id       INTEGER NOT NULL REFERENCES instructors(id),
    attendee_id         INTEGER REFERENCES session_attendees(id),
    instructor_score    INTEGER NOT NULL CHECK (instructor_score BETWEEN 0 AND 5),
    nps_score           INTEGER NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
    comments            TEXT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reports (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER UNIQUE NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    pdf_url         VARCHAR(255),
    average_score   NUMERIC(4,2),
    nps_average     NUMERIC(4,2),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id            SERIAL PRIMARY KEY,
    actor_id      INTEGER REFERENCES users(id),
    action        VARCHAR(20) NOT NULL,
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     INTEGER NOT NULL,
    before        JSONB,
    after         JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


INSERT INTO roles (name) VALUES ('Sales'), ('Manager'), ('Instructor');

CREATE INDEX idx_sessions_instructor ON training_sessions(instructor_id);
CREATE INDEX idx_sessions_status ON training_sessions(session_status);
CREATE INDEX idx_surveys_session ON surveys(session_id);
CREATE INDEX idx_attendees_session ON session_attendees(session_id);

CREATE INDEX idx_providers_active ON providers(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trainings_active ON trainings(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_active ON clients(id) WHERE deleted_at IS NULL;

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
