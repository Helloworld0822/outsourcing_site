defmodule SiteBackend.Repo.Migrations.CreateFreelancerServicesAndOrders do
  use Ecto.Migration

  # init.sql may have already created the tables on a fresh volume, so
  # every step has to be idempotent. Ecto's `add`/`create table` helpers
  # don't expose IF NOT EXISTS uniformly, so we use raw SQL.
  def change do
    execute("""
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
    )
    """)

    execute("CREATE INDEX IF NOT EXISTS freelancer_services_freelancer_id_index ON freelancer_services (freelancer_id)")
    execute("CREATE INDEX IF NOT EXISTS freelancer_services_category_index ON freelancer_services (category)")
    execute("CREATE INDEX IF NOT EXISTS freelancer_services_is_active_index ON freelancer_services (is_active)")

    execute("""
    CREATE TABLE IF NOT EXISTS service_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id uuid NOT NULL REFERENCES freelancer_services(id) ON DELETE CASCADE,
      client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requirements text NOT NULL,
      status text NOT NULL DEFAULT 'requested',
      inserted_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
    """)

    execute("CREATE INDEX IF NOT EXISTS service_orders_service_id_index ON service_orders (service_id)")
    execute("CREATE INDEX IF NOT EXISTS service_orders_client_id_index ON service_orders (client_id)")
  end
end
