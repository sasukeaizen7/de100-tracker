export interface MatchableCourse {
  id: number;
  udemyCourseId: number | null;
  keywords: string[];
}

export interface UdemyItem {
  udemyId?: number | null;
  title: string;
  percent: number;
}

export interface CourseMatch {
  courseId: number;
  percent: number;
  udemyTitle: string;
}

// Matches Udemy enrollments to plan courses: an exact Udemy id wins; otherwise
// every keyword phrase must appear in the (lowercased) title. If several
// enrollments match one course, the exact match and then the highest percent win.
export function matchCourses(courses: MatchableCourse[], items: UdemyItem[]): CourseMatch[] {
  const best = new Map<number, { exact: boolean; item: UdemyItem }>();

  for (const item of items) {
    const title = item.title.toLowerCase();
    for (const course of courses) {
      const exact = course.udemyCourseId != null && course.udemyCourseId === item.udemyId;
      const byKeywords = course.keywords.length > 0 && course.keywords.every((k) => title.includes(k.toLowerCase()));
      if (!exact && !byKeywords) continue;

      const current = best.get(course.id);
      const better = !current || (exact && !current.exact) || (exact === current.exact && item.percent > current.item.percent);
      if (better) best.set(course.id, { exact, item });
    }
  }

  return [...best.entries()]
    .sort(([a], [b]) => a - b)
    .map(([courseId, { item }]) => ({ courseId, percent: Math.round(item.percent), udemyTitle: item.title }));
}
