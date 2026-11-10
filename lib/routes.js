// App URLs in one place, so links and redirects can't drift apart.
export const routes = {
  login: "/login",
  courses: "/courses",
  read: (courseId) => `/courses/${courseId}/read`,
  quiz: (courseId) => `/courses/${courseId}/quiz`,
  certificate: (certificateId) => `/certificates/${certificateId}`,
  profile: (userId) => `/profile/${userId}`,
  attempt: (userId, attemptId) => `/profile/${userId}/attempts/${attemptId}`,
  admin: "/admin",
  adminCourses: "/admin/courses",
  adminCourse: (courseId) => `/admin/courses/${courseId}`,
  adminCourseQuestions: (courseId) => `/admin/courses/${courseId}/questions`,
  newCourse: "/admin/courses/new",
  people: "/admin/people",
  insights: "/admin/insights",
  trainingGroups: "/admin/training-groups",
};
