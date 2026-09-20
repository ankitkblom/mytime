CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  parent_id INT REFERENCES departments(id) ON DELETE RESTRICT,
  UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  emp_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL CHECK (email = lower(email)),
  department_id INT REFERENCES departments(id),
  designation TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','admin')),
  password_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_logins INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- work categories with sub-categories (e.g. Technical-CS -> DPR)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INT REFERENCES categories(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department_id INT REFERENCES departments(id),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- one row per user per day: the unit that gets reviewed
CREATE TABLE IF NOT EXISTS day_sheets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  work_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  reviewer_id INT REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  UNIQUE (user_id, work_date)
);

-- slot_index 0 = 09:30-10:00 ... 18 = 18:30-19:00
CREATE TABLE IF NOT EXISTS slot_entries (
  day_sheet_id INT NOT NULL REFERENCES day_sheets(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index BETWEEN 0 AND 18),
  project_id INT NOT NULL REFERENCES projects(id),
  category_id INT REFERENCES categories(id),
  subcategory_id INT REFERENCES categories(id),
  description TEXT,
  PRIMARY KEY (day_sheet_id, slot_index)
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id INT REFERENCES users(id),
  action TEXT NOT NULL,
  detail JSONB
);
CREATE INDEX IF NOT EXISTS idx_day_sheets_reviewer ON day_sheets(reviewer_id, status);
CREATE INDEX IF NOT EXISTS idx_day_sheets_user_date ON day_sheets(user_id, work_date);

-- projects belong to a category (and optionally a sub-category)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category_id INT REFERENCES categories(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS subcategory_id INT REFERENCES categories(id);
