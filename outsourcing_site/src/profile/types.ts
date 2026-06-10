export type PortfolioItem = {
  id: string
  title: string
  description: string
  url?: string
  image_url?: string
}

export type UserProfile = {
  id: string | null
  user_id: string
  bio: string | null
  avatar_url: string | null
  location: string | null
  website_url: string | null
  github_url: string | null
  skills: string[]
  hourly_rate: string | null
  experience_years: number | null
  portfolio_items: PortfolioItem[]
  is_public: boolean
  inserted_at: string | null
  updated_at: string | null
  user: {
    id: string
    name: string
    email: string
    account_type: 'client' | 'freelancer'
  } | null
}

export type ProfileUpdatePayload = {
  bio?: string
  avatar_url?: string
  location?: string
  website_url?: string
  github_url?: string
  skills?: string[]
  hourly_rate?: string
  experience_years?: number | null
  portfolio_items?: PortfolioItem[]
  is_public?: boolean
}
