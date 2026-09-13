# Long-lived PowerShell worker driven by the Node server.
# Reads one JSON command per line on stdin, writes one JSON reply per line on stdout.
# Keeping a single process alive avoids ~400ms of PowerShell startup per request.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Windows.Forms

# --------------------------------------------------------------- Core Audio (master volume)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class Audio {
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumerator { }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        int NotImpl1();
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams,
                     [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    }

    // Method order here must match the COM vtable exactly.
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume {
        int RegisterControlChangeNotify(IntPtr pNotify);
        int UnregisterControlChangeNotify(IntPtr pNotify);
        int GetChannelCount(out int pnChannelCount);
        int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        int GetMasterVolumeLevel(out float pfLevelDB);
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
        int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    static IAudioEndpointVolume Endpoint() {
        IMMDeviceEnumerator de = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
        IMMDevice dev;
        Marshal.ThrowExceptionForHR(de.GetDefaultAudioEndpoint(0, 1, out dev)); // eRender, eMultimedia
        Guid iid = typeof(IAudioEndpointVolume).GUID;
        object o;
        Marshal.ThrowExceptionForHR(dev.Activate(ref iid, 23, IntPtr.Zero, out o)); // CLSCTX_ALL
        return (IAudioEndpointVolume)o;
    }

    public static int GetVolume() {
        float v;
        Marshal.ThrowExceptionForHR(Endpoint().GetMasterVolumeLevelScalar(out v));
        return (int)Math.Round(v * 100f);
    }

    public static void SetVolume(int percent) {
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;
        Guid g = Guid.Empty;
        Marshal.ThrowExceptionForHR(Endpoint().SetMasterVolumeLevelScalar(percent / 100f, ref g));
    }

    public static bool GetMute() {
        bool m;
        Marshal.ThrowExceptionForHR(Endpoint().GetMute(out m));
        return m;
    }

    public static void SetMute(bool mute) {
        Guid g = Guid.Empty;
        Marshal.ThrowExceptionForHR(Endpoint().SetMute(mute, ref g));
    }
}
"@

# --------------------------------------------------------------- Window helpers
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class Win {
    delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr p);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr p);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int idx);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);

    public class Entry {
        public long Handle;
        public int Pid;
        public string Title;
    }

    static string Text(IntPtr h) { var sb = new StringBuilder(512); GetWindowTextW(h, sb, sb.Capacity); return sb.ToString(); }
    static string Cls(IntPtr h) { var sb = new StringBuilder(256); GetClassNameW(h, sb, sb.Capacity); return sb.ToString(); }

    // Enumerates real top-level application windows. Store apps are hosted by
    // ApplicationFrameHost, so their CoreWindow child is consulted to find the
    // process that actually owns the app - otherwise every Store app would be
    // reported (and closed) as the single shared host process.
    public static List<Entry> TopLevel() {
        var list = new List<Entry>();
        EnumWindows((h, l) => {
            if (!IsWindowVisible(h)) return true;
            if (GetWindow(h, 4) != IntPtr.Zero) return true;           // GW_OWNER - popups, dialogs
            if ((GetWindowLong(h, -20) & 0x00000080) != 0) return true; // WS_EX_TOOLWINDOW

            string title = Text(h);
            if (string.IsNullOrWhiteSpace(title)) return true;

            string cls = Cls(h);
            if (cls == "Progman" || cls == "Shell_TrayWnd" || cls == "WorkerW") return true;

            uint pid;
            GetWindowThreadProcessId(h, out pid);

            if (cls == "ApplicationFrameWindow") {
                uint real = 0;
                uint hostPid = pid;
                EnumChildWindows(h, (c, l2) => {
                    if (Cls(c) == "Windows.UI.Core.CoreWindow") {
                        uint p2;
                        GetWindowThreadProcessId(c, out p2);
                        if (p2 != hostPid) { real = p2; return false; }
                    }
                    return true;
                }, IntPtr.Zero);
                if (real != 0) pid = real;
            }

            list.Add(new Entry { Handle = h.ToInt64(), Pid = (int)pid, Title = title });
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static void Focus(IntPtr h) {
        if (IsIconic(h)) { ShowWindow(h, 9); }  // SW_RESTORE
        SetForegroundWindow(h);
    }
}
"@

$wshell = New-Object -ComObject WScript.Shell

# Windows shell components that own a titled top-level window but are not apps.
$shellHosts = @(
    'TextInputHost', 'ApplicationFrameHost', 'SearchHost', 'SearchApp',
    'StartMenuExperienceHost', 'ShellExperienceHost', 'LockApp'
)

# Virtual-key codes delivered through SendKeys for media transport control.
$mediaKeys = @{
    'playpause' = 0xB3
    'next'      = 0xB0
    'prev'      = 0xB1
    'stop'      = 0xB2
    'volup'     = 0xAF
    'voldown'   = 0xAE
    'mutekey'   = 0xAD
}

function Invoke-Command-Line($req) {
    switch ($req.cmd) {

        'ping' { return @{ ok = $true; pong = $true } }

        'launch' {
            if ($req.method -eq 'aumid') {
                Start-Process 'explorer.exe' -ArgumentList "shell:appsFolder\$($req.target)"
            }
            else {
                # Start-Process on the .lnk honours its arguments and working directory.
                $wd = $null
                try { $wd = Split-Path -Parent $req.target } catch { }
                if ($wd -and (Test-Path -LiteralPath $wd)) {
                    Start-Process -FilePath $req.target -WorkingDirectory $wd
                } else {
                    Start-Process -FilePath $req.target
                }
            }
            return @{ ok = $true }
        }

        'running' {
            $out = foreach ($w in ([Win]::TopLevel() | Sort-Object Title)) {
                $p = Get-Process -Id $w.Pid -ErrorAction SilentlyContinue
                if (-not $p) { continue }
                # Shell surfaces that own a titled window but are not apps.
                if ($shellHosts -contains $p.ProcessName) { continue }
                $path = $null
                try { $path = $p.MainModule.FileName } catch { }
                @{
                    pid   = $w.Pid
                    hwnd  = $w.Handle
                    name  = $p.ProcessName
                    title = $w.Title
                    path  = $path
                    mem   = [math]::Round($p.WorkingSet64 / 1MB)
                }
            }
            return @{ ok = $true; items = @($out) }
        }

        'kill' {
            Stop-Process -Id $req.pid -Force -ErrorAction Stop
            return @{ ok = $true }
        }

        'focus' {
            # Focus the exact window the phone tapped. A Store app's owning
            # process reports no MainWindowHandle, so the handle must come from
            # the running list rather than from the process object.
            $h = [IntPtr][int64]$req.hwnd
            if ($h -eq [IntPtr]::Zero) {
                $p = Get-Process -Id $req.pid -ErrorAction Stop
                $h = $p.MainWindowHandle
            }
            [Win]::Focus($h) | Out-Null
            return @{ ok = $true }
        }

        'status' {
            return @{
                ok     = $true
                volume = [Audio]::GetVolume()
                muted  = [Audio]::GetMute()
                host   = $env:COMPUTERNAME
                user   = $env:USERNAME
            }
        }

        'volume' {
            [Audio]::SetVolume([int]$req.value)
            return @{ ok = $true; volume = [Audio]::GetVolume() }
        }

        'mute' {
            $target = if ($null -ne $req.value) { [bool]$req.value } else { -not [Audio]::GetMute() }
            [Audio]::SetMute($target)
            return @{ ok = $true; muted = [Audio]::GetMute() }
        }

        'media' {
            $vk = $mediaKeys[[string]$req.key]
            if (-not $vk) { return @{ ok = $false; error = "unknown media key" } }
            $wshell.SendKeys([char]$vk)
            return @{ ok = $true }
        }

        'type' {
            # SendKeys treats these as control characters, so they must be escaped.
            $text = [string]$req.text
            $escaped = $text -replace '([+^%~(){}\[\]])', '{$1}'
            $wshell.SendKeys($escaped)
            return @{ ok = $true }
        }

        'key' {
            $wshell.SendKeys([string]$req.value)
            return @{ ok = $true }
        }

        'power' {
            switch ($req.action) {
                'lock'     { Start-Process 'rundll32.exe' -ArgumentList 'user32.dll,LockWorkStation' }
                'sleep'    { Start-Process 'rundll32.exe' -ArgumentList 'powrprof.dll,SetSuspendState 0,1,0' }
                'shutdown' { Start-Process 'shutdown.exe' -ArgumentList '/s', '/t', '20' -WindowStyle Hidden }
                'restart'  { Start-Process 'shutdown.exe' -ArgumentList '/r', '/t', '20' -WindowStyle Hidden }
                'cancel'   { Start-Process 'shutdown.exe' -ArgumentList '/a' -WindowStyle Hidden }
                default    { return @{ ok = $false; error = "unknown power action" } }
            }
            return @{ ok = $true }
        }

        default { return @{ ok = $false; error = "unknown command: $($req.cmd)" } }
    }
}

# Signal readiness so Node knows the runtime has finished compiling the Add-Type blocks.
[Console]::Out.WriteLine('{"ready":true}')
[Console]::Out.Flush()

while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $id = 0
    try {
        $req = $line | ConvertFrom-Json
        $id = $req.id
        $res = Invoke-Command-Line $req
    }
    catch {
        $res = @{ ok = $false; error = $_.Exception.Message }
    }

    $res['id'] = $id
    try {
        [Console]::Out.WriteLine(($res | ConvertTo-Json -Depth 6 -Compress))
    }
    catch {
        [Console]::Out.WriteLine("{""id"":$id,""ok"":false,""error"":""serialization failed""}")
    }
    [Console]::Out.Flush()
}
