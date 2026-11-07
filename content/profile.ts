// Everything the site says lives here. The 3D room and the plain (lo-fi) page both read from this file,
// so editing it updates both. Wording is kept close to the CV.

export type Job = {
  id: string;
  /** what goes on the sticky note */
  title: string;
  /** employer, when the note's title is a client or product */
  org?: string;
  role: string;
  /** short year range for notes and lists */
  years: string;
  /** exact dates from the CV */
  dates: string;
  blurb: string;
  highlights: string[];
  tech: string[];
  team?: number;
  /** sticky-note colour */
  note: string;
};

export type Build = {
  id: string;
  title: string;
  at: string;
  years: string;
  blurb: string;
  tech: string[];
};

export type Skill = {
  name: string;
  /** other spellings to look for in a job's tech list ("Kubernetes" also matches "GKE") */
  aliases?: string[];
};

export type SkillGroup = { label: string; skills: Skill[] };

export type Link = { label: string; value: string; href: string };

export const profile = {
  name: "Dao Minh Nhat",
  short: "Nhat",
  role: "Forward Deployed Engineer",
  location: "Ho Chi Minh City, Vietnam",
  timeZone: "Asia/Ho_Chi_Minh",
  hello: "Hi, I'm Nhat.",
  dek: "Forward deployed engineer in Saigon. Founding engineer at AusyncLab, where we build AI voices for the web: text-to-speech, voice cloning and lip-sync.",
  about: [
    "Software engineer with 6+ years of experience building web applications, backend services and cloud-based systems.",
    "I work across frontend architecture, backend development, payment integrations, database migrations and cloud infrastructure, mostly in TypeScript, Python, Go and Rust.",
    "Two years of frontend leadership: architecture decisions, code reviews and mentoring. I like Clean Architecture, Domain-Driven Design and microservices, with a focus on maintainable software and reliable delivery.",
    "I use AI-assisted tools like Claude Code and Cursor for design, implementation and testing.",
  ],
  education: {
    school: "National University of Science, Ho Chi Minh City",
    degree: "Bachelor's Degree in Information Technology",
    years: "2015–2019",
    note: "GPA 8.0 / 10",
  },
};

export const jobs: Job[] = [
  {
    id: "ausynclab",
    title: "AusyncLab",
    org: "Ausync AI",
    role: "Lead Frontend Engineer / Founding Engineer",
    years: "2023–now",
    dates: "Jun 2023 – Present",
    blurb: "An early-stage startup building an AI text-to-speech platform with voice cloning, lip-sync and web-based content generation. Five people, so the work spans frontend, backend, payments and cloud.",
    highlights: [
      "Led frontend architecture and technology decisions; built the web app with React, Next.js, NextAuth and Tailwind CSS.",
      "Built backend services in Python and FastAPI, with PostgreSQL and Redis.",
      "Built the payment service: ZaloPay orders and callbacks, bank-transfer webhooks, subscription activation and Discord notifications.",
      "Helped migrate the payment, voice and event-broker services from Python to Rust (Axum, Tiberius).",
      "Helped migrate from Azure SQL Server to PostgreSQL 16: schema changes, bulk-load tooling and service cutover.",
      "Deploys to Google Kubernetes Engine through GitHub Actions pipelines with automated quality gates.",
    ],
    tech: ["TypeScript", "React", "Next.js", "Python", "FastAPI", "Rust", "Axum", "PostgreSQL", "Redis", "AWS", "Azure", "Google Cloud", "GKE", "Docker", "GitHub Actions"],
    team: 5,
    note: "#ffd84d",
  },
  {
    id: "one",
    title: "ONE",
    org: "CyberLogitec",
    role: "Engineer, Marine Operations Management",
    years: "2024–2026",
    dates: "Feb 2024 – Apr 2026",
    blurb: "Marine operations software for shipping lines: vessel schedule planning, and ship data for service agreements with terminal vendors.",
    highlights: [
      "Designed and built application modules with Domain-Driven Design and Clean Architecture.",
      "Built backend services with NestJS, gRPC and GraphQL, on TypeORM, PostgreSQL and Redis.",
      "Worked across teams to unblock technical problems and improve the system design.",
      "Reviewed code and mentored junior engineers.",
      "Shipped in an Agile/Scrum workflow with a focus on reliability and few defects.",
    ],
    tech: ["TypeScript", "React", "Next.js", "NestJS", "GraphQL", "gRPC", "TypeORM", "PostgreSQL", "Redis", "Docker", "Google Cloud", "GitHub Actions"],
    team: 20,
    note: "#ff9fb8",
  },
  {
    id: "fmg",
    title: "FMG",
    org: "Saigon Technology",
    role: "Engineer",
    years: "2022–2023",
    dates: "Jan 2022 – Dec 2023",
    blurb: "Rebuilding a legacy .NET content management system as a React and Next.js platform.",
    highlights: [
      "Migrated legacy frontend features to a React and Next.js architecture.",
      "Restructured the frontend codebase around shared coding standards.",
      "Added unit and integration tests, and fixed a lot of bugs along the way.",
      "Built and maintained components with TypeScript, Material UI and styled-components.",
    ],
    tech: ["TypeScript", "React", "Next.js", "Material UI", "styled-components", "Jest", "ESLint", "esbuild"],
    team: 12,
    note: "#9fe3b5",
  },
  {
    id: "modmo",
    title: "MODMO",
    org: "Saigon Technology",
    role: "Engineer",
    years: "2020–2021",
    dates: "Sep 2020 – Dec 2021",
    blurb: "A smart biking platform for ride tracking, routes and performance analytics, talking to connected e-bikes.",
    highlights: [
      "Built endpoints for route tracking, leaderboards and reporting with Node.js, Express, TypeScript, MongoDB and Mongoose.",
      "Deployed backend and frontend on AWS with Docker and Elastic Beanstalk, using S3 and CloudWatch.",
      "Integrated MQTT messaging with the connected e-bikes.",
    ],
    tech: ["Node.js", "Express", "TypeScript", "MongoDB", "Mongoose", "AWS", "Docker", "Elastic Beanstalk", "S3", "CloudWatch", "MQTT", "REST APIs"],
    team: 5,
    note: "#8fd3ff",
  },
  {
    id: "weva",
    title: "Weva",
    org: "Cititech",
    role: "Engineer",
    years: "2018–2020",
    dates: "Sep 2018 – Aug 2020",
    blurb: "An e-commerce ecosystem across web and mobile, with chat, payment and booking services.",
    highlights: [
      "Delivered features end to end, across frontend apps and backend services.",
      "Designed PostgreSQL schemas and built a Go payment service following Clean Architecture.",
      "Made chat faster with Redis caching and Socket.IO.",
      "Built frontend features with React, Redux, Ant Design and styled-components.",
    ],
    tech: ["React", "Redux", "Ant Design", "Node.js", "Go", "gRPC", "REST APIs", "PostgreSQL", "MongoDB", "Redis", "Socket.IO", "TypeORM", "Webpack", "Babel"],
    team: 15,
    note: "#ffb36b",
  },
];

// Pieces of work worth their own index card. All of them come from the CV's bullets.
export const builds: Build[] = [
  {
    id: "payments",
    title: "Payment service",
    at: "AusyncLab",
    years: "2023–now",
    blurb: "ZaloPay orders and callbacks, bank-transfer webhooks, subscription activation and Discord notifications, in one service.",
    tech: ["Python", "FastAPI", "Rust", "PostgreSQL", "Redis"],
  },
  {
    id: "rust",
    title: "Python → Rust",
    at: "AusyncLab",
    years: "2023–now",
    blurb: "Helped move the payment, voice and event-broker services from Python to Rust, with Axum and Tiberius.",
    tech: ["Rust", "Axum", "Python"],
  },
  {
    id: "postgres",
    title: "Azure SQL → PostgreSQL 16",
    at: "AusyncLab",
    years: "2023–now",
    blurb: "Helped migrate the database: schema changes, bulk-load tooling and the service cutover.",
    tech: ["PostgreSQL", "SQL Server", "Azure"],
  },
  {
    id: "gke",
    title: "Shipping to GKE",
    at: "AusyncLab",
    years: "2023–now",
    blurb: "Services deploy to Google Kubernetes Engine through GitHub Actions pipelines with automated quality gates.",
    tech: ["GKE", "Docker", "GitHub Actions", "Google Cloud"],
  },
];

export const skillGroups: SkillGroup[] = [
  {
    label: "Languages",
    skills: [{ name: "TypeScript" }, { name: "JavaScript" }, { name: "Python" }, { name: "Go" }, { name: "Rust", aliases: ["Axum"] }],
  },
  {
    label: "Frontend",
    skills: [{ name: "React" }, { name: "Next.js" }, { name: "Redux" }, { name: "Tailwind CSS" }, { name: "Material UI" }, { name: "styled-components" }],
  },
  {
    label: "Backend",
    skills: [{ name: "Node.js" }, { name: "NestJS" }, { name: "Express" }, { name: "FastAPI" }, { name: "Axum" }, { name: "GraphQL" }, { name: "gRPC" }, { name: "REST APIs" }],
  },
  {
    label: "Data & caching",
    skills: [{ name: "PostgreSQL" }, { name: "MongoDB", aliases: ["Mongoose"] }, { name: "Redis" }, { name: "SQL Server" }],
  },
  {
    label: "Cloud & infrastructure",
    skills: [
      { name: "AWS", aliases: ["Elastic Beanstalk", "S3", "CloudWatch"] },
      { name: "Azure" },
      { name: "Google Cloud" },
      { name: "Kubernetes", aliases: ["GKE"] },
      { name: "Docker" },
      { name: "Cloudflare Workers" },
    ],
  },
  {
    label: "Messaging",
    skills: [{ name: "Azure Service Bus" }, { name: "RabbitMQ" }, { name: "MQTT" }, { name: "Socket.IO" }],
  },
  {
    label: "Delivery & testing",
    skills: [{ name: "GitHub Actions" }, { name: "Jest" }, { name: "CI/CD" }],
  },
  {
    label: "Architecture",
    skills: [{ name: "Clean Architecture" }, { name: "Domain-Driven Design" }, { name: "Microservices" }],
  },
  {
    label: "AI tools",
    skills: [{ name: "Claude Code" }, { name: "Cursor" }],
  },
];

// TODO: add your LinkedIn URL. Links without an href are left out everywhere.
export const links: Link[] = [
  { label: "Email", value: "m.nhatdao.us@gmail.com", href: "mailto:m.nhatdao.us@gmail.com" },
  { label: "GitHub", value: "github.com/mnhatdaous", href: "https://github.com/mnhatdaous" },
  { label: "LinkedIn", value: "", href: "" },
];

export const liveLinks = () => links.filter((l) => l.href);

/** where a skill was used: its name (or an alias) in a job's tech list, or written in that job's description */
export function usedAt(skill: Skill): Job[] {
  const names = [skill.name, ...(skill.aliases ?? [])].map((n) => n.toLowerCase());
  return jobs.filter(
    (j) =>
      j.tech.some((t) => names.includes(t.toLowerCase())) ||
      [j.blurb, ...j.highlights].some((text) => names.some((n) => text.toLowerCase().includes(n))),
  );
}

export const allSkills = skillGroups.flatMap((g) => g.skills.map((s) => ({ ...s, group: g.label })));
