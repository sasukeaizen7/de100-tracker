// SQL courses for data engineering on Udemy. Ratings, reviews and lengths as shown on Udemy on 28 October 2026.
// `chapters` lists the SQL Academy chapters each course covers, so you can revise alongside it.
export const COURSES_CHECKED = '28 October 2026';

export const courses = [
  {
    title: 'The Complete SQL Bootcamp: Go from Zero to Hero',
    instructor: 'Jose Portilla',
    slug: 'the-complete-sql-bootcamp',
    rating: 4.6, reviews: 259108, hours: 9, updated: '2022-12',
    track: 'foundations', inPlan: true,
    bestFor: 'Your first SQL course: PostgreSQL basics through joins, subqueries and table design, with many small challenges.',
    chapters: ['foundations', 'querying', 'aggregation', 'joins', 'functions', 'modeling'],
  },
  {
    title: 'SQL - MySQL for Data Analytics and Business Intelligence',
    instructor: '365 Careers',
    slug: 'sql-mysql-for-data-analytics-and-business-intelligence',
    rating: 4.6, reviews: 65704, hours: 12, updated: '2026-10',
    track: 'foundations',
    bestFor: 'An alternative first course on MySQL with strong theory (relational model, constraints, DDL/DML/DCL/TCL) and analytics exercises.',
    chapters: ['foundations', 'querying', 'aggregation', 'joins', 'modeling', 'objects'],
  },
  {
    title: 'Advanced SQL Bootcamp',
    instructor: 'Jose Portilla',
    slug: 'advanced-sql-bootcamp',
    rating: 4.3, reviews: 2421, hours: 10.5, updated: '2022-08',
    track: 'advanced',
    bestFor: 'The PostgreSQL follow-up: window functions, grouping sets, transactions, partitioning, views, functions, procedures, triggers, JSON.',
    chapters: ['subqueries', 'windows', 'transactions', 'objects', 'performance'],
  },
  {
    title: 'Advanced SQL for Data Engineering',
    instructor: '365 Careers, Shashank Kalanithi',
    slug: 'advanced-sql-for-data-engineering',
    rating: 4.5, reviews: 3910, hours: 2.5, updated: '2023-06',
    track: 'advanced',
    bestFor: 'A short data-engineering angle: MERGE, time zones, arrays and ranges, LATERAL, recursive CTEs, normalization and star schemas.',
    chapters: ['modeling', 'joins', 'subqueries', 'objects'],
  },
  {
    title: 'Building a Modern Data Warehouse - Data Engineering Bootcamp',
    instructor: 'Baraa Khatib Salkini',
    slug: 'building-a-modern-data-warehouse-data-engineering-bootcamp',
    rating: 4.8, reviews: 1237, hours: 6.5, updated: '2026-10',
    track: 'warehouse',
    bestFor: 'A full project: bronze/silver/gold layers, load procedures, a star schema, then analytics (change over time, part-to-whole, segmentation). Great portfolio material.',
    chapters: ['patterns', 'modeling', 'objects'],
  },
  {
    title: 'SQL for Data Engineers: From Zero to Data Warehouse',
    instructor: 'Harish Kollana',
    slug: 'sql-for-data-engineers-from-zero-to-data-warehouse',
    rating: null, reviews: 0, hours: 6.5, updated: '2026-10',
    track: 'warehouse',
    bestFor: 'Very new (no reviews yet). SQL Server based: basics to window functions, procedures, indexes and partitions, ending with a medallion warehouse.',
    chapters: ['querying', 'windows', 'objects', 'performance', 'patterns'],
  },
  {
    title: 'The Complete dbt Bootcamp: Zero to Hero + Certification Prep',
    instructor: 'Zoltan C. Toth',
    slug: 'complete-dbt-data-build-tool-bootcamp-zero-to-hero-learn-dbt',
    rating: 4.6, reviews: 12153, hours: 13, updated: '2026-09',
    track: 'tools', inPlan: true,
    bestFor: 'SQL transformations in production: models, tests, snapshots (SCD2), incremental models. Days 32–40 of your plan.',
    chapters: ['patterns', 'modeling'],
  },
  {
    title: 'Snowflake – The Complete Masterclass',
    instructor: 'Nikolai Schuler',
    slug: 'snowflake-masterclass',
    rating: 4.6, reviews: 29594, hours: 18.5, updated: '2026-10',
    track: 'tools', inPlan: true,
    bestFor: 'SQL on a cloud warehouse: loading, micro-partitions, clustering, time travel, roles. Days 22–27 of your plan.',
    chapters: ['beyond', 'performance', 'transactions'],
  },
  {
    title: 'Data Engineering for Beginners: Learn SQL, Python & Spark',
    instructor: 'Durga Viswanatha Raju Gadiraju and others',
    slug: 'data-engineering-essentials-sql-python-and-spark',
    rating: 4.4, reviews: 9053, hours: 56, updated: '2026-03',
    track: 'tools',
    bestFor: 'A very long all-in-one (SQL, Python, Spark SQL on Databricks). Use it as a reference rather than watching it end to end.',
    chapters: ['querying', 'aggregation', 'joins', 'windows', 'beyond'],
  },
];

export const tracks = [
  { id: 'foundations', title: 'Start here', blurb: 'Pick one: both cover the basics well.' },
  { id: 'advanced', title: 'Go deeper', blurb: 'Window functions, transactions and database objects.' },
  { id: 'warehouse', title: 'Build a warehouse', blurb: 'Apply SQL to a real data engineering project.' },
  { id: 'tools', title: 'SQL in the modern stack', blurb: 'The tools where you will write SQL at work.' },
];
