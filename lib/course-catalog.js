// v0.3.1 instructor-approved *draft* catalog (2026-10-23).
// 23 official listed lessons, not 32 placeholder slots. Names are source-derived,
// and this catalog does NOT claim that video/handout files have been published.
// Source IDs (1-1, 2-5...) are stable and must not be reassigned when names change.
export const COURSE_CATALOG = Object.freeze([
  {
    "id": 1,
    "name": "基礎樂理",
    "lessonCount": 6,
    "lessons": [
      {
        "id": "u1-l01",
        "sourceId": "1-1",
        "number": 1,
        "title": "彈奏姿勢",
        "videoPending": true
      },
      {
        "id": "u1-l02",
        "sourceId": "1-2",
        "number": 2,
        "title": "基礎樂理-五線譜與音名",
        "videoPending": false
      },
      {
        "id": "u1-l03",
        "sourceId": "1-3",
        "number": 3,
        "title": "基礎樂理-調性與音階",
        "videoPending": false
      },
      {
        "id": "u1-l04",
        "sourceId": "1-4",
        "number": 4,
        "title": "基礎樂理-符值與節奏",
        "videoPending": false
      },
      {
        "id": "u1-l05",
        "sourceId": "1-5",
        "number": 5,
        "title": "基礎樂理-小節與拍號",
        "videoPending": false
      },
      {
        "id": "u1-l06",
        "sourceId": "1-6",
        "number": 6,
        "title": "樂理實作練習",
        "videoPending": false
      }
    ]
  },
  {
    "id": 2,
    "name": "認識和弦",
    "lessonCount": 5,
    "lessons": [
      {
        "id": "u2-l01",
        "sourceId": "2-1",
        "number": 1,
        "title": "延音踏板",
        "videoPending": true
      },
      {
        "id": "u2-l02",
        "sourceId": "2-2",
        "number": 2,
        "title": "大小三和弦",
        "videoPending": false
      },
      {
        "id": "u2-l03",
        "sourceId": "2-3",
        "number": 3,
        "title": "柱狀和弦 - 基礎節奏",
        "videoPending": false
      },
      {
        "id": "u2-l04",
        "sourceId": "2-4",
        "number": 4,
        "title": "和弦轉位",
        "videoPending": false
      },
      {
        "id": "u2-l05",
        "sourceId": "2-5",
        "number": 5,
        "title": "複合和弦 - 指定低音",
        "videoPending": false
      }
    ]
  },
  {
    "id": 3,
    "name": "和弦變化",
    "lessonCount": 6,
    "lessons": [
      {
        "id": "u3-l01",
        "sourceId": "3-1",
        "number": 1,
        "title": "順階和弦",
        "videoPending": false
      },
      {
        "id": "u3-l02",
        "sourceId": "3-2",
        "number": 2,
        "title": "掛留和弦：Sus4",
        "videoPending": false
      },
      {
        "id": "u3-l03",
        "sourceId": "3-3",
        "number": 3,
        "title": "七和弦：小七和弦",
        "videoPending": false
      },
      {
        "id": "u3-l04",
        "sourceId": "3-4",
        "number": 4,
        "title": "和弦色彩：2音與9音",
        "videoPending": false
      },
      {
        "id": "u3-l05",
        "sourceId": "3-5",
        "number": 5,
        "title": "和弦替換公式",
        "videoPending": false
      },
      {
        "id": "u3-l06",
        "sourceId": "3-6",
        "number": 6,
        "title": "柱狀和弦 - 節奏強化",
        "videoPending": false
      }
    ]
  },
  {
    "id": 4,
    "name": "和弦應用",
    "lessonCount": 6,
    "lessons": [
      {
        "id": "u4-l01",
        "sourceId": "4-1",
        "number": 1,
        "title": "和弦配置：最高聲部",
        "videoPending": false
      },
      {
        "id": "u4-l02",
        "sourceId": "4-2",
        "number": 2,
        "title": "和弦配置：排列間距",
        "videoPending": false
      },
      {
        "id": "u4-l03",
        "sourceId": "4-3",
        "number": 3,
        "title": "和弦配置：音域選擇",
        "videoPending": false
      },
      {
        "id": "u4-l04",
        "sourceId": "4-4",
        "number": 4,
        "title": "七和弦-屬七和弦",
        "videoPending": false
      },
      {
        "id": "u4-l05",
        "sourceId": "4-5",
        "number": 5,
        "title": "複合和弦 - 簡化延伸和弦",
        "videoPending": false
      },
      {
        "id": "u4-l06",
        "sourceId": "4-6",
        "number": 6,
        "title": "柱狀和弦 - 進階變化",
        "videoPending": false
      }
    ]
  }
]);
export const OFFICIAL_LESSON_COUNT=23;
export function catalogUnit(unit){
 return Number.isInteger(unit)&&unit>=1&&unit<=4?COURSE_CATALOG[unit-1]:null;
}
export function catalogLesson(unit,number){
 return catalogUnit(unit)?.lessons.find(x=>x.number===number)||null;
}
