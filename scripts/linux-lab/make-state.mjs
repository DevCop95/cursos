// Arranca el Linux del laboratorio en v86 (Node), comprueba git y guarda el estado ya arrancado.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const [,, WORK, PKG, REPO] = process.argv;
const { V86 } = await import(pathToFileURL(path.join(PKG, 'build/libv86.mjs')).href);
const MEM = 128;
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const emulator = new V86({
  wasm_path: path.join(PKG, 'build/v86.wasm'),
  bios: { url: path.join(REPO, 'bios/seabios.bin') },
  vga_bios: { url: path.join(REPO, 'bios/vgabios.bin') },
  memory_size: MEM * 1024 * 1024,
  vga_memory_size: 2 * 1024 * 1024,
  autostart: true,
  bzimage_initrd_from_filesystem: true,
  cmdline: 'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable console=ttyS0 quiet',
  filesystem: { baseurl: path.join(WORK, 'flat') + '/', basefs: path.join(WORK, 'fs.json') },
});
const PROMPT = /alumno@dev101x-lab[^\n]*\$ $/;
let out = '';
let step = 0;
const clean = t => t.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '');
emulator.add_listener('serial0-output-byte', b => {
  out += String.fromCharCode(b);
  const tail = clean(out.slice(-120));
  if (step === 0 && PROMPT.test(tail)) {
    step = 1; console.log('prompt a los', secs(), 's'); out = '';
    emulator.serial0_send('git --version; echo MARCA_$((40+2))\n');
  } else if (step === 1 && out.includes('MARCA_42')) {
    step = 2; console.log('salida:', clean(out).split('\n').filter(l => /git version/.test(l)).join(' | '));
    out = '';
    emulator.serial0_send('sync; clear\n');
  } else if (step === 2 && PROMPT.test(tail)) {
    step = 3;
    setTimeout(async () => {
      const st = await emulator.save_state();
      fs.writeFileSync(path.join(WORK, 'state.bin'), new Uint8Array(st));
      console.log('estado guardado', (st.byteLength / 1e6).toFixed(1), 'MB a los', secs(), 's');
      emulator.destroy();
      process.exit(0);
    }, 1500);
  }
});
setTimeout(() => { console.log('TIMEOUT', step, clean(out).slice(-500)); process.exit(1); }, 300000);
