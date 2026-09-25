import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCommand, computeProgress, pendingHints, pendingChecks, mergeSteps, applyProgressReset, TOTAL_LESSONS } from '../js/lab.js';
import { LAB_TARGET } from '../js/content.js';

const steps = cmd => runCommand(cmd).steps;

test('nmap sin objetivo o con host equivocado no cuenta', () => {
  assert.deepEqual(steps('nmap'), []);
  assert.deepEqual(steps('nmap -sV 8.8.8.8'), []);
});

test('nmap sobre el objetivo registra los pasos según los flags', () => {
  assert.deepEqual(steps(`nmap ${LAB_TARGET}`), ['nmap-basic']);
  assert.deepEqual(steps(`nmap -sV -Pn ${LAB_TARGET}`), ['nmap-basic', 'nmap-sv']);
  assert.deepEqual(steps(`nmap -A ${LAB_TARGET}`), ['nmap-basic', 'nmap-sv', 'nmap-os']);
  assert.deepEqual(steps(`nmap -oN salida.txt ${LAB_TARGET}`), ['nmap-basic']);
});

test('nmap -p filtra los puertos mostrados', () => {
  const out = runCommand(`nmap -p 445 ${LAB_TARGET}`).lines.map(l => l.text).join('\n');
  assert.match(out, /445\/tcp/);
  assert.doesNotMatch(out, /3389\/tcp/);
});

test('la salida usa la fecha actual, no una fija', () => {
  const now = new Date(2030, 0, 2, 3, 4);
  assert.match(runCommand(`nmap ${LAB_TARGET}`, { now }).lines[0].text, /2030-01-02 03:04/);
});

test('curl solo cuenta con -I contra el objetivo', () => {
  assert.deepEqual(steps(`curl http://${LAB_TARGET}`), []);
  assert.deepEqual(steps(`curl -I http://${LAB_TARGET}`), ['curl']);
  assert.deepEqual(steps('curl -I http://example.com'), []);
});

test('Test-NetConnection distingue SMB y RDP', () => {
  assert.deepEqual(steps(`Test-NetConnection -ComputerName ${LAB_TARGET} -Port 445`), ['testnet', 'smb']);
  assert.deepEqual(steps(`tnc ${LAB_TARGET} -CommonTCPPort RDP`), ['testnet', 'rdp']);
});

test('comandos desconocidos, help y cls', () => {
  assert.equal(runCommand('rm -rf /').lines[0].type, 'error');
  assert.equal(runCommand('cls').clear, true);
  assert.ok(runCommand('help').lines.length > 5);
  assert.equal(runCommand('nuclei -u x').lines[0].type, 'error');
});

test('la entrada del usuario se devuelve como texto, sin interpretarse', () => {
  const r = runCommand('<img src=x onerror=alert(1)>');
  assert.match(r.lines[0].text, /'<img'/);
});

const COMMANDS = ['ipconfig', 'ping', 'tracert', 'netstat', 'whoami', 'nmap-basic', 'nmap-sv', 'nmap-os', 'curl', 'smb', 'rdp', 'testnet'];
const QUIZ = ['q-p1-1', 'q-p1-2', 'q-p1-3', 'q-p2-1', 'q-p2-2', 'q-p2-3', 'q-p3-1', 'q-p3-2', 'q-p3-3', 'q-p4-1'];
const FLAGS = ['f-ports', 'f-web', 'f-build'];
const stepsOf = list => Object.fromEntries(list.map(s => [s, '2026-01-01']));

test('computeProgress: 0% al inicio y 100% con comandos, preguntas y reto final', () => {
  assert.equal(computeProgress({}).percent, 0);
  const p = computeProgress(stepsOf([...COMMANDS, ...QUIZ, ...FLAGS]));
  assert.equal(p.percent, 100);
  assert.equal(p.lessonsDone.length, TOTAL_LESSONS);
  assert.equal(p.labsDone.length, 3);
  assert.equal(p.nextLesson, null);
});

test('sin las preguntas, los comandos solos no completan lecciones', () => {
  const p = computeProgress(stepsOf(COMMANDS));
  assert.equal(p.percent, 0);
  assert.equal(p.labsDone.length, 3); // los labs dependen solo de la consola
  assert.deepEqual(pendingChecks(stepsOf(COMMANDS)), ['q-p1-1']);
});

test('el reto final exige haber completado todas las lecciones anteriores', () => {
  const p = computeProgress(stepsOf([...COMMANDS, ...QUIZ.slice(1), ...FLAGS]));
  assert.ok(!p.lessonsDone.includes('p4-2'));
  assert.equal(p.nextLesson.id, 'p1-1');
});

test('los labs exigen todos los pasos obligatorios', () => {
  assert.deepEqual(computeProgress({ 'nmap-basic': 'x' }).labsDone, []);
  assert.deepEqual(computeProgress({ 'nmap-basic': 'x', 'nmap-sv': 'x' }).labsDone, ['lab-1']);
  assert.deepEqual(computeProgress({ ipconfig: 'x', tracert: 'x' }).labsDone, ['lab-2']);
});

test('pendingHints sugiere los comandos de la siguiente lección', () => {
  const hints = pendingHints({ ipconfig: 'x' });
  assert.deepEqual(hints.map(h => h.step), ['ping']);
  assert.ok(hints[0].command.includes(LAB_TARGET));
});

test('mergeSteps conserva la fecha más antigua', () => {
  assert.deepEqual(mergeSteps({ a: '2026-02-01' }, { a: '2026-01-01', b: '2026-03-01' }), { a: '2026-01-01', b: '2026-03-01' });
});

test('reinicio del admin: se descartan los pasos locales anteriores y solo una vez', () => {
  const record = { steps: { ipconfig: '2026-09-24T06:16:21.000Z', whoami: '2026-09-26T10:00:00.000Z' }, completedAt: '2026-09-24T07:00:00.000Z' };
  const reset = applyProgressReset(record, '2026-09-25T00:00:00.000Z');
  assert.deepEqual(reset.steps, { whoami: '2026-09-26T10:00:00.000Z' });
  assert.equal(reset.completedAt, null);
  assert.equal(reset.resetAt, '2026-09-25T00:00:00.000Z');
  // El mismo reinicio no se vuelve a aplicar; sin reinicio no cambia nada.
  assert.equal(applyProgressReset(reset, '2026-09-25T00:00:00.000Z'), null);
  assert.equal(applyProgressReset(record, null), null);
});
