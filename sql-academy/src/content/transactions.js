export const transactions = [
  {
    id: 'transactions',
    title: 'Transactions and ACID',
    level: 'intermediate',
    summary: 'Group statements so they succeed or fail together, with savepoints to undo part of the work.',
    body: [
      { p: 'A **transaction** is a unit of work: several statements that must all succeed, or have no effect at all. Saving an order and its items is one transaction: an order without items must never be visible.' },
      {
        table: {
          head: ['Property', 'Promise', 'In the bike shop'],
          rows: [
            ['**A**tomicity', 'all or nothing', 'the order and its 3 items are saved together'],
            ['**C**onsistency', 'constraints hold after every commit', 'no item points to a missing order'],
            ['**I**solation', 'concurrent transactions don\'t see each other\'s unfinished work', 'a report never sees half an order'],
            ['**D**urability', 'once committed, it survives a crash', 'written to the write-ahead log (WAL) before COMMIT returns'],
          ],
        },
      },
      { sql: "begin;\n  insert into orders (customer_id, ordered_at, status) values (6, now(), 'paid');\n  insert into order_items values (currval('orders_order_id_seq'), 3, 1);\n  savepoint before_discount;\n  update products set price = 0.01 where product_id = 3;    -- a mistake\n  rollback to savepoint before_discount;                     -- undo only this part\n  select o.order_id, o.status, p.name, p.price\n  from orders o join order_items oi using (order_id) join products p using (product_id)\n  where o.customer_id = 6;\nrollback;   -- practice mode: undo everything (COMMIT would keep it)", title: 'BEGIN, SAVEPOINT, ROLLBACK TO, COMMIT' },
      {
        table: {
          head: ['Command', 'Effect'],
          rows: [
            ['`BEGIN`', 'start a transaction'],
            ['`COMMIT`', 'make all changes permanent and visible'],
            ['`ROLLBACK`', 'undo everything since BEGIN'],
            ['`SAVEPOINT name`', 'mark a point inside the transaction'],
            ['`ROLLBACK TO SAVEPOINT name`', 'undo back to the mark, keep the transaction open'],
            ['`RELEASE SAVEPOINT name`', 'forget the mark (keeps the work)'],
          ],
        },
      },
      { callout: 'note', title: 'Autocommit', text: 'Outside `BEGIN`, every statement is its own transaction, committed immediately. Python drivers (psycopg) do the opposite: they open a transaction for you, and nothing is saved until you call `commit()` or leave a `with conn:` block.' },
      { callout: 'trap', text: 'After an error inside a transaction, PostgreSQL refuses every further statement ("current transaction is aborted") until you `ROLLBACK` (or roll back to a savepoint). This is why a failing step in a script can make all later steps fail.' },
      { callout: 'de', text: 'Wrap each load step in a transaction: delete the partition being reloaded and insert the new data in the same transaction, so readers see either the old data or the new data, never an empty table.' },
    ],
    practice: [
      { q: 'Inside a transaction, cancel all paid orders, show how many orders are now cancelled (column `cancelled`), then roll back. The checker reads your last SELECT.', solution: "begin;\nupdate orders set status = 'cancelled' where status = 'paid';\nselect count(*) as cancelled from orders where status = 'cancelled';\nrollback;" },
    ],
    interview: [
      { q: 'Explain ACID.', a: 'Atomicity: all statements of a transaction apply or none. Consistency: constraints hold before and after. Isolation: concurrent transactions behave as if separated, to a degree set by the isolation level. Durability: committed data survives crashes (WAL).' },
    ],
    related: ['isolation-levels', 'locks', 'incremental-loads'],
  },
  {
    id: 'isolation-levels',
    title: 'Isolation levels',
    level: 'advanced',
    summary: 'How much concurrent transactions can see of each other: Read Committed by default, up to Serializable.',
    body: [
      { p: 'When two transactions run at the same time, what should each one see of the other\'s changes? Stronger isolation prevents more anomalies but can force transactions to wait or fail and retry. PostgreSQL implements isolation with **MVCC**: each transaction reads a snapshot, so readers never block writers.' },
      {
        table: {
          head: ['Anomaly', 'What goes wrong'],
          rows: [
            ['Dirty read', 'you read another transaction\'s change that is then rolled back'],
            ['Non-repeatable read', 'you read the same row twice and get different values (someone committed in between)'],
            ['Phantom read', 'the same `WHERE` returns new rows the second time'],
            ['Lost update', 'two sessions read stock = 5 and both write 4: one sale vanishes'],
            ['Write skew / serialization anomaly', 'two transactions each check a rule, both pass, together they break it'],
          ],
        },
      },
      {
        table: {
          head: ['Level', 'Dirty read', 'Non-repeatable', 'Phantom', 'Serialization anomaly', 'In PostgreSQL'],
          rows: [
            ['Read uncommitted', '~ allowed by standard', 'possible', 'possible', 'possible', 'behaves as Read committed'],
            ['**Read committed**', '+ no', 'possible', 'possible', 'possible', '**default**: each statement sees a fresh snapshot'],
            ['Repeatable read', '+ no', '+ no', '+ no in PostgreSQL', 'possible', 'one snapshot for the whole transaction'],
            ['Serializable', '+ no', '+ no', '+ no', '+ no', 'as if run one after another; retry on error 40001'],
          ],
        },
      },
      { sql: "begin isolation level repeatable read;\n  select count(*) as orders from orders;\n  -- another session could insert orders now…\n  select count(*) as orders_again from orders;   -- …this still returns the same number\ncommit;", title: 'A stable snapshot for a multi-query report' },
      { h: 'Preventing lost updates' },
      { sql: "-- risky: read, compute in the app, write back\n-- select price from products where product_id = 5;  → app computes new price → update …\n\n-- safe: one atomic statement\nupdate products set price = price + 1 where product_id = 5 returning price;\n\n-- safe: lock the row while you decide\nbegin;\n  select price from products where product_id = 5 for update;\n  update products set price = price - 1 where product_id = 5;\ncommit;", title: 'Atomic update or SELECT … FOR UPDATE' },
      { callout: 'tip', text: 'Use Repeatable Read for reports and exports that run several queries and must agree with each other. Use Serializable when correctness rules span several rows (bookings, balances), and retry on serialization failures.' },
      { callout: 'note', text: 'The browser database has a single session, so you can\'t see two transactions interfere here. To experiment, open two `psql` windows on a local PostgreSQL and run the steps alternately.' },
    ],
    practice: [
      { q: 'Write a statement that adds 2 € to the price of product 6 atomically and returns the new price as `price`.', solution: 'update products set price = price + 2 where product_id = 6 returning price;' },
    ],
    interview: [
      { q: 'What is PostgreSQL\'s default isolation level and what can still go wrong?', a: 'Read Committed. Each statement sees data committed before it began, so two statements in one transaction can see different data (non-repeatable reads, phantoms), and read-modify-write patterns can lose updates unless you use atomic updates or row locks.' },
      { q: 'What is MVCC?', a: 'Multi-Version Concurrency Control: updates create new row versions instead of overwriting, and each transaction reads the versions visible in its snapshot. Readers don\'t block writers and vice versa; old versions are cleaned up by VACUUM.' },
    ],
    related: ['transactions', 'locks'],
  },
  {
    id: 'locks',
    title: 'Locks and deadlocks',
    level: 'advanced',
    summary: 'Which statements block which, how to build a safe job queue, and how to avoid deadlocks.',
    body: [
      { p: 'Thanks to MVCC, plain reads take no row locks. Writes lock the rows they change until the transaction ends, and schema changes lock whole tables. Most "my query is stuck" problems are a transaction holding a lock and never finishing.' },
      {
        table: {
          head: ['Statement', 'Locks', 'Blocks'],
          rows: [
            ['`SELECT`', 'nothing on rows', 'only DDL like `DROP` / `ALTER` of the table'],
            ['`UPDATE` / `DELETE`', 'the changed rows', 'other writers of the same rows until commit'],
            ['`SELECT … FOR UPDATE`', 'the selected rows', 'other `FOR UPDATE` and writes on them'],
            ['`… FOR UPDATE SKIP LOCKED`', 'rows nobody else holds', '+ nothing: busy rows are skipped'],
            ['`ALTER TABLE` (most forms)', 'the whole table, exclusively', '- everything, even reads'],
            ['`CREATE INDEX`', 'blocks writes', 'use `CREATE INDEX CONCURRENTLY` in production'],
          ],
        },
      },
      { sql: "begin;\n  select order_id, ordered_at\n  from orders\n  where status = 'paid'\n  order by ordered_at\n  limit 1\n  for update skip locked;     -- each worker grabs a different order\n  -- … ship it, then:\n  -- update orders set status = 'shipped' where order_id = …;\ncommit;", title: 'A job queue in plain SQL', note: 'Several workers can run this at the same time; `SKIP LOCKED` hands each one a different row instead of making them wait.' },
      { sql: "select pid, state, wait_event_type, wait_event, left(query, 60) as query\nfrom pg_stat_activity\nwhere datname = current_database();", title: 'Who is running, who is waiting' },
      { h: 'Deadlocks' },
      { steps: [
        'Session A updates product 1 (locks row 1).',
        'Session B updates product 2 (locks row 2).',
        'A now wants row 2 → waits for B.',
        'B now wants row 1 → waits for A. Neither can continue.',
        'PostgreSQL detects the cycle after `deadlock_timeout` (1 s) and aborts one of them.',
      ] },
      { callout: 'tip', text: 'Prevent deadlocks by always locking rows in the same order (e.g. `ORDER BY id … FOR UPDATE`), keeping transactions short, and never waiting for user input inside a transaction.' },
      { callout: 'trap', text: 'A session left "idle in transaction" keeps its locks and prevents VACUUM from cleaning up. Set `idle_in_transaction_session_timeout` in production.' },
    ],
    practice: [
      { q: 'Lock and return the oldest paid order with `FOR UPDATE SKIP LOCKED` (column `order_id`).', solution: "select order_id from orders where status = 'paid'\norder by ordered_at limit 1\nfor update skip locked;" },
    ],
    interview: [
      { q: 'How would you implement a work queue in PostgreSQL?', a: 'A jobs table with a status column; workers run SELECT … WHERE status = \'ready\' ORDER BY created_at LIMIT n FOR UPDATE SKIP LOCKED inside a transaction, process the rows, update their status and commit. SKIP LOCKED lets workers proceed in parallel without blocking.' },
      { q: 'What causes a deadlock and how do you avoid it?', a: 'Two transactions each hold a lock the other needs. Avoid by acquiring locks in a consistent order, keeping transactions short, and retrying the aborted transaction.' },
    ],
    related: ['isolation-levels', 'transactions'],
  },
];
