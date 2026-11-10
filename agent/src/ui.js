'use strict';

const { spawn, spawnSync } = require('child_process');

/*
 * The packaged agent has no console, so the few things it needs to say are said
 * with the two facilities Windows always has: the default browser and a message
 * box. Everything else goes to the log file.
 */

const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Opens a URL in the user's default browser. */
function openUrl(url) {
  // Ask the Windows shell to resolve the URL through the user's default browser.
  // PowerShell keeps the pairing fragment (& and #) intact without cmd.exe parsing.
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Start-Process -FilePath ${quote(url)}`,
    ],
    { windowsHide: true, stdio: 'ignore', timeout: 10000 }
  );

  // Explorer is a fallback for machines where PowerShell cannot start.
  if (result.error || result.status !== 0) {
    const child = spawn('explorer.exe', [url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  }
}

/** Shows a modal message box and waits for it to be dismissed. */
function message(text, title = 'Orbit') {
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
