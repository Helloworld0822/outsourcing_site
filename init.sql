CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  name text,
  account_type text NOT NULL DEFAULT 'client',
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamp,
  email_verified boolean NOT NULL DEFAULT false,
  email_verification_token text,
  email_verification_sent_at timestamp,
  refresh_token_hash text,
  refresh_token_expires_at timestamp,
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_index ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_verification_token_index
  ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_refresh_token_hash_index
  ON users (refresh_token_hash)
  WHERE refresh_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  skills text[] NOT NULL DEFAULT ARRAY[]::text[],
  budget text,
  client_name text,
  client_id uuid REFERENCES users(id) ON DELETE CASCADE,
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address text,
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logins_user_id_index ON logins (user_id);

CREATE TABLE IF NOT EXISTS project_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_applications_project_id_freelancer_id_index
  ON project_applications (project_id, freelancer_id);

CREATE INDEX IF NOT EXISTS project_applications_project_id_index ON project_applications (project_id);
CREATE INDEX IF NOT EXISTS project_applications_freelancer_id_index ON project_applications (freelancer_id);

CREATE TABLE IF NOT EXISTS freelancer_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  skills text[] NOT NULL DEFAULT ARRAY[]::text[],
  price text NOT NULL,
  delivery_days integer NOT NULL DEFAULT 7,
  thumbnail_url text,
  is_active boolean NOT NULL DEFAULT true,
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS freelancer_services_freelancer_id_index ON freelancer_services (freelancer_id);
CREATE INDEX IF NOT EXISTS freelancer_services_category_index ON freelancer_services (category);
CREATE INDEX IF NOT EXISTS freelancer_services_is_active_index ON freelancer_services (is_active);

CREATE TABLE IF NOT EXISTS service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES freelancer_services(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requirements text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_orders_service_id_index ON service_orders (service_id);
CREATE INDEX IF NOT EXISTS service_orders_client_id_index ON service_orders (client_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  ref_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_index ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_index ON notifications (is_read);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_order_id uuid REFERENCES service_orders(id) ON DELETE SET NULL,
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_rooms_client_id_index ON chat_rooms (client_id);
CREATE INDEX IF NOT EXISTS chat_rooms_freelancer_id_index ON chat_rooms (freelancer_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  inserted_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_room_id_index ON chat_messages (chat_room_id);
CREATE INDEX IF NOT EXISTS chat_messages_sender_id_index ON chat_messages (sender_id);
