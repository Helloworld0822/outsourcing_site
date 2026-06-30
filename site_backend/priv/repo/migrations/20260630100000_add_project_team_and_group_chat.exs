defmodule SiteBackend.Repo.Migrations.AddProjectTeamAndGroupChat do
  use Ecto.Migration

  def change do
    execute("""
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'recruiting'
    """)

    execute("""
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS group_chat_room_id uuid REFERENCES chat_rooms(id) ON DELETE SET NULL
    """)

    execute("""
    ALTER TABLE project_applications
      ADD COLUMN IF NOT EXISTS proposed_role text
    """)

    execute("""
    ALTER TABLE project_applications
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'apply'
    """)

    execute("""
    CREATE TABLE IF NOT EXISTS project_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL,
      application_id uuid REFERENCES project_applications(id) ON DELETE SET NULL,
      joined_at timestamp NOT NULL DEFAULT now(),
      inserted_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
    """)

    execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS project_members_project_id_user_id_index
      ON project_members (project_id, user_id)
    """)

    execute("CREATE INDEX IF NOT EXISTS project_members_project_id_index ON project_members (project_id)")
    execute("CREATE INDEX IF NOT EXISTS project_members_user_id_index ON project_members (user_id)")

    execute("""
    ALTER TABLE chat_rooms
      ADD COLUMN IF NOT EXISTS room_type text NOT NULL DEFAULT 'direct'
    """)

    execute("""
    ALTER TABLE chat_rooms
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL
    """)

    execute("""
    ALTER TABLE chat_rooms
      ADD COLUMN IF NOT EXISTS name text
    """)

    execute("ALTER TABLE chat_rooms ALTER COLUMN client_id DROP NOT NULL")
    execute("ALTER TABLE chat_rooms ALTER COLUMN freelancer_id DROP NOT NULL")

    execute("""
    CREATE TABLE IF NOT EXISTS chat_room_participants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      inserted_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
    """)

    execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS chat_room_participants_room_user_index
      ON chat_room_participants (chat_room_id, user_id)
    """)

    execute("CREATE INDEX IF NOT EXISTS chat_room_participants_chat_room_id_index ON chat_room_participants (chat_room_id)")
    execute("CREATE INDEX IF NOT EXISTS chat_room_participants_user_id_index ON chat_room_participants (user_id)")
    execute("CREATE INDEX IF NOT EXISTS chat_rooms_project_id_index ON chat_rooms (project_id)")
  end
end
