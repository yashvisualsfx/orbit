'use strict';

const { spawn, spawnSync } = require('child_process');

/*
 * The packaged agent has no console, so the few things it needs to say are said
 * with the two facilities Windows always has: the default browser and a message
 * box. Everything else goes to the log file.
 */

/** Opens a URL in the user's default browser. */
function openUrl(url) {
  // Pass the URL directly to Explorer/the Windows shell. Avoid cmd.exe parsing:
  // pairing URLs contain query separators (&) and a fragment (#) that must survive.
  const child = spawn('explorer.exe', [url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

/** Shows a modal message box and waits for it to be dismissed. */
function message(text, title = 'Orbit') {
  const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show(${quote(text)}, ${quote(title)}) | Out-Null`,
    ],
    { windowsHide: true }
  );
}

module.exports = { message, openUrl };
