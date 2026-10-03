// The 100-day program as data. `course` values match courses.slug in the database.

export const TOTAL_DAYS = 100;

export const MONTHS = [
  { name: 'Month 1: Foundations', from: 1, to: 28 },
  { name: 'Month 2: Core tools', from: 29, to: 63 },
  { name: 'Month 3: Cloud, streaming, job readiness', from: 64, to: 100 },
];

const WEEKS = [
  {
    week: 1, title: 'SQL',
    blocks: [{ from: 1, to: 6, focus: 'SQL: joins, CTEs, window functions, indexes', course: 'sql-bootcamp' }],
    share: { day: 7, repo: 'sql-practice', post: 'Post 1: Starting my data engineering journey',
      tasks: ['GitHub: create sql-practice repo with your solved queries, organized by topic', 'LinkedIn: publish Post 1 (starting the journey)'] },
  },
  {
    week: 2, title: 'SQL + Python',
    blocks: [
      { from: 8, to: 9, focus: 'Finish SQL: query optimization, practice sets', course: 'sql-bootcamp' },
      { from: 10, to: 13, focus: 'Python for data: APIs, JSON/Parquet, pandas, pytest', course: 'python-data-eng' },
    ],
    share: { day: 14, repo: 'python-etl-scripts', post: 'Post 2: 3 SQL window functions I use constantly',
      tasks: ['GitHub: create python-etl-scripts with an API-to-CSV/Parquet script and tests', 'LinkedIn: publish Post 2 (SQL window functions)'] },
  },
  {
    week: 3, title: 'Linux, Git, Docker',
    blocks: [
      { from: 15, to: 16, focus: 'Linux command line and bash', course: 'linux-mastery' },
      { from: 17, to: 17, focus: 'Git: branches, merges, pull requests', course: 'git-complete' },
      { from: 18, to: 20, focus: 'Docker: images, containers, docker compose', course: 'docker-mastery' },
    ],
    share: { day: 21, repo: 'python-etl-scripts (dockerized)', post: 'Post 3: Why data engineers use Docker',
      tasks: ['GitHub: dockerize your Python ETL script (Dockerfile + docker-compose.yml with Postgres)', 'LinkedIn: publish Post 3 (Docker for data engineers)'] },
  },
  {
    week: 4, title: 'Data modeling + Snowflake',
    blocks: [{ from: 22, to: 27, focus: 'Star schemas, facts and dimensions, SCDs, Snowflake', course: 'snowflake' }],
    share: { day: 28, repo: 'data-modeling', post: 'Post 4: Star schema explained simply',
      tasks: ['GitHub: create data-modeling repo with a star schema design (diagram + SQL DDL) for e-commerce data', 'LinkedIn: publish Post 4; update headline to "Aspiring Data Engineer"'] },
  },
  {
    week: 5, title: 'Mini project 1 + dbt start',
    blocks: [
      { from: 29, to: 31, focus: 'Mini project 1: Python ingests a public dataset into Postgres in Docker, modeled as a star schema', project: true },
      { from: 32, to: 34, focus: 'dbt: models, sources, seeds', course: 'dbt-bootcamp' },
    ],
    share: { day: 35, repo: 'project-1-ingestion-pipeline', post: 'Post 5: Project 1 showcase',
      tasks: ['GitHub: publish project-1-ingestion-pipeline with architecture diagram and README', 'LinkedIn: publish Post 5; rewrite your About section'] },
  },
  {
    week: 6, title: 'dbt + Airflow start',
    blocks: [
      { from: 36, to: 40, focus: 'dbt: tests, snapshots, macros, docs, incremental models', course: 'dbt-bootcamp' },
      { from: 41, to: 41, focus: 'Airflow: architecture and first DAG', course: 'airflow' },
    ],
    share: { day: 42, repo: 'dbt-analytics', post: 'Post 6: What dbt is and why teams love it',
      tasks: ["GitHub: add a dbt project on top of Project 1's data (dbt-analytics), with tests and generated docs", 'LinkedIn: publish Post 6 (what dbt is and why it matters)'] },
  },
  {
    week: 7, title: 'Airflow',
    blocks: [{ from: 43, to: 48, focus: "DAGs, operators, sensors, XComs, scheduling, the course's stock market project", course: 'airflow' }],
    share: { day: 49, repo: 'airflow-stock-pipeline', post: 'Post 7: My first Airflow DAG',
      tasks: ['GitHub: push airflow-stock-pipeline (rebuilt in your own words with your own README)', 'LinkedIn: publish Post 7 (my first Airflow DAG)'] },
  },
  {
    week: 8, title: 'Spark',
    blocks: [{ from: 50, to: 55, focus: 'PySpark DataFrames, Spark SQL, partitioning, performance', course: 'spark' }],
    share: { day: 56, repo: 'pyspark-exercises', post: 'Post 8: pandas vs Spark: when to switch',
      tasks: ['GitHub: push pyspark-exercises with a large-dataset processing example', 'LinkedIn: publish Post 8 (pandas vs Spark)'] },
  },
  {
    week: 9, title: 'Spark + Mini project 2',
    blocks: [
      { from: 57, to: 58, focus: 'Finish Spark', course: 'spark' },
      { from: 59, to: 62, focus: 'Mini project 2: Airflow orchestrates a Spark job and dbt models on marketing data', project: true },
    ],
    share: { day: 63, repo: 'project-2-orchestrated-pipeline', post: 'Post 9: Project 2 showcase',
      tasks: ['GitHub: publish project-2-orchestrated-pipeline; pin Projects 1 and 2', 'LinkedIn: publish Post 9; add both projects to Featured'] },
  },
  {
    week: 10, title: 'AWS',
    blocks: [{ from: 64, to: 69, focus: 'S3, Glue, Athena, Redshift, Kinesis, IAM, Lambda', course: 'aws-dea' }],
    share: { day: 70, repo: 'aws-data-lake-demo', post: 'Post 10: The AWS services every data engineer uses',
      tasks: ['GitHub: push aws-data-lake-demo (S3 raw/clean zones + Glue + Athena queries)', 'LinkedIn: publish Post 10'] },
  },
  {
    week: 11, title: 'AWS + Kafka',
    blocks: [
      { from: 71, to: 72, focus: 'Finish AWS, practice exam; book the exam', course: 'aws-dea' },
      { from: 73, to: 76, focus: 'Kafka: topics, producers, consumers, streaming basics', course: 'kafka' },
    ],
    share: { day: 77, repo: 'kafka-streaming-demo', post: 'Post 11: Batch vs streaming, explained',
      tasks: ['GitHub: push kafka-streaming-demo (producer of fake click events, consumer writing to Postgres)', 'LinkedIn: publish Post 11 (batch vs streaming)'] },
  },
  {
    week: 12, title: 'Databricks + Terraform + CI/CD',
    blocks: [
      { from: 78, to: 81, focus: 'Databricks, Delta Lake, medallion architecture', course: 'databricks' },
      { from: 82, to: 82, focus: 'Terraform core sections', course: 'terraform' },
      { from: 83, to: 83, focus: 'CI/CD with GitHub Actions', course: 'github-actions' },
    ],
    share: { day: 84, repo: 'databricks-medallion', post: 'Post 12: Medallion architecture: bronze, silver, gold',
      tasks: ['GitHub: push databricks-medallion and add a GitHub Actions workflow that runs tests on an earlier repo', 'LinkedIn: publish Post 12'] },
  },
  {
    week: 13, title: 'Final project: build',
    blocks: [{ from: 85, to: 90, focus: 'Final project: API → Airflow → S3 → Snowflake → dbt → dashboard, Terraform infra, GitHub Actions CI', project: true }],
    share: { day: 91, repo: 'final project (work in progress)', post: 'Post 13: Building my final project: the architecture',
      tasks: ['GitHub: push the final project so far, with the architecture diagram in the README', 'LinkedIn: publish Post 13 (architecture and tool choices of the final project)'] },
  },
  {
    week: 14, title: 'Final project polish, interview prep, job readiness',
    blocks: [
      { from: 92, to: 94, focus: 'Final project polish: data quality tests (dbt tests), monitoring and alerts, documentation, dashboard', project: true },
      {
        from: 95, to: 96, focus: 'Interview prep: SQL and Python problems, data modeling and pipeline design questions', type: 'prep',
        tasks: ['3h: SQL interview problems (DataLemur / StrataScratch, medium and hard)', '2h: Python data problems and pipeline design questions', '1h: pitch each project in 2 minutes, in French and in English'],
      },
      {
        from: 97, to: 97, focus: 'Mock interview, your stories, and the Paris target list', type: 'prep',
        tasks: [
          '2h: a mock technical interview, in French (most Paris interviews are), recorded or with a friend',
          '1h: write 5 STAR stories (a bug you fixed, a design choice, a deadline...)',
          '2h: build a list of 30 Paris targets: companies hiring data engineers in alternance or junior roles, plus schools with a data engineering alternance track',
          '1h: set job alerts on Welcome to the Jungle, LinkedIn Jobs, Indeed, HelloWork and La bonne alternance (Paris / Île-de-France)',
        ],
      },
    ],
  },
];

const SPECIAL_DAYS = {
  98: {
    type: 'share', focus: 'Build & Share: GitHub collaboration day', repo: 'final project + profile README',
    tasks: [
      'Push the final project with a full README, architecture diagram and dashboard screenshots',
      'Practice the team workflow: feature branch, pull request, self-review, merge',
      'Open your first pull request on a data project "good first issue" (even a docs fix)',
      'Create your profile README and pin your 6 best repos',
      'Add descriptions and topic tags to every repo',
    ],
  },
  99: {
    type: 'share', focus: 'LinkedIn profile day', post: 'Post 14: Final project + 100 days recap', repo: 'final project',
    tasks: [
      'Headline: "Aspiring Data Engineer | SQL · Python · dbt · Airflow · Spark · AWS | MSc AI | Alternance or junior role · Paris"',
      'About: AI background, why data engineering, what you built, what you are looking for (alternance or junior, Paris), in French and English',
      'Featured: final project, Projects 1 and 2, AWS certificate',
      'Skills and Licenses: every tool learned, Udemy certificates',
      'Turn on Open to Work: Data Engineer, alternance and junior (CDI), Paris / Île-de-France and remote',
      'Publish Post 14 (final project showcase + 100 days recap)',
    ],
  },
  100: {
    type: 'milestone', focus: 'Apply: alternance and junior roles in Paris',
    tasks: [
      'Finalize a one-page CV in French (and an English version): projects with GitHub links first, then skills, MSc AI',
      'Apply to your first 10 alternance positions (company + school track) and 10 junior data engineer roles in Paris',
      'Keep a tracker of every application (company, role, date, contact, next step)',
      'Keep posting weekly and practicing SQL interview questions while you apply',
    ],
  },
};

const STUDY_TASKS = [
  '4h: Udemy course (1.25x, skip what you know)',
  '1.5h: hands-on practice',
  '30min: SQL practice (DataLemur / StrataScratch)',
];
const SHARE_ROUTINE = [
  '2h: review the week\'s notes',
  '2h: clean code, write README, push to GitHub',
  '1h: write and publish the LinkedIn post',
  '1h: networking (comment on 5 posts, connect with 10 people)',
];

function buildDays() {
  const days = [];
  for (const w of WEEKS) {
    for (const b of w.blocks) {
      for (let d = b.from; d <= b.to; d++) {
        days[d] = {
          day: d, week: w.week, weekTitle: w.title,
          type: b.type ?? (b.project ? 'project' : 'study'),
          focus: b.focus, course: b.course ?? null,
          tasks: b.tasks ?? (b.project ? ['6h: build the project', '30min: SQL practice'] : STUDY_TASKS),
        };
      }
    }
    if (w.share) {
      days[w.share.day] = {
        day: w.share.day, week: w.week, weekTitle: w.title, type: 'share',
        focus: 'Build & Share day', course: null, repo: w.share.repo, post: w.share.post,
        tasks: [...w.share.tasks, ...SHARE_ROUTINE],
      };
    }
  }
  for (const [d, s] of Object.entries(SPECIAL_DAYS)) {
    days[d] = { day: Number(d), week: 14, weekTitle: WEEKS[13].title, course: null, ...s };
  }
  return days.slice(1);
}

export const DAYS = buildDays();

export function dateForDay(startDate, day) {
  const d = new Date(`${startDate}T00:00:00`);
  d.setDate(d.getDate() + day - 1);
  return d;
}

export function currentDay(startDate, today = new Date()) {
  const start = new Date(`${startDate}T00:00:00`);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const n = Math.round((midnight - start) / 86_400_000) + 1;
  return Math.min(Math.max(n, 0), TOTAL_DAYS + 1); // 0 = not started, 93 = finished
}
