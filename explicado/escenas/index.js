import a01 from './a01.js?v=dev101x-v115';
import a02 from './a02.js?v=dev101x-v115';
import a03 from './a03.js?v=dev101x-v115';
import a04 from './a04.js?v=dev101x-v115';
import a05 from './a05.js?v=dev101x-v115';
import a06 from './a06.js?v=dev101x-v115';
import a07 from './a07.js?v=dev101x-v115';
import a08 from './a08.js?v=dev101x-v115';
import a09 from './a09.js?v=dev101x-v115';
import a10 from './a10.js?v=dev101x-v115';

/** OWASP Top 10 2021 (la edición que usa el curso de Web Hacking), en orden. */
export const SCENES = [a01, a02, a03, a04, a05, a06, a07, a08, a09, a10].map(s => ({ ...s, video: `videos/${s.id}.mp4` }));
