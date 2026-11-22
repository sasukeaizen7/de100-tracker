-- "Python for Data Engineers: Pipelines, APIs, Databases A to Z" no longer accepts enrollments (October 2026).
-- Replaced by a project course covering the same days' focus: APIs, Python ETL, tests, Docker, CI/CD.
-- Same slug and id, so days and progress already linked to course 2 stay valid.

update courses set
  title           = 'Data Engineering Project SQL, Python, Airflow, Docker, CI/CD',
  instructor      = 'Matthew Schembri',
  udemy_url       = 'https://www.udemy.com/course/start-your-data-engineering-journey-project-based-learning/',
  udemy_course_id = 6779671,
  keywords        = '{data engineering project}'
where slug = 'python-data-eng';
