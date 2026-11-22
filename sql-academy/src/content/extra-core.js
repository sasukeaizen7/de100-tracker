export const sqlSublanguages = {
  id: 'sql-sublanguages',
  title: 'SQL command families and permissions',
  level: 'basic',
  summary: 'DDL, DML, DQL, DCL and TCL: the five families of SQL statements, and how GRANT and REVOKE control who can do what.',
  body: [
    { p: 'Every SQL statement belongs to a family, named after what it acts on. The names come up constantly in documentation, job ads and interviews.' },
    {
      table: {
        head: ['Family', 'Stands for', 'Acts on', 'Statements', 'Page'],
        rows: [
          ['**DDL**', 'Data Definition Language', 'the structure', '`CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `COMMENT`', '[Keys and constraints](#/c/constraints)'],
          ['**DML**', 'Data Manipulation Language', 'the rows', '`INSERT`, `UPDATE`, `DELETE`, `MERGE`', '[INSERT, UPDATE, DELETE](#/c/insert-update-delete)'],
          ['**DQL**', 'Data Query Language', 'reading', '`SELECT` (often counted as DML)', '[SELECT and WHERE](#/c/select-where)'],
          ['**DCL**', 'Data Control Language', 'permissions', '`GRANT`, `REVOKE`', 'this page'],
          ['**TCL**', 'Transaction Control Language', 'units of work', '`BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`', '[Transactions](#/c/transactions)'],
        ],
      },
    },
    { h: 'Roles and privileges' },
    { p: 'PostgreSQL has **roles**: a role can log in (a user), group other roles (a group), or both. Every object has an owner, and other roles get **privileges** on it with `GRANT`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` on tables; `USAGE` on schemas; `EXECUTE` on functions.' },
    { sql: "do $$ begin                                          -- create the role once, so the block can be rerun\n  if not exists (select from pg_roles where rolname = 'analyst') then\n    create role analyst nologin;                     -- a group role for read-only analysts\n  end if;\nend $$;\n\ngrant usage on schema public to analyst;\ngrant select on customers, products, orders, order_items to analyst;\ngrant select on order_summary to analyst;            -- views can be granted like tables\nrevoke select on customers from analyst;             -- changed our mind: personal data\n\nselect grantee, table_name, privilege_type\nfrom information_schema.role_table_grants\nwhere grantee = 'analyst'\norder by table_name;", title: 'A read-only role' },
    { sql: "begin;\n  set local role analyst;               -- only until the transaction ends\n  select current_user, count(*) from orders;   -- allowed\nrollback;", title: 'Act as the role to test it', note: 'Run **A read-only role** first: it creates the role and its grants.' },
    { sql: "begin;\n  set local role analyst;\n  select * from customers;            -- refused: no SELECT privilege\nrollback;", title: 'Permission denied', expectError: true, note: 'The error aborts the transaction, which also ends `SET LOCAL ROLE`: you are back to the owner.' },
    {
      table: {
        head: ['Principle', 'In practice'],
        rows: [
          ['Least privilege', 'grant only what a role needs: analysts `SELECT`, loaders `INSERT/UPDATE` on their schemas'],
          ['Grant to groups, not people', 'create `analyst`, `loader`, `admin` roles; add users to them with `GRANT analyst TO alice`'],
          ['Expose views, not tables', 'grant on a view without personal columns (see [Views](#/c/views))'],
          ['Future tables', '`ALTER DEFAULT PRIVILEGES … GRANT SELECT ON TABLES TO analyst` covers tables created later'],
          ['Row-level security', '`CREATE POLICY` restricts which rows a role sees (multi-tenant apps)'],
        ],
      },
    },
    { callout: 'de', text: 'Warehouses use the same model: Snowflake grants privileges to roles in a hierarchy (`SYSADMIN`, custom `TRANSFORMER`, `REPORTER` roles); BigQuery uses IAM roles on datasets. A dbt project usually has one role that writes models and one read-only role for BI.' },
  ],
  practice: [
    { q: 'Which privileges does `analyst` hold on `orders`? (run the first example). Column: `privilege_type`.', solution: "select privilege_type from information_schema.role_table_grants\nwhere grantee = 'analyst' and table_name = 'orders';", setup: true },
  ],
  interview: [
    { q: 'What are DDL, DML, DCL and TCL? Give examples.', a: 'DDL defines structure (CREATE, ALTER, DROP). DML changes data (INSERT, UPDATE, DELETE, MERGE). DCL manages permissions (GRANT, REVOKE). TCL controls transactions (BEGIN, COMMIT, ROLLBACK, SAVEPOINT). SELECT is sometimes separated as DQL.' },
    { q: 'How would you give analysts read access to a schema, including future tables?', a: 'Create a group role, GRANT USAGE on the schema and SELECT on all existing tables (GRANT SELECT ON ALL TABLES IN SCHEMA), plus ALTER DEFAULT PRIVILEGES IN SCHEMA … GRANT SELECT ON TABLES so new tables are covered; then grant the role to users.' },
  ],
  related: ['relational-model', 'views', 'transactions'],
};

export const advancedTypes = {
  id: 'advanced-types',
  title: 'ENUM, ranges, composite types and domains',
  level: 'intermediate',
  summary: 'PostgreSQL types beyond numbers and text: fixed value lists, intervals of values, structured values and reusable validated types.',
  body: [
    { p: 'PostgreSQL lets you create your own types. Used well, they move business rules into the schema, where they are enforced on every write.' },
    { h: 'ENUM: a fixed list of values' },
    { sql: "drop table if exists deliveries cascade;\ndrop type if exists delivery_status;\ncreate type delivery_status as enum ('pending', 'shipped', 'delivered', 'returned');\n\ncreate table deliveries (\n  delivery_id int generated always as identity primary key,\n  order_id    int references orders (order_id),\n  status      delivery_status not null default 'pending'\n);\ninsert into deliveries (order_id, status) values (1, 'delivered'), (2, 'shipped'), (5, 'pending');\n\nselect * from deliveries order by status;          -- sorts in declaration order, not alphabetically\nselect enum_range(null::delivery_status);          -- the allowed values", title: 'Create and use an enum' },
    {
      table: {
        head: ['', '`ENUM`', '`text` + `CHECK (status IN …)`', 'Lookup table + foreign key'],
        rows: [
          ['Storage', '+ 4 bytes', 'the text', 'an id'],
          ['Sort order', '+ declaration order', 'alphabetical', 'any column you add'],
          ['Add a value', '`ALTER TYPE … ADD VALUE` (easy)', 'change the constraint', '+ insert a row'],
          ['Remove / rename a value', '- hard (rename only)', '+ change the constraint', '+ update rows'],
          ['Extra attributes (label, colour)', '- no', '- no', '+ yes'],
          ['Portable to warehouses', '- no', '+ yes', '+ yes'],
        ],
      },
    },
    { h: 'Ranges: a start and an end in one value' },
    { p: 'Range types (`int4range`, `numrange`, `daterange`, `tstzrange`…) store an interval with inclusive `[` or exclusive `)` bounds. Operators answer overlap (`&&`), containment (`@>`) and adjacency (`-|-`) correctly, which is surprisingly easy to get wrong with two separate columns.' },
    { sql: "select daterange('2026-04-01', '2026-04-10')                   as stay,        -- [start, end)\n       daterange('2026-04-01', '2026-04-10') @> date '2026-04-05' as contains_day,\n       daterange('2026-04-01', '2026-04-10') && daterange('2026-04-09', '2026-04-12') as overlaps,\n       upper(daterange('2026-04-01', '2026-04-10')) - lower(daterange('2026-04-01', '2026-04-10')) as nights;", title: 'Range operators' },
    { sql: "drop table if exists promotions;\ncreate table promotions (product_id int, pct int, valid daterange);\ninsert into promotions values (3, 10, '[2026-02-01,2026-03-01)'), (5, 20, '[2026-04-01,2026-05-01)');\n\n-- order lines that happened during a promotion of their product\nselect l.order_id, l.product, l.ordered_at::date, p.pct\nfrom order_lines l\njoin promotions p\n  on p.product_id = l.product_id\n and p.valid @> l.ordered_at::date;", title: 'Join on \"date inside a range\"' },
    { h: 'Composite types: a structured value' },
    { sql: "drop type if exists address cascade;\ncreate type address as (street text, postcode text, city text);\n\nselect row('12 rue de Rivoli', '75004', 'Paris')::address              as addr,\n       (row('12 rue de Rivoli', '75004', 'Paris')::address).city       as city;", title: 'A composite type' },
    { h: 'Domains: a type with built-in rules' },
    { sql: "drop domain if exists email_address cascade;\ncreate domain email_address as text\n  check (value ~ '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$');\n\nselect 'amina@mail.fr'::email_address as ok;", title: 'A validated email type', note: "Try `select 'not-an-email'::email_address;`: the domain's check rejects it everywhere the type is used." },
    { callout: 'de', text: 'Warehouses model the same ideas differently: nested data uses `STRUCT`/`ARRAY` (BigQuery) or `VARIANT`/`OBJECT` (Snowflake), and ranges become two columns `valid_from`/`valid_to` (as in SCD2). Knowing the PostgreSQL types helps you design those columns correctly.' },
  ],
  practice: [
    { q: 'From `deliveries` (run the first example), the deliveries that are not yet delivered, using the enum order (`status < \'delivered\'`). Columns: `order_id`, `status`.', solution: "select order_id, status from deliveries where status < 'delivered';", setup: true },
    { q: 'Does the range [10, 20) overlap [20, 30)? Return a boolean `overlaps`.', solution: 'select int4range(10, 20) && int4range(20, 30) as overlaps;' },
  ],
  interview: [
    { q: 'Enum vs lookup table?', a: 'An enum is compact, ordered and validated, but values are hard to remove or rename and it carries no extra attributes; a lookup table with a foreign key is more flexible (labels, ordering column, soft-deleting values) and portable. Use enums for small, stable state machines.' },
  ],
  related: ['data-types', 'constraints', 'index-types'],
};

export const tempTables = {
  id: 'temp-tables-ctas',
  title: 'Temporary tables and CREATE TABLE AS',
  level: 'intermediate',
  summary: 'Materialise intermediate results: temporary tables live for your session, CTAS creates a table straight from a query.',
  body: [
    { p: 'Sometimes a step is reused many times, is expensive, or needs an index before the next step. Then it is worth **materialising** it as a table instead of recomputing a CTE.' },
    { h: 'CREATE TABLE AS (CTAS)' },
    { sql: "drop table if exists customer_stats;\ncreate table customer_stats as\nselect customer_id,\n       count(*)         as orders,\n       sum(total)       as spent,\n       max(ordered_at)  as last_order\nfrom order_summary\nwhere customer_id is not null and status <> 'cancelled'\ngroup by customer_id;\n\nalter table customer_stats add primary key (customer_id);   -- CTAS copies no constraints\nselect * from customer_stats order by spent desc;", title: 'Build a table from a query' },
    { p: 'CTAS copies column names and types, not constraints, defaults or indexes: add what you need afterwards. `CREATE TABLE x (LIKE y INCLUDING ALL)` is the opposite: it copies the structure (with constraints) but no rows. `… WITH NO DATA` creates the CTAS shape without rows.' },
    { h: 'Temporary tables' },
    { sql: "drop table if exists recent_orders;           -- so the block can be rerun\ncreate temporary table recent_orders as\nselect * from order_summary where ordered_at >= '2026-03-01';\n\ncreate index on recent_orders (customer_id);\nanalyze recent_orders;\n\nselect customer_id, count(*) from recent_orders group by customer_id;", title: 'A temporary table with an index' },
    {
      table: {
        head: ['', 'CTE', 'Temporary table', 'Regular table (CTAS)'],
        rows: [
          ['Lives for', 'one statement', 'the session (or transaction with `ON COMMIT DROP`)', 'until dropped'],
          ['Visible to other sessions', '—', '- no', '+ yes'],
          ['Indexes and statistics', '- no', '+ yes', '+ yes'],
          ['Written to the WAL', '—', '- no (faster)', '+ yes'],
          ['Use for', 'readable steps', 'intermediate results reused within a script', 'results others will read'],
        ],
      },
    },
    { callout: 'trap', text: 'A temporary table hides a permanent table with the same name for the rest of the session. Name them distinctly (`tmp_…`) to avoid surprises.' },
    { callout: 'de', text: 'Warehouse ELT is CTAS everywhere: a dbt `table` model compiles to `CREATE TABLE … AS SELECT` into a temporary name followed by a swap, so readers never see a half-built table. Snowflake also has `TRANSIENT` tables (no fail-safe, cheaper) for staging data.' },
  ],
  practice: [
    { q: 'Create (with CTAS) a table `product_sales` with `product_id` and `units` sold (cancelled excluded), then select it. The checker reads your last SELECT. Columns: `product_id`, `units`.', solution: "drop table if exists product_sales;\ncreate table product_sales as\nselect product_id, sum(quantity) as units from order_lines where status <> 'cancelled' group by product_id;\nselect product_id, units from product_sales;" },
  ],
  interview: [
    { q: 'When would you use a temp table instead of a CTE?', a: 'When an intermediate result is reused several times or across statements, is large enough to benefit from its own index and statistics, or when a complex query plans badly and materialising a step gives the planner accurate row counts.' },
  ],
  related: ['ctes', 'materialized-views', 'medallion-architecture'],
};

export const plpgsqlControl = {
  id: 'plpgsql-control-flow',
  title: 'PL/pgSQL: variables, loops and error handling',
  level: 'advanced',
  summary: 'The procedural part of PostgreSQL: declare variables, branch, loop over query results, and catch errors without aborting everything.',
  body: [
    { p: 'PL/pgSQL is PostgreSQL\'s procedural language, used inside functions, procedures, triggers and anonymous `DO` blocks. Use it for logic that is truly step by step; keep set-based work in plain SQL inside it.' },
    { h: 'Block structure' },
    { sql: "do $$\ndeclare\n  n_orders  int;\n  biggest   numeric;\nbegin\n  select count(*), max(total) into n_orders, biggest from order_summary;\n  raise notice 'orders: %, biggest: %', n_orders, biggest;\nend;\n$$;", title: 'DECLARE, BEGIN … END and RAISE NOTICE', note: 'Notices appear above the result. `DO` runs an anonymous block once.' },
    { h: 'Branches and loops' },
    { sql: "do $$\ndeclare\n  r record;\nbegin\n  for r in select first_name, city from customers order by customer_id loop\n    if r.city = 'Paris' then\n      raise notice '% lives in Paris', r.first_name;\n    elsif r.city in ('Lyon', 'Marseille') then\n      raise notice '% lives in the south-east', r.first_name;\n    else\n      raise notice '% lives elsewhere (%)', r.first_name, r.city;\n    end if;\n  end loop;\nend;\n$$;", title: 'FOR loop over a query, IF / ELSIF / ELSE' },
    {
      table: {
        head: ['Construct', 'Syntax'],
        rows: [
          ['Assign', '`x := 5;` or `select … into x from …;`'],
          ['Condition', '`if … then … elsif … then … else … end if;`'],
          ['Loop over rows', '`for r in select … loop … end loop;`'],
          ['Counter loop', '`for i in 1..10 loop … end loop;`'],
          ['While', '`while x < 10 loop … end loop;`'],
          ['Leave / skip', '`exit when …;` / `continue when …;`'],
          ['Rows affected', '`get diagnostics n = row_count;`'],
          ['Dynamic SQL', "`execute format('select count(*) from %I', tbl) into n;`"],
        ],
      },
    },
    { h: 'Error handling' },
    { p: 'An `EXCEPTION` section catches errors raised in its block. The block\'s changes are rolled back (it works like a savepoint), and execution continues after it. `SQLSTATE` and `SQLERRM` describe the error; `RAISE EXCEPTION` raises your own.' },
    { sql: "drop table if exists load_errors;\ncreate table load_errors (raw text, error text);\n\ndo $$\ndeclare\n  raw_value text;\nbegin\n  foreach raw_value in array array['12.50', 'abc', '7', '-3'] loop\n    begin\n      if raw_value::numeric < 0 then\n        raise exception 'negative amount %', raw_value using errcode = 'check_violation';\n      end if;\n      raise notice 'loaded %', raw_value;\n    exception\n      when invalid_text_representation then\n        insert into load_errors values (raw_value, 'not a number');\n      when check_violation then\n        insert into load_errors values (raw_value, sqlerrm);\n    end;\n  end loop;\nend;\n$$;\n\nselect * from load_errors;", title: 'Catch bad rows, log them, keep going', note: 'This is the "quarantine" pattern: good rows load, bad rows are recorded with the reason instead of failing the whole batch.' },
    {
      table: {
        head: ['Condition name', 'SQLSTATE', 'Raised by'],
        rows: [
          ['`unique_violation`', '23505', 'duplicate key'],
          ['`foreign_key_violation`', '23503', 'missing parent row'],
          ['`not_null_violation`', '23502', 'NULL in a NOT NULL column'],
          ['`check_violation`', '23514', 'CHECK constraint failed'],
          ['`invalid_text_representation`', '22P02', "bad cast like `'abc'::int`"],
          ['`division_by_zero`', '22012', '`x / 0`'],
          ['`others`', '—', 'any error (use sparingly: it hides bugs)'],
        ],
      },
    },
    { callout: 'trap', text: 'Exception blocks cost a savepoint each time they are entered. In a loop over a million rows that is slow: validate with set-based SQL first (filter bad rows into a quarantine table with one `INSERT … SELECT … WHERE NOT valid`), then load the rest.' },
  ],
  practice: [
    { q: 'Write a `DO` block that counts the products in each category with a FOR loop and raises a notice per category. Then, so the checker has something to compare, finish with `select count(distinct category) as categories from products;`.', solution: "do $$\ndeclare r record;\nbegin\n  for r in select category, count(*) as n from products group by category loop\n    raise notice '%: %', r.category, r.n;\n  end loop;\nend;\n$$;\nselect count(distinct category) as categories from products;" },
  ],
  interview: [
    { q: 'What happens to a transaction when an error is caught in a PL/pgSQL EXCEPTION block?', a: 'The changes made inside that block are rolled back to an implicit savepoint taken when the block was entered; the outer transaction stays valid and execution continues after the block.' },
  ],
  related: ['sql-functions', 'procedures', 'data-quality'],
};
