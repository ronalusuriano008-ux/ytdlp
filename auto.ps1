[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Root = "D:\ytdlp",
    [string]$ExcludedNodeModules = "D:\ytdlp\apps\api\node_modules",
    [switch]$Apply,
    [switch]$MoveLegacy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO]  $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK]    $Message" -ForegroundColor Green
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Host "[WARN]  $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        if ($Apply) {
            New-Item -ItemType Directory -Path $Path -Force | Out-Null
        }
        Write-Info "Create directory: $Path"
    }
}

function Resolve-NormalizedPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Test-IsExcluded {
    param([Parameter(Mandatory = $true)][string]$Path)

    $full = Resolve-NormalizedPath -Path $Path
    $excluded = Resolve-NormalizedPath -Path $ExcludedNodeModules

    return $full -like "$excluded*"
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Info $Description
    try {
        & $Action
        Write-Ok $Description
    }
    catch {
        Write-Err ($Description + " :: " + $_.Exception.Message)
        throw
    }
}

function Remove-PathIfExists {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        if ($Apply) {
            Remove-Item -LiteralPath $Path -Recurse -Force
        }
        Write-Info "Remove path: $Path"
    }
}

function Get-IncludedFiles {
    param([Parameter(Mandatory = $true)][string]$BasePath)

    Get-ChildItem -LiteralPath $BasePath -Recurse -File -Force -ErrorAction Stop |
        Where-Object {
            -not (Test-IsExcluded -Path $_.FullName) -and
            $_.FullName -notmatch '\\__pycache__\\' -and
            $_.Extension -ne '.pyc'
        }
}

function New-StagingCopy {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$StagingRoot
    )

    Ensure-Directory -Path $StagingRoot

    $robocopyArgs = @(
        $SourceRoot
        $StagingRoot
        "/E"
        "/R:1"
        "/W:1"
        "/NFL"
        "/NDL"
        "/NJH"
        "/NJS"
        "/NP"
        "/XD"
        $ExcludedNodeModules
        (Join-Path $SourceRoot "backups")
        (Join-Path $SourceRoot "logs")
        (Join-Path $SourceRoot "reports")
        (Join-Path $SourceRoot ".git")
        (Join-Path $SourceRoot "apps\api\storage\temp")
        (Join-Path $SourceRoot "apps\worker\storage\temp")
        (Join-Path $SourceRoot "apps\worker\src\storage\temp")
        "__pycache__"
    )

    if ($Apply) {
        $null = & robocopy @robocopyArgs
        $exitCode = $LASTEXITCODE

        if ($exitCode -ge 8) {
            throw "Robocopy failed with exit code $exitCode"
        }
    }

    Write-Info "Staging copy ready: $StagingRoot"
}

function New-BackupZipFromStaging {
    param(
        [Parameter(Mandatory = $true)][string]$StagingRoot,
        [Parameter(Mandatory = $true)][string]$BackupDir
    )

    Ensure-Directory -Path $BackupDir

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $zipPath = Join-Path $BackupDir ("backup_ytdlp_" + $timestamp + ".zip")

    if ($Apply) {
        $items = Get-ChildItem -LiteralPath $StagingRoot -Force
        if (-not $items) {
            throw "Staging folder is empty. Backup aborted."
        }

        Compress-Archive -Path (Join-Path $StagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force
    }

    Write-Info "Backup ZIP: $zipPath"
    return $zipPath
}

function Remove-PythonCaches {
    param([Parameter(Mandatory = $true)][string]$BasePath)

    $cacheDirs = Get-ChildItem -LiteralPath $BasePath -Recurse -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq "__pycache__" -and -not (Test-IsExcluded -Path $_.FullName)
        }

    foreach ($dir in $cacheDirs) {
        if ($Apply) {
            Remove-Item -LiteralPath $dir.FullName -Recurse -Force
        }
        Write-Info "Delete cache dir: $($dir.FullName)"
    }

    $pycFiles = Get-ChildItem -LiteralPath $BasePath -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Extension -eq ".pyc" -and -not (Test-IsExcluded -Path $_.FullName)
        }

    foreach ($file in $pycFiles) {
        if ($Apply) {
            Remove-Item -LiteralPath $file.FullName -Force
        }
        Write-Info "Delete pyc file: $($file.FullName)"
    }
}

function Move-ChildrenUpOneLevel {
    param(
        [Parameter(Mandatory = $true)][string]$InnerPath,
        [Parameter(Mandatory = $true)][string]$OuterPath
    )

    $children = Get-ChildItem -LiteralPath $InnerPath -Force -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        $target = Join-Path $OuterPath $child.Name

        if (Test-Path -LiteralPath $target) {
            Write-WarnMsg "Conflict skipped: $($child.FullName) -> $target"
            continue
        }

        if ($Apply) {
            Move-Item -LiteralPath $child.FullName -Destination $target -Force
        }

        Write-Info "Move: $($child.FullName) -> $target"
    }

    $remaining = Get-ChildItem -LiteralPath $InnerPath -Force -ErrorAction SilentlyContinue
    if (-not $remaining) {
        if ($Apply) {
            Remove-Item -LiteralPath $InnerPath -Force
        }
        Write-Info "Remove empty nested dir: $InnerPath"
    }
}

function Flatten-DuplicateNestedFolder {
    param(
        [Parameter(Mandatory = $true)][string]$ParentPath,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $outer = Join-Path $ParentPath $Name
    $inner = Join-Path $outer $Name

    if ((Test-Path -LiteralPath $outer) -and (Test-Path -LiteralPath $inner)) {
        Write-Info "Duplicate nested folder detected: $inner"
        Move-ChildrenUpOneLevel -InnerPath $inner -OuterPath $outer
    }
}

function Normalize-StorageLayout {
    param([Parameter(Mandatory = $true)][string]$BasePath)

    $candidateParents = @(
        (Join-Path $BasePath "apps\api\storage"),
        (Join-Path $BasePath "apps\worker\storage"),
        (Join-Path $BasePath "apps\worker\src\storage")
    )

    foreach ($parent in $candidateParents) {
        if (-not (Test-Path -LiteralPath $parent)) {
            continue
        }

        Flatten-DuplicateNestedFolder -ParentPath $parent -Name "audio"
        Flatten-DuplicateNestedFolder -ParentPath $parent -Name "videos"
        Flatten-DuplicateNestedFolder -ParentPath $parent -Name "uploads"
        Flatten-DuplicateNestedFolder -ParentPath $parent -Name "temp"
    }
}

function Report-CookiesFiles {
    param([Parameter(Mandatory = $true)][string]$BasePath)

    $cookies = @(Get-ChildItem -LiteralPath $BasePath -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -ieq "cookies.txt" -and -not (Test-IsExcluded -Path $_.FullName)
        })

    if ($cookies.Count -gt 1) {
        Write-WarnMsg "Multiple cookies.txt files found:"
        foreach ($c in $cookies) {
            Write-WarnMsg (" - " + $c.FullName)
        }
        Write-WarnMsg "They are not merged automatically to avoid breaking active paths."
    }
    elseif ($cookies.Count -eq 1) {
        Write-Info ("Main cookies file detected: " + $cookies[0].FullName)
    }
    else {
        Write-WarnMsg "No cookies.txt file found."
    }
}

function Move-LegacyFiles {
    param([Parameter(Mandatory = $true)][string]$BasePath)

    $archiveRoot = Join-Path $BasePath "archive\legacy"
    Ensure-Directory -Path $archiveRoot

    $patterns = @(
        "download.legacy.js",
        "metadatav1.py",
        "ytdlp_runnerv1.py",
        "ytdlp_runnerv2.py"
    )

    foreach ($pattern in $patterns) {
        $matches = @(Get-ChildItem -LiteralPath $BasePath -Recurse -File -Force -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -ieq $pattern -and -not (Test-IsExcluded -Path $_.FullName)
            })

        foreach ($file in $matches) {
            $target = Join-Path $archiveRoot $file.Name

            if (Test-Path -LiteralPath $target) {
                $target = Join-Path $archiveRoot ($file.BaseName + "_" + (Get-Date -Format "yyyyMMdd_HHmmss") + $file.Extension)
            }

            if ($Apply) {
                Move-Item -LiteralPath $file.FullName -Destination $target -Force
            }

            Write-Info "Move legacy: $($file.FullName) -> $target"
        }
    }
}

function New-TreeReport {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$OutputFile
    )

    function Show-TreeInternal {
        param(
            [Parameter(Mandatory = $true)][string]$Path,
            [string]$Prefix = ""
        )

        $items = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue |
            Where-Object {
                -not (Test-IsExcluded -Path $_.FullName) -and
                $_.Name -ne "__pycache__" -and
                $_.Extension -ne ".pyc"
            } |
            Sort-Object @{ Expression = { -not $_.PSIsContainer } }, Name)

        for ($i = 0; $i -lt $items.Count; $i++) {
            $item = $items[$i]
            $isLast = ($i -eq $items.Count - 1)

            if ($isLast) {
                Add-Content -LiteralPath $OutputFile -Value ($Prefix + "\-- " + $item.Name) -Encoding utf8
                $newPrefix = $Prefix + "    "
            }
            else {
                Add-Content -LiteralPath $OutputFile -Value ($Prefix + "+-- " + $item.Name) -Encoding utf8
                $newPrefix = $Prefix + "|   "
            }

            if ($item.PSIsContainer) {
                Show-TreeInternal -Path $item.FullName -Prefix $newPrefix
            }
        }
    }

    if ($Apply) {
        "ytdlp" | Set-Content -LiteralPath $OutputFile -Encoding utf8
        Show-TreeInternal -Path $BasePath
    }

    Write-Info "Tree report generated: $OutputFile"
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $Root "backups"
$logDir = Join-Path $Root "logs"
$reportDir = Join-Path $Root "reports"
$stagingRoot = Join-Path $env:TEMP ("ytdlp_stage_" + $timestamp)
$logFile = Join-Path $logDir ("reorganizar_" + $timestamp + ".log")

Ensure-Directory -Path $backupDir
Ensure-Directory -Path $logDir
Ensure-Directory -Path $reportDir

try {
    if ($Apply) {
        Start-Transcript -Path $logFile -Force | Out-Null
    }

    Write-Host ""
    Write-Host "==============================" -ForegroundColor Magenta
    Write-Host " Safe ytdlp reorganizer" -ForegroundColor Magenta
    Write-Host "==============================" -ForegroundColor Magenta
    Write-Host ""

    if (-not (Test-Path -LiteralPath $Root)) {
        throw "Root path does not exist: $Root"
    }

    if (-not (Test-Path -LiteralPath $ExcludedNodeModules)) {
        Write-WarnMsg "Excluded node_modules path not found. Backup will continue with current filters."
    }

    if (-not $Apply) {
        Write-WarnMsg "SIMULATION MODE. No changes will be applied."
        Write-WarnMsg "Run with: .\auto.ps1 -Apply"
        Write-Host ""
    }

    $zipPath = $null

    Invoke-Step "Create staging copy excluding node_modules" {
        New-StagingCopy -SourceRoot $Root -StagingRoot $stagingRoot
    }

    Invoke-Step "Create backup ZIP from staging copy" {
        $zipPath = New-BackupZipFromStaging -StagingRoot $stagingRoot -BackupDir $backupDir
    }

    Invoke-Step "Clean python caches" {
        Remove-PythonCaches -BasePath $Root
    }

    Invoke-Step "Normalize duplicated storage folders" {
        Normalize-StorageLayout -BasePath $Root
    }

    Invoke-Step "Review cookies files" {
        Report-CookiesFiles -BasePath $Root
    }

    if ($MoveLegacy) {
        Invoke-Step "Move legacy files" {
            Move-LegacyFiles -BasePath $Root
        }
    }
    else {
        Write-WarnMsg "Legacy files were not moved. Use -MoveLegacy if you really want that."
    }

    $treeFile = Join-Path $reportDir ("estructura_limpia_" + $timestamp + ".txt")
    Invoke-Step "Generate clean tree report" {
        New-TreeReport -BasePath $Root -OutputFile $treeFile
    }

    Write-Host ""
    Write-Ok "Process completed."
    if ($zipPath) {
        Write-Host ("Backup: " + $zipPath) -ForegroundColor Green
    }
    Write-Host ("Report: " + $treeFile) -ForegroundColor Green
    if ($Apply) {
        Write-Host ("Log: " + $logFile) -ForegroundColor Green
    }
}
catch {
    Write-Host ""
    Write-Err ("General failure: " + $_.Exception.Message)
    Write-WarnMsg "Process stopped to avoid unsafe changes."
    exit 1
}
finally {
    try {
        Remove-PathIfExists -Path $stagingRoot
    }
    catch {
        Write-WarnMsg ("Could not remove staging folder: " + $stagingRoot)
    }

    if ($Apply) {
        try { Stop-Transcript | Out-Null } catch {}
    }
}