export const functions = [
  {
    id: 'dates-times',
    title: 'Dates, times and time zones',
    level: 'intermediate',
    summary: 'Truncate, extract, add intervals and handle time zones correctly: the daily bread of analytics.',
    body: [
      {
        table: {
          head: ['Type', 'Stores', 'Use for'],
          rows: [
            ['`date`', 'a calendar day', 'birthdays, report dates, partitions'],
            ['`timestamp`', 'date + time, no zone', 'local wall-clock times you never compare across zones'],
            ['`timestamptz`', 'an absolute instant (stored as UTC)', '+ events, logs, anything that happened'],
            ['`interval`', 'a duration', "`interval '30 minutes'`, `now() - created_at`"],
          ],
        },
      },
      { sql: "select ordered_at,\n       date_trunc('month', ordered_at)::date   as month,\n       date_trunc('week', ordered_at)::date    as week_start,   -- Monday\n       extract(year from ordered_at)           as year,\n       extract(isodow from ordered_at)         as iso_weekday,  -- 1 = Monday\n       to_char(ordered_at, 'YYYY-MM')          as year_month,\n       to_char(ordered_at, 'DD/MM/YYYY HH24:MI') as french_format,\n       ordered_at::date                        as day\nfrom orders\norder by ordered_at;", title: 'Truncating, extracting, formatting' },
      { p: '`date_trunc` keeps the type and rounds down to the start of the unit: it is the right tool for grouping by period. `extract` returns a number (month 3), which loses the year: grouping by `extract(month …)` mixes March 2025 and March 2026.' },
      { sql: "select ordered_at + interval '3 days'                as ship_by,\n       ordered_at::date + 30                          as plus_30_days,   -- date + int = date\n       date '2026-12-31' - ordered_at::date           as days_left,      -- date - date = int\n       age(date '2026-12-31', ordered_at::date)       as age_readable,\n       now() - ordered_at > interval '90 days'        as older_than_90d\nfrom orders\nlimit 3;", title: 'Date arithmetic' },
      { h: 'Time zones' },
      { p: 'A `timestamptz` is an instant. It is **displayed** in the session time zone, and casting it to `date` also uses the session zone. "Which day did this happen?" depends on where you stand: 01:00 in Paris is still the previous day in UTC.' },
      { sql: "select occurred_at,\n       occurred_at at time zone 'Europe/Paris'          as paris_wall_clock,\n       occurred_at at time zone 'UTC'                   as utc_wall_clock,\n       (occurred_at at time zone 'Europe/Paris')::date  as paris_day,\n       (occurred_at at time zone 'America/New_York')::date as new_york_day\nfrom events\nwhere event_id = 7;", title: 'The same instant in three places', note: '21:00 in Paris on 3 April is 15:00 in New York: same day here. An event at 01:00 Paris would land on different days.' },
      { callout: 'trap', title: 'Half-open ranges', text: "`ordered_at between '2026-03-01' and '2026-03-31'` stops at 31 March **00:00**, losing the whole last day. Use `ordered_at >= '2026-03-01' and ordered_at < '2026-04-01'`: it works for every type and every month length." },
      { sql: "select generate_series(date '2026-04-01', date '2026-04-07', interval '1 day')::date as day;", title: 'A series of dates (date spine)' },
      { callout: 'de', text: 'Store event times as `timestamptz` (UTC under the hood). Convert to the business time zone once, explicitly, when you derive the reporting date: `(occurred_at at time zone \'Europe/Paris\')::date`.' },
    ],
    practice: [
      { q: 'Number of orders per month (cancelled included). Columns: `month` (a date), `orders`.', solution: "select date_trunc('month', ordered_at)::date as month, count(*) as orders\nfrom orders group by 1;" },
      { q: 'Orders placed on a weekend (Saturday or Sunday). Columns: `order_id`, `ordered_at`.', hint: '`extract(isodow …)` returns 6 and 7 for the weekend.', solution: 'select order_id, ordered_at from orders\nwhere extract(isodow from ordered_at) in (6, 7);' },
    ],
    interview: [
      { q: 'timestamp vs timestamptz?', a: 'timestamp is a wall-clock value with no zone; timestamptz represents an absolute instant (stored normalized to UTC and displayed in the session zone). Use timestamptz for events so comparisons across zones and DST changes are correct.' },
      { q: 'Why should date ranges be half-open?', a: '`>= start AND < next_start` includes every instant of the period regardless of time precision, never double-counts boundaries, and works for months of any length.' },
    ],
    related: ['strings', 'gaps-islands', 'period-over-period'],
  },
  {
    id: 'strings',
    title: 'Text functions',
    level: 'basic',
    summary: 'Clean, combine, split and search text: the functions you need to tidy raw data.',
    body: [
      { p: 'Raw data is messy: extra spaces, inconsistent case, codes glued together. Text functions are how you clean it in the staging layer of a pipeline.' },
      {
        table: {
          head: ['Need', 'Function', 'Example → result'],
          rows: [
            ['Concatenate', '`||`, `concat`, `concat_ws`', "`concat_ws(' ', 'Amina', NULL, 'B')` → `Amina B`"],
            ['Change case', '`upper`, `lower`, `initcap`', "`initcap('jean-luc')` → `Jean-Luc`"],
            ['Trim / pad', '`trim`, `ltrim`, `rtrim`, `lpad`, `rpad`', "`lpad('7', 3, '0')` → `007`"],
            ['Cut', '`left`, `right`, `substring`', "`left('Paris', 3)` → `Par`"],
            ['Split', '`split_part`, `string_to_array`, `string_to_table`', "`split_part('a@b.fr', '@', 2)` → `b.fr`"],
            ['Find', '`position`, `strpos`', "`strpos('hello', 'l')` → 3"],
            ['Replace', '`replace`, `regexp_replace`, `translate`', "`translate('été', 'é', 'e')` → `ete`"],
            ['Measure', '`length`, `octet_length`', "`length('é')` = 1, `octet_length('é')` = 2"],
            ['Aggregate', '`string_agg(x, sep order by …)`', 'many rows → one text'],
          ],
        },
      },
      { sql: "select first_name || ' ' || upper(last_name)    as full_name,\n       left(first_name, 1) || '. ' || last_name  as short_name,\n       lower(email)                              as email,\n       split_part(email, '@', 2)                 as domain,\n       length(last_name)                         as name_length,\n       lpad(customer_id::text, 5, '0')           as customer_code\nfrom customers;", title: 'Everyday text functions' },
      { sql: "select raw,\n       trim(raw)                                         as trimmed,\n       initcap(trim(raw))                                as cleaned,\n       regexp_replace(trim(raw), '\\s+', ' ', 'g')        as single_spaces\nfrom (values ('  paris  '), ('LYON'), ('saint  étienne')) as t(raw);", title: 'Cleaning messy input' },
      { sql: "select name, string_to_table(name, ' ') as word from products;", title: 'Split text into rows' },
      { callout: 'trap', text: "`'a' || NULL` is NULL: one missing part erases the whole string. Use `concat()` or `concat_ws()`, which skip NULLs, or wrap parts in `coalesce`." },
      { callout: 'tip', text: 'To compare text case-insensitively and accent-insensitively (Chloé vs chloe), PostgreSQL offers the `unaccent` extension and non-deterministic collations. In pipelines, normalise once in staging (`lower(unaccent(trim(x)))`).' },
    ],
    practice: [
      { q: 'Each customer as `Initial. LASTNAME`, e.g. `A. BENALI`. Column: `label`.', solution: "select left(first_name, 1) || '. ' || upper(last_name) as label from customers;" },
      { q: 'One row with all product names in alphabetical order separated by ` | `. Column: `names`.', solution: "select string_agg(name, ' | ' order by name) as names from products;" },
    ],
    interview: [
      { q: 'Why might concatenating columns return NULL?', a: 'The || operator returns NULL if any operand is NULL. Use concat/concat_ws, which ignore NULLs, or coalesce each operand.' },
    ],
    related: ['pattern-matching', 'numbers-casting'],
  },
  {
    id: 'numbers-casting',
    title: 'Numbers, rounding and casting',
    level: 'basic',
    summary: 'Pick exact types for money, beware integer division, and convert types explicitly.',
    body: [
      {
        table: {
          head: ['Type', 'Exact?', 'Range / note', 'Use for'],
          rows: [
            ['`smallint`, `int`, `bigint`', '+ exact', '2, 4, 8 bytes', 'counts and ids (`bigint` for event tables)'],
            ['`numeric(p, s)`', '+ exact', 'any precision, slower', 'money and anything summed and compared'],
            ['`real`, `double precision`', '- approximate', '`0.1 + 0.2 <> 0.3`', 'measurements, scientific values'],
          ],
        },
      },
      { sql: "select 7 / 2                   as int_division,       -- 3: both are integers\n       7 / 2.0                 as numeric_division,   -- 3.5\n       7::numeric / 2          as cast_first,         -- 3.5\n       7 % 2                   as remainder,\n       round(2.345, 2)         as rounded,            -- 2.35\n       trunc(2.349, 2)         as truncated,          -- 2.34\n       ceil(2.1)               as ceil,\n       floor(2.9)              as floor,\n       abs(-5)                 as abs,\n       power(2, 10)            as power,\n       0.1::float8 + 0.2::float8 = 0.3 as float_equal,  -- false!\n       0.1 + 0.2 = 0.3         as numeric_equal;     -- true", title: 'Arithmetic traps' },
      { h: 'Casting' },
      { p: 'PostgreSQL converts types only when it is safe; otherwise you cast explicitly with `CAST(x AS type)` (standard) or `x::type` (PostgreSQL shorthand). A failing cast stops the whole query, so in staging models you often validate first.' },
      { sql: "select cast('2026-04-01' as date)  as standard_cast,\n       '42'::int + 1               as shorthand,\n       price::int                  as rounded_int,\n       price::text || ' €'         as label\nfrom products\nlimit 2;", title: 'Explicit casts' },
      { sql: "select raw,\n       case when raw ~ '^-?\\d+(\\.\\d+)?$' then raw::numeric end as safe_number\nfrom (values ('12.5'), ('abc'), ('7'), ('')) as t(raw);", title: 'Safe cast: only convert what looks like a number', note: 'Snowflake and BigQuery have `TRY_CAST` / `SAFE_CAST` for this. PostgreSQL 16+ adds `pg_input_is_valid(raw, \'numeric\')`.' },
      { callout: 'trap', text: 'Percentages: `100 * part / total` with integers truncates (2/3 → 0). Write `100.0 * part / total`, and protect the division: `/ nullif(total, 0)`.' },
    ],
    practice: [
      { q: 'Share of customers living in Paris as a percentage with one decimal. Column: `pct_paris`.', solution: "select round(100.0 * count(*) filter (where city = 'Paris') / count(*), 1) as pct_paris from customers;" },
    ],
    interview: [
      { q: 'Why not store money in FLOAT?', a: 'Binary floating point can\'t represent most decimal fractions exactly, so sums drift and equality tests fail (0.1 + 0.2 ≠ 0.3). Use NUMERIC/DECIMAL, or integer cents.' },
    ],
    related: ['case-coalesce', 'data-types'],
  },
  {
    id: 'case-coalesce',
    title: 'CASE, COALESCE, NULLIF and pivots',
    level: 'basic',
    summary: 'Conditional logic inside a query: categorise values, replace NULLs, avoid division by zero, turn rows into columns.',
    body: [
      { p: '`CASE` is SQL\'s if/else. The **searched** form tests a condition per branch; the **simple** form compares one expression to values. Branches are checked in order and the first true one wins; without `ELSE`, the result is NULL.' },
      { sql: "select name, price,\n       case\n         when price >= 500 then 'premium'\n         when price >= 30  then 'mid'\n         else 'budget'\n       end as tier,\n       case category\n         when 'bikes' then 'B'\n         when 'parts' then 'P'\n         else 'A'\n       end as code\nfrom products\norder by price desc;", title: 'Searched and simple CASE' },
      {
        table: {
          head: ['Function', 'Returns', 'Typical use'],
          rows: [
            ['`coalesce(a, b, …)`', 'first non-NULL argument', 'defaults: `coalesce(email, \'unknown\')`'],
            ['`nullif(a, b)`', 'NULL if a = b, else a', 'safe division: `x / nullif(y, 0)`; turn \'\' into NULL'],
            ['`greatest(a, b, …)` / `least`', 'largest / smallest argument', 'clamping: `greatest(price - discount, 0)`'],
            ['`CASE … END`', 'value of the first true branch', 'anything else'],
          ],
        },
      },
      { sql: "select first_name,\n       coalesce(email, 'no-email')     as email,\n       nullif(city, 'Paris')           as city_unless_paris,\n       greatest(customer_id * 10, 25)  as at_least_25\nfrom customers;", title: 'COALESCE, NULLIF, GREATEST' },
      { h: 'Conditional aggregation and pivots' },
      { p: 'Putting a condition **inside** an aggregate counts or sums only the matching rows. One aggregate per value turns rows into columns: a pivot.' },
      { sql: "select date_trunc('month', ordered_at)::date as month,\n       coalesce(sum(revenue) filter (where category = 'bikes'), 0)        as bikes,\n       coalesce(sum(revenue) filter (where category = 'accessories'), 0)  as accessories,\n       sum(case when category = 'parts' then revenue else 0 end)          as parts\nfrom order_lines\nwhere status <> 'cancelled'\ngroup by 1\norder by 1;", title: 'Pivot: revenue per month and category', note: 'Two equivalent styles: `FILTER (WHERE …)` (PostgreSQL, DuckDB) and `SUM(CASE WHEN …)` (everywhere).' },
      { callout: 'trap', text: 'A CASE without ELSE returns NULL for unmatched rows. In a sum that\'s harmless, but in a label it creates a mysterious NULL category. Always write the ELSE.' },
    ],
    practice: [
      { q: 'Label each customer `new` if they signed up after 1 March 2026, else `existing`. Columns: `first_name`, `segment`.', solution: "select first_name, case when signup_date > '2026-03-01' then 'new' else 'existing' end as segment\nfrom customers;" },
      { q: 'One row with the number of orders per status as columns `paid`, `shipped`, `cancelled`.', solution: "select count(*) filter (where status = 'paid') as paid,\n       count(*) filter (where status = 'shipped') as shipped,\n       count(*) filter (where status = 'cancelled') as cancelled\nfrom orders;" },
    ],
    interview: [
      { q: 'How do you pivot rows into columns in SQL?', a: 'Conditional aggregation: one `SUM(CASE WHEN key = \'x\' THEN value END)` (or `FILTER`) per output column, grouped by the row key. Some engines also have a PIVOT operator (Snowflake, SQL Server, BigQuery).' },
    ],
    related: ['group-by-having', 'null-logic'],
  },
];
