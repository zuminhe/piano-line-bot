import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const adminHtml=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
const adminApi=readFileSync(new URL('../api/admin.js',import.meta.url),'utf8');

test('instructor can view selected unit lesson publication overview',()=>{
 assert.match(adminHtml,/id="courseOverview"/);
 assert.match(adminHtml,/action:'course_unit'/);
 assert.match(adminHtml,/點選任一課程即可讀取並編輯/);
 assert.match(adminHtml,/course-overview-item/);
 assert.match(adminApi,/req.query.action === 'course_unit'/);
 assert.match(adminApi,/listUnitLessons\(Redis.fromEnv\(\),unit\)/);
});

test('admin unit listing is authenticated and does not return playable video URLs or credentials',()=>{
 assert.ok(adminApi.indexOf("if (!authorized(req))")<adminApi.indexOf("req.query.action === 'course_unit'"));
 const start=adminApi.indexOf("if (req.query.action === 'course_unit')");
 const end=adminApi.indexOf("return res.json({plans:",start);
 const unitHandler=adminApi.slice(start,end);
 assert.match(unitHandler,/^|\n.*LESSON_NOT_FOUND|UNIT_NOT_FOUND/);
 assert.match(unitHandler,/published:l.published===true/);
 assert.doesNotMatch(unitHandler,/videoUrl|playbackId|materialsUrl|secret|token/i);
});

test('course editor requires a successful load and protects against edits to wrong lesson',()=>{
 assert.match(adminHtml,/id="saveCourseLesson" type="button" disabled/);
 assert.match(adminHtml,/courseEditorLoadedId!==id/);
 assert.match(adminHtml,/id!==currentCourseLessonId\(\)/);
 assert.match(adminHtml,/courseHasUnsavedEdits\(\)/);
 assert.match(adminHtml,/courseSaving/);
 assert.match(adminHtml,/btn.disabled=courseEditorLoadedId!==id/);
});

test('Mux raw Playback ID gets the signed prefix, lesson attachments stay centralized',()=>{
 assert.match(adminHtml,/mux:signed:'\+value/);
 assert.match(adminHtml,/materialsUrl:null/);
 assert.doesNotMatch(adminHtml,/id="courseMaterials"/);
 assert.match(adminHtml,/請勿貼入 Asset ID、Mux Signing Key/);
 assert.match(adminHtml,/coursePublished/);
 assert.match(adminHtml,/下架/);
});

test('course management link is first admin shortcut, other management preserved',()=>{
 assert.match(adminHtml,/href="#courseAdmin">課程與影片管理/);
 assert.match(adminHtml,/href="#paymentAdmin">購課驗證碼/);
 assert.match(adminHtml,/href="#memberAdmin">學員權限管理/);
 assert.match(adminHtml,/backup_personal_menu/);
 assert.match(adminHtml,/provision_test_menu/);
});

test('dropdown selection automatically loads the chosen lesson and visibly confirms reloads',()=>{
 assert.match(adminHtml,/id="loadCourseLesson"[^>]*>重新讀取目前課程<\/button>/);
 assert.match(adminHtml,/id="courseReadStatus" class="hint" role="status" aria-live="polite"/);
 assert.match(adminHtml,/function courseSelectionChanged\(unitChanged=false\)/);
 assert.match(adminHtml,/if\(unitChanged\)void refreshCourseOverview\(\);\s*void loadCourseLesson\(\);/);
 assert.match(adminHtml,/\$\('courseNumber'\)\.addEventListener\('change',\(\)=>\{courseSelectionChanged\(false\)\}\)/);
 assert.match(adminHtml,/已重新讀取/);
 assert.match(adminHtml,/if\(serial===courseLoadSerial\)btn.disabled=false/);
});
