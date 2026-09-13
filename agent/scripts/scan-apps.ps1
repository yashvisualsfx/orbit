# Scans installed applications and extracts high-resolution icons.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scan-apps.ps1 -IconDir <dir> -OutFile <json>
param(
    [Parameter(Mandatory = $true)][string]$IconDir,
    [Parameter(Mandatory = $true)][string]$OutFile
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

Add-Type -AssemblyName System.Drawing

# Shell thumbnail extractor - pulls the same 256px icon Explorer itself displays.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class ShellThumb {
    [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItemImageFactory {
        void GetImage([In, MarshalAs(UnmanagedType.Struct)] SIZE size, [In] int flags, [Out] out IntPtr phbm);
    }
    [StructLayout(LayoutKind.Sequential)]
    struct SIZE { public int cx; public int cy; public SIZE(int x, int y) { cx = x; cy = y; } }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern void SHCreateItemFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr pbc,
        [MarshalAs(UnmanagedType.LPStruct)] Guid riid,
        [MarshalAs(UnmanagedType.Interface)] out object ppv);

    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr hObject);

    // Copy the HBITMAP through a 32bpp ARGB buffer so the alpha channel survives.
    public static Bitmap Get(string path, int size) {
        Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
        object o;
        SHCreateItemFromParsingName(path, IntPtr.Zero, iid, out o);
        IShellItemImageFactory f = (IShellItemImageFactory)o;
        IntPtr hbm;
        f.GetImage(new SIZE(size, size), 0x00, out hbm);
        try {
            using (Bitmap src = Bitmap.FromHbitmap(hbm)) {
                Bitmap dst = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
                Rectangle r = new Rectangle(0, 0, src.Width, src.Height);
                BitmapData sd = src.LockBits(r, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                BitmapData dd = dst.LockBits(r, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                int bytes = Math.Abs(sd.Stride) * src.Height;
                byte[] buf = new byte[bytes];
                Marshal.Copy(sd.Scan0, buf, 0, bytes);
                Marshal.Copy(buf, 0, dd.Scan0, bytes);
                src.UnlockBits(sd); dst.UnlockBits(dd);
                return dst;
            }
        } finally { DeleteObject(hbm); }
    }
}
"@

function New-AppId([string]$seed) {
    $sha = [System.Security.Cryptography.SHA1]::Create()
    $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($seed.ToLowerInvariant()))
    $sha.Dispose()
    return ([System.BitConverter]::ToString($bytes) -replace '-', '').Substring(0, 12).ToLowerInvariant()
}

# Start Menu entries that are documentation, uninstallers or setup helpers rather
# than applications. Word boundaries keep real names safe: "\bhelp\b" drops
# "WinRAR help" but not "HelpDesk", and "^docs?$" leaves "Google Docs" alone.
$noisePatterns = @(
    'uninstall', 'read ?me', 'release notes', 'release history', 'licen[cs]e',
    'documentation', '\bhelp\b', '\bmanuals?\b', '\bfaqs?\b', '\btutorials?\b',
    'module docs', '^docs?$', '^more\.*$', 'user guide', 'quick ?start',
    'get(ting)? started', 'web ?site', 'home ?page', 'on the web',
    'check for updates', 'what.?s new', 'what is new', 'changelog',
    '\brepair\b', 'safe mode', 'troubleshoot', '\bsetup\b', '\binstaller\b',
    'command prompt', '^dfrgui$', '^run$', '^services$'
)
$noiseExact = @('help', 'docs', 'doc', 'support', 'faq', 'manual', 'about', 'tools', 'update')
$noiseRx = '(?i)(' + ($noisePatterns -join '|') + ')'

function Test-Noise([string]$name) {
    $n = $name.Trim()
    if ($noiseExact -contains $n.ToLowerInvariant()) { return $true }
    return ($n -match $noiseRx)
}

$apps = @{}          # lowercased name -> app record
$seenTargets = @{}   # method|target -> $true

function Add-App($name, $kind, $method, $target, $iconSource, $exe) {
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    $name = ($name -replace '\s+', ' ').Trim()
    if (Test-Noise $name) { return }

    $key = $name.ToLowerInvariant()
    if ($apps.ContainsKey($key)) { return }

    $tkey = "$method|$target".ToLowerInvariant()
    if ($seenTargets.ContainsKey($tkey)) { return }
    $seenTargets[$tkey] = $true

    $apps[$key] = [pscustomobject]@{
        id         = New-AppId $tkey
        name       = $name
        kind       = $kind
        method     = $method        # 'shell' -> Start-Process, 'aumid' -> shell:appsFolder
        target     = $target
        exe        = $exe          # resolved executable, used to match running processes
        iconSource = $iconSource
        icon       = $null
    }
}

# ------------------------------------------------- Source 1: Start Menu shortcuts
$shell = New-Object -ComObject WScript.Shell
$roots = @(
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs')
)

foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $links = Get-ChildItem -LiteralPath $root -Recurse -Filter *.lnk -ErrorAction SilentlyContinue
    foreach ($lnk in $links) {
        try {
            $sc = $shell.CreateShortcut($lnk.FullName)
            $tp = $sc.TargetPath
            if ([string]::IsNullOrWhiteSpace($tp)) { continue }
            $ext = [IO.Path]::GetExtension($tp).ToLowerInvariant()
            if ($ext -ne '.exe' -and $ext -ne '.bat' -and $ext -ne '.cmd' -and $ext -ne '.com') { continue }
            # The .lnk is both the best launch target (it carries arguments and the
            # working directory) and the best icon source.
            Add-App $lnk.BaseName 'win32' 'shell' $lnk.FullName $lnk.FullName $tp
        } catch { }
    }
}

# ------------------------------------------------- Source 2: Get-StartApps (UWP + registered AUMIDs)
$pkgIndex = @{}
try {
    foreach ($p in (Get-AppxPackage -ErrorAction SilentlyContinue)) {
        if ($p.PackageFamilyName -and $p.InstallLocation) { $pkgIndex[$p.PackageFamilyName] = $p.InstallLocation }
    }
} catch { }

# KNOWNFOLDERID GUIDs that Get-StartApps embeds in Win32 AppIDs.
$knownFolders = @{
    '6D809377-6AF0-444B-8957-A3773F02200E' = $env:ProgramW6432
    '7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E' = ${env:ProgramFiles(x86)}
    '905E63B6-C1BF-494E-B29C-65B732D3D21A' = $env:ProgramFiles
    'F38BF404-1D43-42F2-9305-67DE0B28FC23' = $env:WinDir
    'B4BFCC3A-DB2C-424C-B029-7FE99A87C641' = [Environment]::GetFolderPath('Desktop')
}

try {
    foreach ($sa in (Get-StartApps -ErrorAction SilentlyContinue)) {
        $appId = $sa.AppID
        if ([string]::IsNullOrWhiteSpace($appId)) { continue }

        if ($appId.Contains('!')) {
            # Packaged (UWP/MSIX) app - launch through the shell apps folder.
            Add-App $sa.Name 'uwp' 'aumid' $appId $appId ''
        }
        elseif ($appId -match '\.(exe|bat|cmd|com)$') {
            # Win32 entry expressed as a path; expand any KNOWNFOLDERID prefix.
            $path = $appId
            if ($path -match '^\{([0-9A-Fa-f-]+)\}\\(.*)$') {
                $base = $knownFolders[$Matches[1].ToUpperInvariant()]
                if (-not $base) { continue }
                $path = Join-Path $base $Matches[2]
            }
            if (-not (Test-Path -LiteralPath $path)) { continue }
            Add-App $sa.Name 'win32' 'shell' $path $path $path
        }
        else {
            # Bare AUMID, e.g. "AcrobatReader" or "electron.app.Slack".
            Add-App $sa.Name 'win32' 'aumid' $appId $appId ''
        }
    }
} catch { }

# ------------------------------------------------- Icon extraction
function Get-UwpLogo([string]$aumid) {
    $fam = $aumid.Split('!')[0]
    if (-not $pkgIndex.ContainsKey($fam)) { return $null }
    $install = $pkgIndex[$fam]
    $manifest = Join-Path $install 'AppxManifest.xml'
    if (-not (Test-Path -LiteralPath $manifest)) { return $null }
    try {
        [xml]$x = Get-Content -LiteralPath $manifest -ErrorAction Stop
        $appNodes = @($x.Package.Applications.Application)
        if ($appNodes.Count -eq 0) { return $null }
        $vis = $appNodes[0].VisualElements
        $logos = @($vis.Square44x44Logo, $vis.Square150x150Logo, $vis.Logo) | Where-Object { $_ }
        foreach ($logo in $logos) {
            $dir = Join-Path $install (Split-Path $logo -Parent)
            if (-not (Test-Path -LiteralPath $dir)) { continue }
            $base = [IO.Path]::GetFileNameWithoutExtension($logo)
            # Prefer unplated (transparent) assets, then the largest target size.
            $cands = Get-ChildItem -LiteralPath $dir -Filter "$base*.png" -ErrorAction SilentlyContinue |
                Sort-Object `
                    @{ Expression = { if ($_.Name -match 'altform-unplated') { 0 } else { 1 } } },
                    @{ Expression = { if ($_.Name -match 'targetsize-(\d+)') { [int]$Matches[1] } else { 0 } }; Descending = $true },
                    @{ Expression = { $_.Length }; Descending = $true }
            if ($cands) { return @($cands)[0].FullName }
        }
    } catch { }
    return $null
}

if (-not (Test-Path -LiteralPath $IconDir)) { New-Item -ItemType Directory -Path $IconDir -Force | Out-Null }

$list = @($apps.Values | Sort-Object name)
$total = $list.Count
$i = 0

foreach ($app in $list) {
    $i++
    if ($i % 25 -eq 0 -or $i -eq $total) { [Console]::Error.WriteLine("   icons $i/$total") }

    $dest = Join-Path $IconDir "$($app.id).png"
    if (Test-Path -LiteralPath $dest) { $app.icon = "$($app.id).png"; continue }

    $saved = $false

    if ($app.kind -eq 'uwp') {
        $logo = Get-UwpLogo $app.iconSource
        if ($logo) {
            try { Copy-Item -LiteralPath $logo -Destination $dest -Force; $saved = $true } catch { }
        }
    }

    if (-not $saved) {
        $parse = if ($app.method -eq 'aumid') { "shell:appsFolder\$($app.iconSource)" } else { $app.iconSource }
        try {
            $bmp = [ShellThumb]::Get($parse, 256)
            if ($bmp.Width -ge 16) {
                $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
                $saved = $true
            }
            $bmp.Dispose()
        } catch { }
    }

    if ($saved) { $app.icon = "$($app.id).png" }
}

$payload = [pscustomobject]@{
    scannedAt = (Get-Date).ToString('o')
    count     = $total
    apps      = @($list | Select-Object id, name, kind, method, target, exe, icon)
}

$json = $payload | ConvertTo-Json -Depth 5 -Compress
[IO.File]::WriteAllText($OutFile, $json, (New-Object System.Text.UTF8Encoding($false)))

# Drop icons for apps that were uninstalled or filtered out since the last scan.
$keep = @{}
foreach ($app in $list) { if ($app.icon) { $keep[$app.icon] = $true } }
$stale = Get-ChildItem -LiteralPath $IconDir -Filter *.png -ErrorAction SilentlyContinue |
         Where-Object { -not $keep.ContainsKey($_.Name) }
foreach ($f in $stale) { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue }

[Console]::Error.WriteLine("   done: $total apps, $($stale.Count) stale icons removed")
