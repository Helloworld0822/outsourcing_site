defmodule SiteBackend.Repo.Migrations.AddProjectOwnershipAndApplications do
  use Ecto.Migration

  # init.sql may have already created `project_applications` and the
  # `client_id` column on `projects`, so every step here has to be
  # idempotent. Ecto's `add`/`create table` helpers don't expose
  # IF NOT EXISTS uniformly, so we use raw SQL.
  def change do
    execute("""
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES users(id) ON DELETE CASCADE
    """)

    execute("CREATE INDEX IF NOT EXISTS projects_client_id_index ON projects (client_id)")

    execute("""
    CREATE TABLE IF NOT EXISTS project_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      freelancer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      inserted_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
    """)

    execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS project_applications_project_id_freelancer_id_index
      ON project_applications (project_id, freelancer_id)
    """)

    execute("CREATE INDEX IF NOT EXISTS project_applications_project_id_index ON project_applications (project_id)")
    execute("CREATE INDEX IF NOT EXISTS project_applications_freelancer_id_index ON project_applications (freelancer_id)")
  end
end
