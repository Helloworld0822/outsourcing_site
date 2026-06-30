# Script for populating the database.
# Can be run with: mix run priv/repo/seeds.exs

# Start the Repo so it's available
{:ok, _} = SiteBackend.Repo.start_link()

import Ecto.Query
alias SiteBackend.Repo
alias SiteBackend.User
alias SiteBackend.FreelancerService
alias SiteBackend.UserProfile
alias SiteBackend.Project
alias SiteBackend.ProjectApplication

# ── Freelancer Users ──────────────────────────────────────────

{_ok, freelancer1} =
  case Repo.get_by(User, email: "taehyun@example.com") do
    nil ->
      %User{}
      |> User.registration_changeset(%{
        email: "taehyun@example.com",
        password: "secret123",
        name: "김태현",
        account_type: :freelancer
      })
      |> Repo.insert!()
    existing ->
      existing
  end

{_ok, freelancer2} =
  case Repo.get_by(User, email: "sujin@example.com") do
    nil ->
      %User{}
      |> User.registration_changeset(%{
        email: "sujin@example.com",
        password: "secret123",
        name: "이수진",
        account_type: :freelancer
      })
      |> Repo.insert!()
    existing ->
      existing
  end

{_ok, freelancer3} =
  case Repo.get_by(User, email: "jieun@example.com") do
    nil ->
      %User{}
      |> User.registration_changeset(%{
        email: "jieun@example.com",
        password: "secret123",
        name: "박지은",
        account_type: :freelancer
      })
      |> Repo.insert!()
    existing ->
      existing
  end

{_ok, freelancer4} =
  case Repo.get_by(User, email: "hyunwoo@example.com") do
    nil ->
      %User{}
      |> User.registration_changeset(%{
        email: "hyunwoo@example.com",
        password: "secret123",
        name: "최현우",
        account_type: :freelancer
      })
      |> Repo.insert!()
    existing ->
      existing
  end

{_ok, freelancer5} =
  case Repo.get_by(User, email: "sua@example.com") do
    nil ->
      %User{}
      |> User.registration_changeset(%{
        email: "sua@example.com",
        password: "secret123",
        name: "김수아",
        account_type: :freelancer
      })
      |> Repo.insert!()
    existing ->
      existing
  end

{_ok, freelancer6} =
  case Repo.get_by(User, email: "minseo@example.com") do
    nil ->
      %User{}
      |> User.registration_changeset(%{
        email: "minseo@example.com",
        password: "secret123",
        name: "정민서",
        account_type: :freelancer
      })
      |> Repo.insert!()
    existing ->
      existing
  end

# ── Client Users ──────────────────────────────────────────────

{_ok, _client1} =
  case Repo.get_by(User, email: "client1@example.com") do
    nil ->
      %User{}
      |> User.registration_changeset(%{
        email: "client1@example.com",
        password: "secret123",
        name: "홍길동",
        account_type: :client
      })
      |> Repo.insert!()
    existing ->
      existing
  end

{_ok, _client2} =
  case Repo.get_by(User, email: "client2@example.com") do
    nil ->
      %User{}
      |> User.registration_changeset(%{
        email: "client2@example.com",
        password: "secret123",
        name: "김철수",
        account_type: :client
      })
      |> Repo.insert!()
    existing ->
      existing
  end

# ── Freelancer Profiles ───────────────────────────────────────

profiles = [
  {freelancer1.id, "10년 경력의 풀스택 개발자입니다. React, Next.js, Node.js, PostgreSQL 기반의 확장 가능한 웹 애플리케이션을 구축합니다. 클린 코드와 테스트 주도의 개발을 지향합니다.",
   "서울", ["React", "Next.js", "TypeScript", "Node.js", "PostgreSQL", "AWS"]},
  {freelancer2.id, "Spring Boot와 Java 기반 백엔드 아키텍처 전문입니다. MSA, Microservices, Kubernetes 기반 배포 자동화에 풍부한 경험을 보유하고 있습니다.",
   "서울", ["Java", "Spring Boot", "Kotlin", "Docker", "Kubernetes", "PostgreSQL"]},
  {freelancer3.id, "UI/UX 디자이너로서 Figma 기반의 직관적이고 아름다운 인터페이스를 설계합니다. 프로토타입부터 디자인 시스템, 컴포넌트 라이브러리까지 전 과정 대응 가능합니다.",
   "부산", ["Figma", "Adobe XD", "Sketch", "Illustrator", "Photoshop"]},
  {freelancer4.id, "유튜브, 숏폼 영상 편집 전문 에디터입니다. Premiere Pro, After Effects, DaVinci Resolve를 활용한 색보정, 자막, 모션그래픽을 제공합니다.",
   "서울", ["Premiere Pro", "After Effects", "DaVinci Resolve", "Photoshop"]},
  {freelancer5.id, "영어, 일본어, 중국어 번역 및 글로벌 콘텐츠 현지화 전문가입니다. 기술 문서, 마케팅 카피, 웹사이트 번역 경험이 풍부합니다.",
   "인천", ["영어", "일본어", "중국어", "기술 번역", "현지화"]},
  {freelancer6.id, "Python 기반 자동화, 웹 크롤링, 데이터 파이프라인 개발 전문가입니다. Selenium, Scrapy, Pandas를 활용한 데이터 수집 및 분석을 제공합니다.",
   "서울", ["Python", "Selenium", "Scrapy", "Pandas", "FastAPI", "PostgreSQL"]},
]

for {user_id, bio, location, skills} <- profiles do
  case Repo.get_by(UserProfile, user_id: user_id) do
    nil ->
      %UserProfile{}
      |> UserProfile.changeset(%{
        user_id: user_id,
        bio: bio,
        location: location,
        skills: skills
      })
      |> Repo.insert!()
    _ ->
      :skip
  end
end

# ── Freelancer Services ───────────────────────────────────────

services = [
  {freelancer1, "React/Next.js 웹앱 개발", "반응형 웹 애플리케이션을 React와 Next.js로 개발합니다. SSR/SSG, 상태관리, API 연동까지 원스톱으로 처리합니다.", "development", ["React", "Next.js", "TypeScript", "Tailwind CSS"], "3000000", 14},
  {freelancer2, "스프링부트 백엔드 API 개발", "Java/Spring Boot 기반 REST API 서버를 설계하고 개발합니다. JWT 인증, DB 설계, 배포 자동화까지 지원합니다.", "development", ["Java", "Spring Boot", "MySQL", "Docker"], "4000000", 21},
  {freelancer3, "Figma UI/UX 디자인", "모바일/웹 앱의 UI/UX를 Figma로 설계합니다. 프로토타입, 디자인 시스템, 컴포넌트 라이브러리 제공 가능합니다.", "design", ["Figma", "Adobe XD", "Sketch"], "2000000", 10},
  {freelancer4, "유튜브 영상 편집", "유튜브/릴스/틱톡용 숏폼 및 롱폼 영상 편집 서비스를 제공합니다. 자막, 효과, 썸네일 포함.", "video", ["Premiere Pro", "After Effects", "DaVinci Resolve"], "500000", 5},
  {freelancer5, "영어-한국어 번역", "비즈니스 문서, 기술 문서, 마케팅 카피의 영한/한영 번역 서비스입니다. 전문 분야별 번역 가능합니다.", "translation", ["영어", "한국어", "비즈니스 문서"], "300000", 3},
  {freelancer6, "Python 자동화 스크립트", "반복 작업 자동화, 웹 크롤링, 데이터 파이프라인 등 Python 기반 자동화 스크립트를 개발합니다.", "development", ["Python", "Selenium", "Pandas", "BeautifulSoup"], "1500000", 7},
  {freelancer1, "Next.js 풀스택 웹 개발", "Next.js App Router 기반 풀스택 웹 애플리케이션 개발. 프론트엔드 + 백엔드 + 데이터베이스 일체형 프로젝트 가능합니다.", "development", ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "Vercel"], "5000000", 30},
  {freelancer2, "MSA 아키텍처 설계 및 구현", "마이크로서비스 아키텍처 설계부터 구현, Kubernetes 클러스터 배포까지 전체 흐름을 지원합니다.", "development", ["Java", "Spring Cloud", "Kubernetes", "Kafka", "Redis"], "8000000", 45},
  {freelancer3, "모바일 앱 UI 디자인", "iOS/Android 앱의 UI/UX를 Figma로 설계합니다. 네이티브 및 크로스플랫폼 앱 디자인 경험 있습니다.", "design", ["Figma", "Principle", "Protopie"], "2500000", 14},
  {freelancer3, "브랜드 아이덴티티 디자인", "로고, 색상 시스템, 타이포그래피를 포함한 브랜드 아이덴티티를 설계합니다.", "design", ["Illustrator", "Figma", "Photoshop"], "1800000", 10},
  {freelancer4, "모션그래픽 제작", "애니메이션 로고, 인트로/아웃트로, 광고용 모션그래픽을 After Effects로 제작합니다.", "video", ["After Effects", "Illustrator", "Premiere Pro"], "800000", 7},
  {freelancer5, "일본어 번역 및 현지화", "일본어-한국어 번역 및 웹사이트/앱 일본어 현지화 서비스를 제공합니다.", "translation", ["일본어", "한국어", "HTML", "JavaScript"], "400000", 5},
  {freelancer6, "AI/LLM 기반 챗봇 개발", "OpenAI API를 활용한 커스텀 AI 챗봇 개발. 프롬프트 엔지니어링부터 벡터DB 연동까지.", "development", ["Python", "LangChain", "OpenAI", "FastAPI", "Pinecone"], "3500000", 14},
  {freelancer1, "React Native 모바일 앱 개발", "React Native를 활용한 iOS/Android 크로스플랫폼 모바일 앱을 개발합니다.", "development", ["React Native", "TypeScript", "Expo", "Firebase"], "4500000", 30},
  {freelancer2, "DevOps/CI-CD 파이프라인 구축", "GitHub Actions, Jenkins 기반 CI/CD 파이프라인 구축 및 Kubernetes 클러스터 관리.", "development", ["Docker", "Kubernetes", "GitHub Actions", "AWS", "Terraform"], "3000000", 14},
]

for {freelancer, title, description, category, skills, price, delivery_days} <- services do
  # Check if service already exists to avoid duplicates on re-run
  existing = Repo.all(from s in FreelancerService, where: s.freelancer_id == ^freelancer.id and s.title == ^title)

  if length(existing) == 0 do
    %FreelancerService{}
    |> FreelancerService.changeset(%{
      freelancer_id: freelancer.id,
      title: title,
      description: description,
      category: category,
      skills: skills,
      price: price,
      delivery_days: delivery_days,
      is_active: true
    })
    |> Repo.insert!()
  end
end

IO.puts("Seeds inserted successfully!")
IO.puts("Freelancers: 6, Clients: 2, Services: #{length(services)}")

# ── Sample Projects ───────────────────────────────────────────

client1 = Repo.get_by!(User, email: "client1@example.com")

sample_project =
  case Repo.get_by(Project, title: "모바일 앱 UI/UX + React Native 개발") do
    nil ->
      %Project{}
      |> Project.changeset(%{
        title: "모바일 앱 UI/UX + React Native 개발",
        description: "배달 서비스 앱을 디자인부터 개발까지 진행합니다. 디자이너 1명, React Native 개발자 1명을 모집합니다.",
        skills: ["Figma", "React Native", "TypeScript"],
        budget: "12,000,000원",
        client_name: client1.name,
        client_id: client1.id,
        status: :recruiting
      })
      |> Repo.insert!()

    existing ->
      existing
  end

for {freelancer, message, role, source, status} <- [
      {freelancer3, "UI/UX 디자인 4년 경력입니다. Figma 기반 디자인 시스템 구축 경험이 있습니다.", "designer", :apply, :pending},
      {freelancer1, "React Native로 배달앱을 2건 개발한 경험이 있습니다.", "developer", :apply, :pending},
      {freelancer6, "풀스택으로 MVP 개발도 가능합니다.", "developer", :invite, :pending}
    ] do
  case Repo.get_by(ProjectApplication, project_id: sample_project.id, freelancer_id: freelancer.id) do
    nil ->
      %ProjectApplication{}
      |> ProjectApplication.changeset(%{
        project_id: sample_project.id,
        freelancer_id: freelancer.id,
        message: message,
        proposed_role: role,
        source: source,
        status: status
      })
      |> Repo.insert!()

    _ ->
      :skip
  end
end

IO.puts("Sample project: #{sample_project.title} (#{sample_project.id})")