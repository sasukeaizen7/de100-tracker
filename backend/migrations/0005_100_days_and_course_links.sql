-- The program grows from 92 to 100 days, and courses link straight to their Udemy pages.

-- Replace the 1..92 CHECK constraints (auto-named, so look them up rather than guess).
do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('day_log'::regclass, 'courses'::regclass)
      and pg_get_constraintdef(oid) like '%92%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table day_log add constraint day_log_day_check check (day between 1 and 100);
alter table courses add constraint courses_start_day_check check (start_day between 1 and 100);
alter table courses add constraint courses_end_day_check check (end_day between start_day and 100);

-- Direct course pages (checked October 2026).
update courses set udemy_url = v.url
from (values
  ('sql-bootcamp',    'https://www.udemy.com/course/the-complete-sql-bootcamp/'),
  ('python-data-eng', 'https://www.udemy.com/course/python-for-data-engineers-pipelines-apis-databases-a-to-z/'),
  ('linux-mastery',   'https://www.udemy.com/course/linux-mastery/'),
  ('git-complete',    'https://www.udemy.com/course/git-complete/'),
  ('docker-mastery',  'https://www.udemy.com/course/docker-mastery/'),
  ('snowflake',       'https://www.udemy.com/course/snowflake-masterclass/'),
  ('dbt-bootcamp',    'https://www.udemy.com/course/complete-dbt-data-build-tool-bootcamp-zero-to-hero-learn-dbt/'),
  ('airflow',         'https://www.udemy.com/course/the-ultimate-hands-on-course-to-master-apache-airflow/'),
  ('spark',           'https://www.udemy.com/course/taming-big-data-with-apache-spark-hands-on/'),
  ('aws-dea',         'https://www.udemy.com/course/aws-data-engineer/'),
  ('kafka',           'https://www.udemy.com/course/apache-kafka/'),
  ('databricks',      'https://www.udemy.com/course/azure-databricks-spark-core-for-data-engineers/'),
  ('terraform',       'https://www.udemy.com/course/terraform-beginner-to-advanced/'),
  ('github-actions',  'https://www.udemy.com/course/github-actions-the-complete-guide/')
) as v(slug, url)
where courses.slug = v.slug;

-- Current Udemy titles, so the Courses page matches what you see on Udemy.
update courses set title = 'The Complete dbt Bootcamp: Zero to Hero + Certification Prep' where slug = 'dbt-bootcamp';
update courses set title = 'Taming Big Data with Apache Spark 4 and Python' where slug = 'spark';
update courses set instructor = 'EduVerse Academy' where slug = 'python-data-eng';
