import { aggregation } from './aggregation';
import { advancedTypes, plpgsqlControl, sqlSublanguages, tempTables } from './extra-core';
import { analyticsPatterns, cohortRetention, medallion } from './extra-patterns';
import { indexTypes, queryHabits } from './extra-performance';
import { beyond } from './beyond';
import { foundations, querying } from './foundations';
import { functions } from './functions';
import { joins } from './joins';
import { modeling } from './modeling';
import { objects } from './objects';
import { patterns } from './patterns';
import { performance } from './performance';
import { subqueries } from './subqueries';
import { transactions } from './transactions';
import { windows } from './windows';

// Chapters in learning order. `hue` drives each chapter's colour theme (oklch hue angle).
export const chapters = [
  { id: 'foundations', title: 'Foundations', hue: 265, icon: '◆', blurb: 'How relational data and queries work.', concepts: foundations },
  { id: 'querying', title: 'Querying basics', hue: 200, icon: '⌕', blurb: 'Select, filter, sort and match text.', concepts: querying },
  { id: 'aggregation', title: 'Aggregation', hue: 150, icon: 'Σ', blurb: 'Summarise rows into groups and totals.', concepts: aggregation },
  { id: 'joins', title: 'Joins', hue: 35, icon: '⋈', blurb: 'Combine tables without multiplying mistakes.', concepts: joins },
  { id: 'subqueries', title: 'Subqueries, CTEs & sets', hue: 300, icon: '❴❵', blurb: 'Queries inside queries, recursion and set logic.', concepts: subqueries },
  { id: 'windows', title: 'Window functions', hue: 10, icon: '▤', blurb: 'Ranks, running totals and comparisons across rows.', concepts: windows },
  { id: 'functions', title: 'Dates, text & logic', hue: 85, icon: 'ƒ', blurb: 'The functions you use every day.', concepts: functions },
  { id: 'modeling', title: 'Modelling & changing data', hue: 230, icon: '▦', blurb: 'Types, constraints, schemas, inserts and upserts.', concepts: modeling },
  { id: 'transactions', title: 'Transactions', hue: 180, icon: '⇄', blurb: 'ACID, isolation and locks.', concepts: transactions },
  { id: 'objects', title: 'Database objects', hue: 125, icon: '⬡', blurb: 'Views, partitions, functions, procedures, triggers.', concepts: objects },
  { id: 'performance', title: 'Performance & JSON', hue: 345, icon: '⚡', blurb: 'Query plans, indexes, arrays and JSON.', concepts: performance },
  { id: 'patterns', title: 'Data engineering patterns', hue: 55, icon: '⚙', blurb: 'The recipes pipelines and interviews are made of.', concepts: patterns },
  { id: 'beyond', title: 'Beyond PostgreSQL', hue: 280, icon: '☁', blurb: 'Warehouses, columnar storage and dialects.', concepts: beyond },
];

// Pages added later, each placed right after an existing page.
const after = (list, id, ...items) => {
  const i = list.findIndex((c) => c.id === id);
  if (i === -1) throw new Error(`unknown concept ${id}`);
  list.splice(i + 1, 0, ...items);
};
after(foundations, 'relational-model', sqlSublanguages);
after(modeling, 'data-types', advancedTypes);
after(objects, 'materialized-views', tempTables);
after(objects, 'procedures', plpgsqlControl);
after(performance, 'indexes', indexTypes, queryHabits);
after(patterns, 'top-n', analyticsPatterns, cohortRetention);
after(patterns, 'data-quality', medallion);

export const concepts = chapters.flatMap((ch) => ch.concepts.map((c) => ({ ...c, chapter: ch })));
export const conceptById = Object.fromEntries(concepts.map((c, i) => [c.id, { ...c, index: i }]));
