import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCommand, computeProgress, pendingHints, mergeSteps, TOTAL_LESSONS } from '../js/lab.js';
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

test('computeProgress: 0% al inicio y 100% con todos los pasos', () => {
  assert.equal(computeProgress({}).percent, 0);
  const all = Object.fromEntries(['ipconfig', 'ping', 'tracert', 'netstat', 'whoami', 'nmap-basic', 'nmap-sv', 'nmap-os', 'curl', 'smb', 'rdp', 'testnet'].map(s => [s, '2026-01-01']));
  const p = computeProgress(all);
  assert.equal(p.percent, 100);
  assert.equal(p.lessonsDone.length, TOTAL_LESSONS);
  assert.equal(p.labsDone.length, 3);
  assert.equal(p.nextLesson, null);
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
