/* SCREENINGS4U LEARNING CENTER — COURSE PLAYER */
(() => {
  "use strict";
  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase library is unavailable.");
  }
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.sessionStorage,
      storageKey: "s4u-training-auth-session"
    }
  });
  window.screenings4uSupabase = client;
  window.supabaseClient = client;
  window.LMS = window.LMS || {};
  window.LMS.ready = (async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data?.session || null;
    if (!session?.user) {
      const returnTo = encodeURIComponent(location.pathname + location.search);
      location.replace(`training-login.html?returnTo=${returnTo}`);
      throw new Error("Authentication required.");
    }
    return { client, session, user: session.user };
  })();
})();

(function () {
  "use strict";

  var TABLES = Object.freeze({
    enrollments: "lms_enrollments",
    courses: "lms_courses",
    sections: "lms_sections",
    lessons: "lms_lessons",
    blocks: "lms_content_blocks",
    media: "lms_media",
    quizzes: "lms_quizzes",
    assessments: "lms_assessments",
    lessonProgress: "lms_lesson_progress",
    blockProgress: "lms_block_progress"
  });

  var state = {
    db: null,
    user: null,
    enrollment: null,
    course: null,
    sections: [],
    lessons: [],
    progress: new Map(),
    blockProgress: new Map(),
    blocksByLesson: new Map(),
    mediaById: new Map(),
    quizzesByLesson: new Map(),
    assessmentsByLesson: new Map(),
    currentIndex: 0,
    renderingLesson: false
  };

  document.addEventListener("DOMContentLoaded", function () {
    initialize().catch(function (error) {
      console.error("[LMS Course Player]", error);
      showError(error);
    });
  });


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initialize() {
    if (!window.LMS || !window.LMS.ready) {
      throw new Error("Shared LMS authentication is unavailable.");
    }

    var auth = await window.LMS.ready;

    state.db = auth.client;
    state.user = auth.user;

    if (!state.db || typeof state.db.from !== "function") {
      throw new Error("Supabase client is unavailable.");
    }

    injectRuntimeStyles();
    ensureLessonContentHost();

    var params = new URLSearchParams(window.location.search);

    var courseId =
      params.get("course") ||
      params.get("course_id") ||
      "";

    var enrollmentId =
      params.get("enrollment") ||
      params.get("enrollment_id") ||
      "";

    var lessonId =
      params.get("lesson") ||
      params.get("lesson_id") ||
      "";

    await loadEnrollment(courseId, enrollmentId);
    await loadCourse();
    await loadCurriculum();
    await loadLessonContent();
    await loadProgress();

    if (lessonId) {
      var requested =
        state.lessons.findIndex(function (lesson) {
          return lesson.id === lessonId;
        });

      if (
        requested >= 0 &&
        canOpenLesson(requested)
      ) {
        state.currentIndex = requested;
      } else {
        state.currentIndex = firstIncompleteIndex();
      }
    } else {
      state.currentIndex = firstIncompleteIndex();
    }

    renderCourseHeader();
    renderCurriculum();
    bindNavigation();

    await renderCurrentLesson(false);

    exposePlayerApi();
  }


  /* ============================================================
     AUTHORIZED ENROLLMENT
     ============================================================ */

  async function loadEnrollment(courseId, enrollmentId) {
    var query =
      state.db
        .from(TABLES.enrollments)
        .select("*")
        .eq("user_id", state.user.id);

    if (enrollmentId) {
      query = query.eq("id", enrollmentId);
    } else if (courseId) {
      query = query.eq("course_id", courseId);
    } else {
      throw new Error("A course or enrollment ID is required.");
    }

    var result =
      await query
        .in("status", ["active", "completed"])
        .order(
          "last_activity_at",
          {
            ascending: false,
            nullsFirst: false
          }
        )
        .limit(1)
        .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        "You do not have an active enrollment for this course."
      );
    }

    if (
      courseId &&
      result.data.course_id !== courseId
    ) {
      throw new Error(
        "This enrollment does not belong to the requested course."
      );
    }

    state.enrollment = result.data;
  }


  /* ============================================================
     COURSE
     ============================================================ */

  async function loadCourse() {
    var result =
      await state.db
        .from(TABLES.courses)
        .select("*")
        .eq(
          "id",
          state.enrollment.course_id
        )
        .eq(
          "status",
          "published"
        )
        .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        "This course is not currently published."
      );
    }

    state.course = result.data;
  }


  /* ============================================================
     PUBLISHED CURRICULUM
     ============================================================ */

  async function loadCurriculum() {
    var sectionResult =
      await state.db
        .from(TABLES.sections)
        .select("*")
        .eq(
          "course_id",
          state.course.id
        )
        .eq(
          "is_published",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true
          }
        );

    if (sectionResult.error) {
      throw sectionResult.error;
    }

    state.sections =
      sectionResult.data || [];

    var sectionIds =
      state.sections.map(
        function (section) {
          return section.id;
        }
      );

    if (!sectionIds.length) {
      state.lessons = [];
      return;
    }

    var lessonResult =
      await state.db
        .from(TABLES.lessons)
        .select("*")
        .in(
          "section_id",
          sectionIds
        )
        .eq(
          "status",
          "published"
        )
        .order(
          "sort_order",
          {
            ascending: true
          }
        );

    if (lessonResult.error) {
      throw lessonResult.error;
    }

    var sectionOrder =
      new Map(
        state.sections.map(
          function (section, index) {
            return [
              section.id,
              index
            ];
          }
        )
      );

    state.lessons =
      (lessonResult.data || [])
        .sort(
          function (a, b) {
            var sectionCompare =
              (sectionOrder.get(a.section_id) || 0) -
              (sectionOrder.get(b.section_id) || 0);

            if (sectionCompare !== 0) {
              return sectionCompare;
            }

            return (
              Number(a.sort_order || 0) -
              Number(b.sort_order || 0)
            );
          }
        );
  }


  /* ============================================================
     LESSON CONTENT
     ============================================================ */

  async function loadLessonContent() {
    state.blocksByLesson = new Map();
    state.mediaById = new Map();
    state.quizzesByLesson = new Map();
    state.assessmentsByLesson = new Map();

    var lessonIds =
      state.lessons.map(
        function (lesson) {
          return lesson.id;
        }
      );

    if (!lessonIds.length) {
      return;
    }

    var results =
      await Promise.all([
        state.db
          .from(TABLES.blocks)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          )
          .order(
            "sort_order",
            {
              ascending: true
            }
          ),

        state.db
          .from(TABLES.quizzes)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          ),

        state.db
          .from(TABLES.assessments)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          )
          .eq(
            "status",
            "published"
          )
      ]);

    var blockResult = results[0];
    var quizResult = results[1];
    var assessmentResult = results[2];

    if (blockResult.error) {
      throw blockResult.error;
    }

    if (quizResult.error) {
      throw quizResult.error;
    }

    if (assessmentResult.error) {
      throw assessmentResult.error;
    }

    (blockResult.data || [])
      .forEach(
        function (block) {
          if (
            !state.blocksByLesson.has(
              block.lesson_id
            )
          ) {
            state.blocksByLesson.set(
              block.lesson_id,
              []
            );
          }

          state.blocksByLesson
            .get(block.lesson_id)
            .push(block);
        }
      );

    (quizResult.data || [])
      .forEach(
        function (quiz) {
          state.quizzesByLesson.set(
            quiz.lesson_id,
            quiz
          );
        }
      );

    (assessmentResult.data || [])
      .forEach(
        function (assessment) {
          if (
            !state.assessmentsByLesson.has(
              assessment.lesson_id
            )
          ) {
            state.assessmentsByLesson.set(
              assessment.lesson_id,
              assessment
            );
          }
        }
      );

    var mediaIds =
      [
        ...new Set(
          (blockResult.data || [])
            .map(
              function (block) {
                return block.media_id;
              }
            )
            .filter(Boolean)
        )
      ];

    if (!mediaIds.length) {
      return;
    }

    var mediaResult =
      await state.db
        .from(TABLES.media)
        .select("*")
        .in(
          "id",
          mediaIds
        );

    if (mediaResult.error) {
      throw mediaResult.error;
    }

    state.mediaById =
      new Map(
        (mediaResult.data || [])
          .map(
            function (media) {
              return [
                media.id,
                media
              ];
            }
          )
      );
  }


  /* ============================================================
     PROGRESS
     ============================================================ */

  async function loadProgress() {
    state.progress = new Map();

    if (!state.lessons.length) {
      return;
    }

    var lessonIds =
      state.lessons.map(
        function (lesson) {
          return lesson.id;
        }
      );

    var result =
      await state.db
        .from(TABLES.lessonProgress)
        .select("*")
        .eq(
          "enrollment_id",
          state.enrollment.id
        )
        .in(
          "lesson_id",
          lessonIds
        );

    if (result.error) {
      throw result.error;
    }

    state.progress =
      new Map(
        (result.data || [])
          .map(
            function (row) {
              return [
                row.lesson_id,
                row
              ];
            }
          )
      );

    var blockResult =
      await state.db
        .from(TABLES.blockProgress)
        .select("*")
        .eq("enrollment_id", state.enrollment.id);

    if (blockResult.error) {
      throw blockResult.error;
    }

    state.blockProgress = new Map(
      (blockResult.data || []).map(function (row) {
        return [row.block_id, row];
      })
    );
  }


  /* ============================================================
     HEADER
     ============================================================ */

  function renderCourseHeader() {
    setText(
      ".course-player-kicker",
      "Learning Center"
    );

    setText(
      ".course-player-title",
      state.course.title ||
      "Training Course"
    );

    setText(
      ".course-player-subtitle",
      state.course.short_description ||
      state.course.description ||
      "Continue your training from where you left off."
    );

    var detailLink =
      document.querySelector(
        ".course-player-breadcrumb a[href^='lms-course-details']"
      );

    if (detailLink) {
      detailLink.textContent =
        state.course.title ||
        "Course";

      detailLink.href =
        "lms-course-details.html?course=" +
        encodeURIComponent(
          state.course.id
        );
    }

    updateProgressSummary();
  }


  /* ============================================================
     SIDEBAR CURRICULUM
     ============================================================ */

  function renderCurriculum() {
    var host =
      document.querySelector(
        ".course-player-sidebar-scroll"
      );

    if (!host) {
      return;
    }

    if (
      !state.sections.length ||
      !state.lessons.length
    ) {
      host.innerHTML =
        '<div class="course-player-runtime-empty">' +
          "No published lessons are available for this course yet." +
        "</div>";

      return;
    }

    host.innerHTML =
      state.sections
        .map(
          function (
            section,
            sectionIndex
          ) {
            var lessons =
              state.lessons.filter(
                function (lesson) {
                  return (
                    lesson.section_id ===
                    section.id
                  );
                }
              );

            if (!lessons.length) {
              return "";
            }

            var containsCurrent =
              lessons.some(
                function (lesson) {
                  return (
                    state.lessons.indexOf(
                      lesson
                    ) ===
                    state.currentIndex
                  );
                }
              );

            return `
              <div
                class="course-player-module ${containsCurrent ? "is-open" : ""}"
                data-section-id="${escapeHtml(section.id)}"
              >
                <button
                  type="button"
                  class="course-player-module-button"
                  aria-expanded="${containsCurrent ? "true" : "false"}"
                >
                  <span class="course-player-module-left">
                    <span class="course-player-module-number">
                      ${String(sectionIndex + 1).padStart(2, "0")}
                    </span>

                    <span class="course-player-module-name">
                      ${escapeHtml(
                        section.title ||
                        "Module " +
                        (sectionIndex + 1)
                      )}
                    </span>
                  </span>

                  <svg
                    class="course-player-module-chevron"
                    viewBox="0 0 24 24"
                  >
                    <path d="m6 9 6 6 6-6"></path>
                  </svg>
                </button>

                <div class="course-player-lessons">
                  ${
                    lessons
                      .map(
                        function (lesson) {
                          var index =
                            state.lessons.findIndex(
                              function (row) {
                                return (
                                  row.id ===
                                  lesson.id
                                );
                              }
                            );

                          var completed =
                            isLessonComplete(
                              lesson.id
                            );

                          var locked =
                            !canOpenLesson(
                              index
                            );

                          return `
                            <button
                              type="button"
                              class="course-player-lesson-link ${
                                index === state.currentIndex
                                  ? "is-active"
                                  : ""
                              } ${
                                completed
                                  ? "is-complete"
                                  : ""
                              } ${
                                locked
                                  ? "is-locked"
                                  : ""
                              }"
                              data-live-lesson-index="${index}"
                              ${locked ? "disabled" : ""}
                              title="${locked ? "Complete the previous required lesson first." : ""}"
                            >
                              <span class="course-player-lesson-status">
                                ${
                                  completed
                                    ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>'
                                    : locked
                                      ? "•"
                                      : ""
                                }
                              </span>

                              <span class="course-player-lesson-copy">
                                <span class="course-player-lesson-name">
                                  ${escapeHtml(
                                    lesson.title ||
                                    "Lesson"
                                  )}
                                </span>

                                <span class="course-player-lesson-meta">
                                  ${escapeHtml(
                                    lessonMeta(
                                      lesson
                                    )
                                  )}
                                </span>
                              </span>
                            </button>
                          `;
                        }
                      )
                      .join("")
                  }
                </div>
              </div>
            `;
          }
        )
        .join("");

    host
      .querySelectorAll(
        ".course-player-module-button"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            function () {
              var module =
                button.closest(
                  ".course-player-module"
                );

              if (!module) {
                return;
              }

              var open =
                module.classList.toggle(
                  "is-open"
                );

              button.setAttribute(
                "aria-expanded",
                open
                  ? "true"
                  : "false"
              );
            }
          );
        }
      );

    host
      .querySelectorAll(
        "[data-live-lesson-index]"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            function () {
              var index =
                Number(
                  button.dataset
                    .liveLessonIndex
                );

              if (
                !Number.isFinite(index) ||
                !canOpenLesson(index)
              ) {
                return;
              }

              state.currentIndex =
                index;

              renderCurriculum();

              renderCurrentLesson(true)
                .catch(
                  function (error) {
                    console.error(
                      "[LMS Course Player]",
                      error
                    );

                    showLessonRuntimeError(
                      error
                    );
                  }
                );
            }
          );
        }
      );
  }


  /* ============================================================
     NAVIGATION
     ============================================================ */

  function bindNavigation() {
    var prev =
      document.querySelector(
        "[data-course-prev]"
      );

    var next =
      document.querySelector(
        "[data-course-next]"
      );

    if (prev) {
      prev.onclick =
        function () {
          if (
            state.currentIndex > 0
          ) {
            state.currentIndex -= 1;

            renderCurriculum();

            renderCurrentLesson(true)
              .catch(
                showLessonRuntimeError
              );
          }
        };
    }

    if (next) {
      next.onclick =
        function () {
          handleNextAction()
            .catch(
              function (error) {
                console.error(
                  "[LMS Course Player]",
                  error
                );

                showLessonRuntimeError(
                  error
                );
              }
            );
        };
    }
  }


  async function handleNextAction() {
    var lesson =
      state.lessons[
        state.currentIndex
      ];

    if (!lesson) {
      return;
    }

    if (
      isLessonComplete(
        lesson.id
      )
    ) {
      if (
        state.currentIndex <
        state.lessons.length - 1
      ) {
        state.currentIndex += 1;

        renderCurriculum();

        await renderCurrentLesson(
          false
        );
      }

      return;
    }

    var interactive =
      interactiveForLesson(
        lesson
      );

    if (interactive) {
      window.location.href =
        interactive.url;

      return;
    }

    await completeCurrentLesson();
  }


  /* ============================================================
     CURRENT LESSON
     ============================================================ */

  async function renderCurrentLesson(
    scrollTop
  ) {
    if (state.renderingLesson) {
      return;
    }

    state.renderingLesson = true;

    try {
      if (!state.lessons.length) {
        setText(
          "[data-current-title]",
          "Course content is not available yet"
        );

        setText(
          "[data-current-intro]",
          "This course does not currently contain published learner lessons."
        );

        var emptyHost =
          ensureLessonContentHost();

        if (emptyHost) {
          emptyHost.innerHTML = "";
        }

        return;
      }

      state.currentIndex =
        Math.max(
          0,
          Math.min(
            state.currentIndex,
            state.lessons.length - 1
          )
        );

      var lesson =
        state.lessons[
          state.currentIndex
        ];

      var section =
        state.sections.find(
          function (row) {
            return (
              row.id ===
              lesson.section_id
            );
          }
        );

      setText(
        "[data-current-module]",
        section
          ? section.title ||
            "Module"
          : "Module"
      );

      setText(
        "[data-current-title]",
        lesson.title ||
        "Lesson"
      );

      setText(
        "[data-current-intro]",
        lesson.description ||
        "Review the lesson content below."
      );

      setText(
        "[data-current-note]",
        lesson.is_required === false
          ? "This lesson is optional."
          : "Complete this lesson to record your progress."
      );

      setText(
        "[data-current-lesson-label]",
        "Lesson " +
        (state.currentIndex + 1) +
        " · " +
        (lesson.title || "Lesson")
      );

      setText(
        "[data-current-lesson-count]",
        (state.currentIndex + 1) +
        " of " +
        state.lessons.length +
        " lessons"
      );

      await renderLessonBlocks(
        lesson
      );

      // Video lessons use a distraction-free player: the stage contains
      // the video only. Text lesson headings/intro return automatically
      // for lessons that do not contain video blocks.
      var currentBlocks =
        state.blocksByLesson.get(lesson.id) || [];
      var isVideoLesson = currentBlocks.some(function (block) {
        return String(block.block_type || "").trim().toLowerCase() === "video";
      });
      var lessonPanel = document.querySelector(".course-player-lesson-panel");
      if (lessonPanel) {
        lessonPanel.classList.toggle("is-video-lesson", isVideoLesson);
      }

      var prev =
        document.querySelector(
          "[data-course-prev]"
        );

      var next =
        document.querySelector(
          "[data-course-next]"
        );

      var nextLabel =
        document.querySelector(
          "[data-course-next-label]"
        );

      if (prev) {
        prev.disabled =
          state.currentIndex === 0;
      }

      var completed =
        isLessonComplete(
          lesson.id
        );

      var interactive =
        interactiveForLesson(
          lesson
        );

      if (next) {
        next.disabled = false;
      }

      if (nextLabel) {
        if (completed) {
          nextLabel.textContent =
            state.currentIndex ===
            state.lessons.length - 1
              ? "Course Complete"
              : "Continue";
        } else if (interactive) {
          nextLabel.textContent =
            interactive.label;
        } else {
          nextLabel.textContent =
            "Mark Lesson Complete";
        }
      }

      updateProgressSummary();

      updateCurrentLessonUrl(
        lesson
      );

      if (scrollTop) {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }

    } finally {
      state.renderingLesson = false;
    }
  }


  async function renderLessonBlocks(
    lesson
  ) {
    var host =
      ensureLessonContentHost();

    if (!host) {
      return;
    }

    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    if (!blocks.length) {
      host.innerHTML =
        '<div class="course-player-runtime-empty">' +
          "This lesson does not have any published content blocks yet." +
        "</div>";

      return;
    }

    host.innerHTML =
      '<div class="course-player-runtime-loading">Loading lesson content...</div>';

    var rendered = [];

    for (
      var index = 0;
      index < blocks.length;
      index += 1
    ) {
      rendered.push(
        await renderBlock(
          blocks[index],
          lesson
        )
      );
    }

    host.innerHTML =
      rendered.join("");

    bindBlockProgressTracking(host, lesson, blocks);
  }


  async function renderBlock(
    block,
    lesson
  ) {
    var type =
      String(
        block.block_type ||
        "text"
      )
        .trim()
        .toLowerCase();

    var title =
      block.title
        ? `<h3 class="course-player-block-title">${escapeHtml(block.title)}</h3>`
        : "";

    if (
      [
        "text",
        "article",
        "rich_text",
        "paragraph",
        "html"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-block-text">
          ${title}
          <div class="course-player-rich-text">
            ${safeRichHtml(block.content || "")}
          </div>
        </section>
      `;
    }

    if (
      [
        "heading",
        "header"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-block-heading">
          <h3>${escapeHtml(block.content || block.title || "")}</h3>
        </section>
      `;
    }

    if (
      [
        "video"
      ].includes(type)
    ) {
      return await renderVideoBlock(
        block,
        title
      );
    }

    if (
      [
        "audio"
      ].includes(type)
    ) {
      return await renderAudioBlock(
        block,
        title
      );
    }

    if (
      [
        "image"
      ].includes(type)
    ) {
      return await renderImageBlock(
        block,
        title
      );
    }

    if (
      [
        "file",
        "document",
        "download",
        "pdf"
      ].includes(type)
    ) {
      return await renderFileBlock(
        block,
        title
      );
    }

    if (
      [
        "embed"
      ].includes(type)
    ) {
      var embedUrl =
        normalizedUrl(
          block.external_url
        );

      if (!embedUrl) {
        return unavailableBlock(
          block,
          "Embedded content is unavailable."
        );
      }

      var height =
        Math.max(
          220,
          Math.min(
            900,
            Number(
              block.settings
                ?.height ||
              460
            )
          )
        );

      return `
        <section class="course-player-block">
          ${title}
          <div class="course-player-embed-frame">
            <iframe
              src="${escapeAttribute(embedUrl)}"
              title="${escapeAttribute(block.title || "Embedded lesson content")}"
              height="${height}"
              loading="lazy"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        </section>
      `;
    }

    if (
      [
        "link"
      ].includes(type)
    ) {
      var linkUrl =
        normalizedUrl(
          block.external_url
        );

      if (!linkUrl) {
        return unavailableBlock(
          block,
          "The resource link is unavailable."
        );
      }

      return `
        <section class="course-player-block course-player-resource-card">
          ${title}
          <p>${escapeHtml(block.content || "Open this lesson resource in a new tab.")}</p>
          <a
            class="course-player-runtime-button"
            href="${escapeAttribute(linkUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Resource
          </a>
        </section>
      `;
    }

    if (
      type === "quiz"
    ) {
      return renderQuizBlock(
        block,
        lesson
      );
    }

    if (
      [
        "assessment",
        "knowledge_check"
      ].includes(type)
    ) {
      return renderAssessmentBlock(
        block,
        lesson
      );
    }

    if (
      [
        "callout",
        "note"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-callout">
          ${title}
          <div class="course-player-rich-text">
            ${safeRichHtml(block.content || "")}
          </div>
        </section>
      `;
    }

    return `
      <section class="course-player-block course-player-block-text">
        ${title}
        <div class="course-player-rich-text">
          ${safeRichHtml(block.content || "")}
        </div>
      </section>
    `;
  }


  /* ============================================================
     MEDIA
     ============================================================ */

  async function renderVideoBlock(
    block,
    title
  ) {
    var media =
      block.media_id
        ? state.mediaById.get(
            block.media_id
          )
        : null;

    var provider =
      String(
        block.settings?.provider ||
        media?.provider ||
        ""
      )
        .toLowerCase();

    var source =
      block.external_url ||
      media?.playback_url ||
      media?.metadata?.embed_url ||
      media?.metadata?.original_url ||
      "";

    if (
      provider ===
      "cloudflare_stream"
    ) {
      var uid =
        block.settings
          ?.provider_video_id ||
        media
          ?.provider_video_id ||
        "";

      if (uid) {
        source =
          "https://iframe.videodelivery.net/" +
          encodeURIComponent(uid);
      }
    }

    if (
      provider === "youtube"
    ) {
      source =
        youtubeEmbedUrl(
          source ||
          media?.provider_video_id
        );
    }

    if (
      media &&
      media.storage_bucket &&
      media.storage_path &&
      provider ===
        "supabase_storage"
    ) {
      source =
        await signedMediaUrl(
          media
        );
    }

    source =
      normalizedUrl(
        source
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This video is unavailable."
      );
    }

    if (
      provider === "youtube" ||
      provider === "cloudflare_stream" ||
      looksEmbeddableVideoUrl(source)
    ) {
      return `
        <section class="course-player-block" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
          <div class="course-player-video-frame">
            <iframe
              src="${escapeAttribute(source)}"
              title="${escapeAttribute(block.title || media?.title || "Lesson video")}"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        </section>
      `;
    }

    if (
      looksDirectVideoFile(source)
    ) {
      return `
        <section class="course-player-block" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
          <video
            class="course-player-video-element"
            controls
            preload="metadata"
          >
            <source src="${escapeAttribute(source)}">
            Your browser does not support video playback.
          </video>
        </section>
      `;
    }

    return `
      <section class="course-player-block course-player-resource-card" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
        ${title}
        <p>Open the video resource in a new tab.</p>
        <a
          class="course-player-runtime-button"
          href="${escapeAttribute(source)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Video
        </a>
      </section>
    `;
  }


  async function renderAudioBlock(
    block,
    title
  ) {
    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This audio file is unavailable."
      );
    }

    return `
      <section class="course-player-block">
        ${title}
        <audio
          class="course-player-audio-element"
          controls
          preload="metadata"
          src="${escapeAttribute(source)}"
        ></audio>
      </section>
    `;
  }


  async function renderImageBlock(
    block,
    title
  ) {
    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This image is unavailable."
      );
    }

    return `
      <figure class="course-player-block course-player-image-block">
        ${title}
        <img
          src="${escapeAttribute(source)}"
          alt="${escapeAttribute(block.title || "Lesson image")}"
          loading="lazy"
        >
      </figure>
    `;
  }


  async function renderFileBlock(
    block,
    title
  ) {
    var media =
      block.media_id
        ? state.mediaById.get(
            block.media_id
          )
        : null;

    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This file is unavailable."
      );
    }

    var label =
      block.title ||
      media?.title ||
      media?.original_filename ||
      "Download Resource";

    return `
      <section class="course-player-block course-player-resource-card" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="file">
        ${title}
        ${
          block.content
            ? `<p>${escapeHtml(block.content)}</p>`
            : ""
        }
        <a
          class="course-player-runtime-button"
          href="${escapeAttribute(source)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(label)}
        </a>
      </section>
    `;
  }


  async function blockMediaUrl(
    block
  ) {
    if (
      block.external_url
    ) {
      return normalizedUrl(
        block.external_url
      );
    }

    if (
      !block.media_id
    ) {
      return "";
    }

    var media =
      state.mediaById.get(
        block.media_id
      );

    if (!media) {
      return "";
    }

    if (
      media.playback_url
    ) {
      return normalizedUrl(
        media.playback_url
      );
    }

    return await signedMediaUrl(
      media
    );
  }


  async function signedMediaUrl(
    media
  ) {
    if (
      !media ||
      !media.storage_bucket ||
      !media.storage_path
    ) {
      return "";
    }

    try {
      var result =
        await state.db
          .storage
          .from(
            media.storage_bucket
          )
          .createSignedUrl(
            media.storage_path,
            60 * 60
          );

      if (result.error) {
        throw result.error;
      }

      return (
        result.data?.signedUrl ||
        ""
      );

    } catch (error) {
      console.error(
        "[LMS Course Player] signed media",
        error
      );

      return "";
    }
  }


  /* ============================================================
     QUIZ / ASSESSMENT LINKS
     ============================================================ */

  function renderQuizBlock(
    block,
    lesson
  ) {
    var quiz =
      quizForBlock(
        block,
        lesson
      );

    if (!quiz) {
      return unavailableBlock(
        block,
        "This quiz is not available yet."
      );
    }

    var url =
      quizUrl(
        quiz,
        lesson
      );

    return `
      <section class="course-player-block course-player-interactive-card">
        <span class="course-player-interactive-kicker">Knowledge Check</span>
        <h3>${escapeHtml(block.title || quiz.title || "Quiz")}</h3>
        <p>${escapeHtml(quiz.description || block.content || "Complete this quiz to continue your training.")}</p>
        <a class="course-player-runtime-button" href="${escapeAttribute(url)}">
          Start Quiz
        </a>
      </section>
    `;
  }


  function renderAssessmentBlock(
    block,
    lesson
  ) {
    var assessment =
      assessmentForBlock(
        block,
        lesson
      );

    if (!assessment) {
      return unavailableBlock(
        block,
        "This assessment is not available yet."
      );
    }

    var url =
      assessmentUrl(
        assessment,
        lesson
      );

    return `
      <section class="course-player-block course-player-interactive-card">
        <span class="course-player-interactive-kicker">Assessment</span>
        <h3>${escapeHtml(block.title || assessment.title || "Assessment")}</h3>
        <p>${escapeHtml(assessment.description || block.content || "Complete this assessment to continue.")}</p>
        <a class="course-player-runtime-button" href="${escapeAttribute(url)}">
          Open Assessment
        </a>
      </section>
    `;
  }


  function quizForBlock(
    block,
    lesson
  ) {
    var configuredId =
      block.settings
        ?.quiz_id ||
      block.settings
        ?.record_id ||
      "";

    var byLesson =
      state.quizzesByLesson.get(
        lesson.id
      );

    if (
      byLesson &&
      (
        !configuredId ||
        byLesson.id === configuredId
      )
    ) {
      return byLesson;
    }

    return byLesson || null;
  }


  function assessmentForBlock(
    block,
    lesson
  ) {
    var configuredId =
      block.settings
        ?.assessment_id ||
      block.settings
        ?.record_id ||
      "";

    var byLesson =
      state.assessmentsByLesson.get(
        lesson.id
      );

    if (
      byLesson &&
      (
        !configuredId ||
        byLesson.id === configuredId
      )
    ) {
      return byLesson;
    }

    return byLesson || null;
  }


  function quizUrl(
    quiz,
    lesson
  ) {
    var params =
      new URLSearchParams();

    params.set(
      "quiz",
      quiz.id
    );

    params.set(
      "lesson",
      lesson.id
    );

    params.set(
      "course",
      state.course.id
    );

    params.set(
      "enrollment",
      state.enrollment.id
    );

    return (
      "lms-quiz.html?" +
      params.toString()
    );
  }


  function assessmentUrl(
    assessment,
    lesson
  ) {
    var params =
      new URLSearchParams();

    params.set(
      "assessment",
      assessment.id
    );

    params.set(
      "lesson",
      lesson.id
    );

    params.set(
      "course",
      state.course.id
    );

    params.set(
      "enrollment",
      state.enrollment.id
    );

    return (
      "lms-assessment.html?" +
      params.toString()
    );
  }


  function interactiveForLesson(
    lesson
  ) {
    if (!lesson) {
      return null;
    }

    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    var assessmentBlock =
      blocks.find(
        function (block) {
          return [
            "assessment",
            "knowledge_check"
          ].includes(
            String(
              block.block_type ||
              ""
            ).toLowerCase()
          );
        }
      );

    if (assessmentBlock) {
      var assessment =
        assessmentForBlock(
          assessmentBlock,
          lesson
        );

      if (assessment) {
        return {
          label:
            "Open Assessment",
          url:
            assessmentUrl(
              assessment,
              lesson
            )
        };
      }
    }

    var quizBlock =
      blocks.find(
        function (block) {
          return (
            String(
              block.block_type ||
              ""
            ).toLowerCase() ===
            "quiz"
          );
        }
      );

    if (quizBlock) {
      var quiz =
        quizForBlock(
          quizBlock,
          lesson
        );

      if (quiz) {
        return {
          label:
            "Start Quiz",
          url:
            quizUrl(
              quiz,
              lesson
            )
        };
      }
    }

    return null;
  }


  /* ============================================================
     COMPLETE LESSON
     ============================================================ */

  async function completeCurrentLesson() {
    var lesson =
      state.lessons[
        state.currentIndex
      ];

    if (!lesson) {
      return;
    }

    await saveLessonProgressRecord(
      lesson.id,
      100
    );

    await updateEnrollmentProgress();

    renderCurriculum();

    /*
      Completing a lesson and navigating to the next lesson are separate
      actions. This prevents the Continue button from awarding completion
      and skipping forward in the same click.
    */
    await renderCurrentLesson(false);
  }


  async function saveLessonProgressRecord(
    lessonId,
    percent
  ) {
    var lesson =
      state.lessons.find(
        function (row) {
          return (
            row.id ===
            lessonId
          );
        }
      );

    if (!lesson) {
      throw new Error(
        "The lesson is not part of this published course."
      );
    }

    var now =
      new Date().toISOString();

    var completed =
      Number(percent || 0) >= 100;

    var existing =
      state.progress.get(
        lesson.id
      );

    var payload = {
      enrollment_id:
        state.enrollment.id,

      lesson_id:
        lesson.id,

      progress_percent:
        completed
          ? 100
          : Math.max(
              0,
              Math.min(
                100,
                Number(percent || 0)
              )
            ),

      last_position_seconds:
        Number(
          existing
            ?.last_position_seconds ||
          0
        ),

      started_at:
        existing?.started_at ||
        now,

      completed_at:
        completed
          ? now
          : existing?.completed_at ||
            null,

      last_activity_at:
        now,

      updated_at:
        now
    };

    var result;

    if (
      existing &&
      existing.id
    ) {
      result =
        await state.db
          .from(TABLES.lessonProgress)
          .update(payload)
          .eq(
            "id",
            existing.id
          )
          .eq(
            "enrollment_id",
            state.enrollment.id
          )
          .select("*")
          .maybeSingle();

    } else {
      result =
        await state.db
          .from(TABLES.lessonProgress)
          .insert(payload)
          .select("*")
          .maybeSingle();
    }

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        existing && existing.id
          ? "Lesson progress could not be updated. The record may be blocked by the current Supabase policy or no longer exists."
          : "Lesson progress could not be created. Supabase did not return the new progress record."
      );
    }

    state.progress.set(
      lesson.id,
      result.data
    );

    return result.data;
  }


  async function updateEnrollmentProgress() {
    var rpcResult = await state.db.rpc(
      "lms_refresh_enrollment_progress",
      { p_enrollment_id: state.enrollment.id }
    );

    if (rpcResult.error) {
      throw rpcResult.error;
    }

    var enrollmentResult = await state.db
      .from(TABLES.enrollments)
      .select("*")
      .eq("id", state.enrollment.id)
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (enrollmentResult.error) {
      throw enrollmentResult.error;
    }

    if (enrollmentResult.data) {
      state.enrollment = enrollmentResult.data;
    }

    updateProgressSummary();
    return Number(rpcResult.data || state.enrollment.progress_percent || 0);
  }


  async function saveBlockProgressRecord(blockId, percent) {
    var existing = state.blockProgress.get(blockId);
    var now = new Date().toISOString();
    var completed = Number(percent || 0) >= 100;
    var payload = {
      enrollment_id: state.enrollment.id,
      block_id: blockId,
      progress_percent: completed ? 100 : Math.max(0, Math.min(100, Number(percent || 0))),
      last_position_seconds: Number(existing?.last_position_seconds || 0),
      completed_at: completed ? (existing?.completed_at || now) : (existing?.completed_at || null),
      updated_at: now
    };

    var result;
    if (existing?.id) {
      result = await state.db.from(TABLES.blockProgress).update(payload)
        .eq("id", existing.id).eq("enrollment_id", state.enrollment.id)
        .select("*").maybeSingle();
    } else {
      result = await state.db.from(TABLES.blockProgress).insert(payload)
        .select("*").maybeSingle();
    }
    if (result.error) throw result.error;
    if (result.data) state.blockProgress.set(blockId, result.data);
    return result.data;
  }


  function bindBlockProgressTracking(host, lesson, blocks) {
    var byId = new Map(blocks.map(function (b) { return [b.id, b]; }));
    host.querySelectorAll("[data-lms-block-id]").forEach(function (node) {
      var blockId = node.getAttribute("data-lms-block-id");
      var block = byId.get(blockId);
      if (!block) return;

      var finish = async function () {
        try {
          await saveBlockProgressRecord(blockId, 100);
        } catch (error) {
          console.error("[LMS Course Player] block progress", error);
        }
      };

      node.querySelectorAll("a.course-player-runtime-button").forEach(function (link) {
        link.addEventListener("click", finish, { once: true });
      });

      node.querySelectorAll("video,audio").forEach(function (media) {
        media.addEventListener("ended", finish, { once: true });
      });
    });
  }

  /* ============================================================
     PLAYER API FOR QUIZ RUNTIME
     ============================================================ */

  function exposePlayerApi() {
    window.Screenings4uLMSPlayer = {
      saveLessonProgress:
        async function (
          lessonId,
          progressPercent
        ) {
          var saved =
            await saveLessonProgressRecord(
              lessonId,
              progressPercent == null
                ? 100
                : progressPercent
            );

          await updateEnrollmentProgress();

          renderCurriculum();

          return saved;
        },

      reloadProgress:
        async function () {
          await loadProgress();
          renderCurriculum();
          updateProgressSummary();
        },

      getEnrollmentId:
        function () {
          return state.enrollment?.id || "";
        },

      getCourseId:
        function () {
          return state.course?.id || "";
        }
    };
  }


  /* ============================================================
     COMPLETION / LOCKS
     ============================================================ */

  function firstIncompleteIndex() {
    var index =
      state.lessons.findIndex(
        function (lesson) {
          return !isLessonComplete(
            lesson.id
          );
        }
      );

    return index >= 0
      ? index
      : Math.max(
          0,
          state.lessons.length - 1
        );
  }


  function isLessonComplete(
    lessonId
  ) {
    var row =
      state.progress.get(
        lessonId
      );

    return !!(
      row &&
      (
        row.completed_at ||
        Number(
          row.progress_percent ||
          0
        ) >= 100
      )
    );
  }


  function canOpenLesson(
    index
  ) {
    if (
      index <= 0
    ) {
      return true;
    }

    var lesson =
      state.lessons[index];

    if (!lesson) {
      return false;
    }

    var courseRequiresOrder = !!(
      state.course &&
      (
        state.course.navigation_mode ===
          "sequential" ||
        state.course.require_all_required_lessons ===
          true
      )
    );

    var lessonRequiresPrevious =
      lesson.lock_until_previous_complete ===
      true;

    if (
      !courseRequiresOrder &&
      !lessonRequiresPrevious
    ) {
      return true;
    }

    /*
      A later lesson remains locked until every earlier required lesson is
      complete. Optional lessons never block the learner's path.
    */
    return state.lessons
      .slice(0, index)
      .every(
        function (previous) {
          return (
            previous.is_required === false ||
            isLessonComplete(
              previous.id
            )
          );
        }
      );
  }


  function updateProgressSummary() {
    var requiredLessons =
      state.lessons.filter(
        function (lesson) {
          return (
            lesson.is_required !==
            false
          );
        }
      );

    var targetLessons =
      requiredLessons.length
        ? requiredLessons
        : state.lessons;

    var completed =
      targetLessons.filter(
        function (lesson) {
          return isLessonComplete(
            lesson.id
          );
        }
      ).length;

    var progress =
      targetLessons.length
        ? Math.round(
            (
              completed /
              targetLessons.length
            ) *
            100
          )
        : Number(
            state.enrollment
              ?.progress_percent ||
            0
          );

    progress =
      Math.max(
        0,
        Math.min(
          100,
          progress
        )
      );

    setText(
      "[data-course-progress-text]",
      progress + "%"
    );

    var fill =
      document.querySelector(
        "[data-course-progress-fill]"
      );

    if (fill) {
      fill.style.width =
        progress + "%";
    }
  }


  /* ============================================================
     DOM HOST
     ============================================================ */

  function ensureLessonContentHost() {
    var existing =
      document.getElementById(
        "coursePlayerLessonBlocks"
      );

    if (existing) {
      return existing;
    }

    var inner =
      document.querySelector(
        ".course-player-content-inner"
      );

    if (!inner) {
      return null;
    }

    var host =
      document.createElement(
        "div"
      );

    host.id =
      "coursePlayerLessonBlocks";

    host.className =
      "course-player-runtime-blocks";

    var infoCard =
      inner.querySelector(
        ".course-player-info-card"
      );

    if (infoCard) {
      inner.insertBefore(
        host,
        infoCard
      );
    } else {
      inner.appendChild(
        host
      );
    }

    return host;
  }


  /* ============================================================
     HELPERS
     ============================================================ */

  function lessonMeta(
    lesson
  ) {
    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    if (
      blocks.some(
        function (block) {
          return (
            String(
              block.block_type ||
              ""
            ).toLowerCase() ===
            "quiz"
          );
        }
      )
    ) {
      return "Quiz";
    }

    if (
      blocks.some(
        function (block) {
          return [
            "assessment",
            "knowledge_check"
          ].includes(
            String(
              block.block_type ||
              ""
            ).toLowerCase()
          );
        }
      )
    ) {
      return "Assessment";
    }

    var minutes =
      Number(
        lesson.estimated_minutes ||
        0
      );

    if (minutes > 0) {
      return (
        minutes +
        (
          minutes === 1
            ? " minute"
            : " minutes"
        )
      );
    }

    return (
      lesson.is_required === false
        ? "Optional lesson"
        : "Required lesson"
    );
  }


  function updateCurrentLessonUrl(
    lesson
  ) {
    var url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "course",
      state.course.id
    );

    url.searchParams.set(
      "enrollment",
      state.enrollment.id
    );

    url.searchParams.set(
      "lesson",
      lesson.id
    );

    history.replaceState(
      null,
      "",
      url.toString()
    );
  }


  function unavailableBlock(
    block,
    message
  ) {
    return `
      <section class="course-player-block course-player-runtime-empty">
        ${
          block.title
            ? `<strong>${escapeHtml(block.title)}</strong>`
            : ""
        }
        <span>${escapeHtml(message)}</span>
      </section>
    `;
  }


  function normalizedUrl(
    value
  ) {
    var raw =
      String(
        value ||
        ""
      ).trim();

    if (!raw) {
      return "";
    }

    try {
      var url =
        new URL(
          raw,
          window.location.href
        );

      if (
        ![
          "http:",
          "https:"
        ].includes(
          url.protocol
        )
      ) {
        return "";
      }

      return url.href;

    } catch (_) {
      return "";
    }
  }


  function youtubeEmbedUrl(
    value
  ) {
    var raw =
      String(
        value ||
        ""
      ).trim();

    if (!raw) {
      return "";
    }

    if (
      /^[A-Za-z0-9_-]{11}$/.test(
        raw
      )
    ) {
      return (
        "https://www.youtube.com/embed/" +
        raw
      );
    }

    try {
      var url =
        new URL(raw);

      if (
        url.hostname.includes(
          "youtu.be"
        )
      ) {
        var shortId =
          url.pathname
            .split("/")
            .filter(Boolean)[0];

        return shortId
          ? "https://www.youtube.com/embed/" +
              encodeURIComponent(shortId)
          : "";
      }

      if (
        url.hostname.includes(
          "youtube.com"
        )
      ) {
        if (
          url.pathname.startsWith(
            "/embed/"
          )
        ) {
          return url.href;
        }

        var id =
          url.searchParams.get(
            "v"
          );

        return id
          ? "https://www.youtube.com/embed/" +
              encodeURIComponent(id)
          : "";
      }

    } catch (_) {}

    return normalizedUrl(
      raw
    );
  }


  function looksDirectVideoFile(
    url
  ) {
    return /\.(mp4|webm|ogg)(?:$|[?#])/i
      .test(url);
  }


  function looksEmbeddableVideoUrl(
    url
  ) {
    return (
      /youtube\.com\/embed\//i.test(url) ||
      /iframe\.videodelivery\.net/i.test(url)
    );
  }


  function safeRichHtml(
    value
  ) {
    var html =
      String(
        value ||
        ""
      );

    if (!html) {
      return "";
    }

    var template =
      document.createElement(
        "template"
      );

    template.innerHTML =
      html;

    template.content
      .querySelectorAll(
        "script,style,object,embed,iframe,form,input,button,textarea,select"
      )
      .forEach(
        function (node) {
          node.remove();
        }
      );

    template.content
      .querySelectorAll("*")
      .forEach(
        function (node) {
          [
            ...node.attributes
          ].forEach(
            function (attribute) {
              var name =
                attribute.name
                  .toLowerCase();

              var value =
                String(
                  attribute.value ||
                  ""
                ).trim();

              if (
                name.startsWith(
                  "on"
                )
              ) {
                node.removeAttribute(
                  attribute.name
                );

                return;
              }

              if (
                [
                  "href",
                  "src"
                ].includes(name) &&
                /^javascript:/i.test(
                  value
                )
              ) {
                node.removeAttribute(
                  attribute.name
                );
              }
            }
          );

          if (
            node.tagName === "A"
          ) {
            node.setAttribute(
              "rel",
              "noopener noreferrer"
            );

            if (
              node.getAttribute(
                "target"
              ) === "_blank"
            ) {
              node.setAttribute(
                "rel",
                "noopener noreferrer"
              );
            }
          }
        }
      );

    return template.innerHTML;
  }


  function setText(
    selector,
    value
  ) {
    document
      .querySelectorAll(
        selector
      )
      .forEach(
        function (element) {
          element.textContent =
            value == null
              ? ""
              : String(value);
        }
      );
  }


  function escapeHtml(
    value
  ) {
    var div =
      document.createElement(
        "div"
      );

    div.textContent =
      String(
        value == null
          ? ""
          : value
      );

    return div.innerHTML;
  }


  function escapeAttribute(
    value
  ) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      );
  }


  function showLessonRuntimeError(
    error
  ) {
    console.error(
      "[LMS Course Player]",
      error
    );

    var host =
      ensureLessonContentHost();

    if (host) {
      host.innerHTML =
        '<div class="course-player-runtime-error">' +
          escapeHtml(
            error?.message ||
            "Unable to load this lesson."
          ) +
        "</div>";
    }
  }


  function showError(
    error
  ) {
    var title =
      document.querySelector(
        "[data-current-title]"
      );

    var intro =
      document.querySelector(
        "[data-current-intro]"
      );

    var note =
      document.querySelector(
        "[data-current-note]"
      );

    if (title) {
      title.textContent =
        "Unable to open this course";
    }

    if (intro) {
      intro.textContent =
        error &&
        error.message
          ? error.message
          : "Please return to My Courses and try again.";
    }

    if (note) {
      note.textContent =
        "Only published courses attached to your authenticated learner enrollment can be opened.";
    }

    var host =
      ensureLessonContentHost();

    if (host) {
      host.innerHTML = "";
    }
  }


  /* ============================================================
     RUNTIME STYLES
     ============================================================ */

  function injectRuntimeStyles() {
    if (
      document.getElementById(
        "coursePlayerRuntimeStyles"
      )
    ) {
      return;
    }

    var style =
      document.createElement(
        "style"
      );

    style.id =
      "coursePlayerRuntimeStyles";

    style.textContent = `
      .course-player-runtime-blocks{
        display:grid;
        gap:20px;
        margin-top:28px;
      }

      .course-player-block{
        min-width:0;
      }

      .course-player-block-title{
        margin:0 0 12px;
        color:#172033;
        font-size:19px;
        line-height:1.35;
      }

      .course-player-rich-text{
        color:#344054;
        font-size:15px;
        line-height:1.75;
      }

      .course-player-rich-text > :first-child{
        margin-top:0;
      }

      .course-player-rich-text > :last-child{
        margin-bottom:0;
      }

      .course-player-rich-text img{
        max-width:100%;
        height:auto;
      }

      .course-player-video-frame,
      .course-player-embed-frame{
        position:relative;
        width:100%;
        overflow:hidden;
        border:1px solid #dfe5ec;
        border-radius:14px;
        background:#0f172a;
      }

      .course-player-video-frame{
        aspect-ratio:16/9;
      }

      .course-player-video-frame iframe,
      .course-player-embed-frame iframe{
        width:100%;
        height:100%;
        display:block;
        border:0;
      }

      .course-player-embed-frame iframe{
        min-height:300px;
        background:#fff;
      }

      .course-player-video-element,
      .course-player-audio-element{
        width:100%;
        display:block;
      }

      .course-player-video-element{
        max-height:560px;
        border-radius:14px;
        background:#0f172a;
      }

      .course-player-image-block{
        margin:0;
      }

      .course-player-image-block img{
        width:auto;
        max-width:100%;
        height:auto;
        display:block;
        border-radius:14px;
      }

      .course-player-resource-card,
      .course-player-interactive-card,
      .course-player-callout{
        padding:20px;
        border:1px solid #dfe5ec;
        border-radius:14px;
        background:#f8fafc;
      }

      .course-player-resource-card p,
      .course-player-interactive-card p{
        margin:8px 0 16px;
        color:#687386;
        font-size:14px;
        line-height:1.65;
      }

      .course-player-interactive-card h3{
        margin:5px 0 0;
        color:#172033;
        font-size:20px;
      }

      .course-player-interactive-kicker{
        color:#ff6b00;
        font-size:10px;
        font-weight:850;
        letter-spacing:.1em;
        text-transform:uppercase;
      }

      .course-player-runtime-button{
        min-height:42px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:0 15px;
        border:1px solid #325aa3;
        border-radius:9px;
        background:#325aa3;
        color:#fff;
        font-size:13px;
        font-weight:800;
        text-decoration:none;
      }

      .course-player-runtime-button:hover{
        border-color:#24467f;
        background:#24467f;
        color:#fff;
      }

      .course-player-runtime-empty,
      .course-player-runtime-loading,
      .course-player-runtime-error{
        padding:18px;
        border:1px dashed #d7dee8;
        border-radius:12px;
        color:#687386;
        font-size:13px;
        line-height:1.6;
      }

      .course-player-runtime-error{
        border-color:#efc7c4;
        background:#fff5f4;
        color:#b42318;
      }

      .course-player-runtime-empty strong,
      .course-player-runtime-empty span{
        display:block;
      }

      .course-player-lesson-link.is-locked{
        opacity:.52;
        cursor:not-allowed;
      }
    `;

    document.head.appendChild(
      style
    );
  }

})();



(() => {
  "use strict";
  function initPlayerUi() {
    document.body.classList.add("lms-course-player-immersive");
    const toggle = document.querySelector("[data-curriculum-toggle]");
    const aside = document.querySelector(".course-player-sidebar");
    if (!toggle || !aside) return;

    const isMobile = () => window.innerWidth <= 980;

    const syncState = () => {
      if (isMobile()) {
        document.body.classList.remove("course-curriculum-hidden");
        const open = document.body.classList.contains("course-curriculum-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      } else {
        document.body.classList.remove("course-curriculum-open");
        const open = !document.body.classList.contains("course-curriculum-hidden");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      }
    };

    toggle.addEventListener("click", () => {
      if (isMobile()) {
        document.body.classList.toggle("course-curriculum-open");
      } else {
        document.body.classList.toggle("course-curriculum-hidden");
      }
      syncState();
    });

    aside.addEventListener("click", (event) => {
      if (isMobile() && event.target.closest(".course-player-lesson-link")) {
        document.body.classList.remove("course-curriculum-open");
        syncState();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isMobile()) {
        document.body.classList.remove("course-curriculum-open");
        syncState();
      }
    });

    window.addEventListener("resize", syncState);
    syncState();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPlayerUi);
  else initPlayerUi();
})();
