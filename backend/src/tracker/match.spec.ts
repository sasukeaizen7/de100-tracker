import { matchCourses } from './match';

const courses = [
  { id: 1, udemyCourseId: null, keywords: ['sql bootcamp'] },
  { id: 10, udemyCourseId: null, keywords: ['aws', 'data engineer'] },
  { id: 11, udemyCourseId: 555, keywords: ['kafka'] },
];

describe('matchCourses', () => {
  it('matches by keyword phrases, case-insensitively', () => {
    expect(matchCourses(courses, [{ title: 'The Complete SQL Bootcamp: Go from Zero to Hero', percent: 42.4 }]))
      .toEqual([{ courseId: 1, percent: 42, udemyTitle: 'The Complete SQL Bootcamp: Go from Zero to Hero' }]);
  });

  it('requires every keyword', () => {
    expect(matchCourses(courses, [{ title: 'AWS Certified Solutions Architect', percent: 10 }])).toEqual([]);
    expect(matchCourses(courses, [{ title: 'AWS Certified Data Engineer Associate', percent: 10 }])).toHaveLength(1);
  });

  it('prefers an exact Udemy id over a higher-percent keyword match', () => {
    const result = matchCourses(courses, [
      { title: 'Kafka Streams deep dive', percent: 90 },
      { udemyId: 555, title: 'Apache Kafka Series', percent: 20 },
    ]);
    expect(result).toEqual([{ courseId: 11, percent: 20, udemyTitle: 'Apache Kafka Series' }]);
  });

  it('ignores unrelated courses', () => {
    expect(matchCourses(courses, [{ title: 'Italian cooking', percent: 100 }])).toEqual([]);
  });
});
