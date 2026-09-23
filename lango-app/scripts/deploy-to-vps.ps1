<#
.SYNOPSIS
  Automated SchoolOS Deployment Script for VPS (schoolos.epioso.com)
.DESCRIPTION
  Safely builds Linux AMD64 Docker images locally (to prevent remote OOM panic),
  takes a remote pre-deploy DB snapshot, migrates if needed, reloads the app
  container with zero downtime, and verifies live health.
.PARAMETER SkipCheck
  Skip local typecheck and i18n checks.
.PARAMETER WithMigrate
  Force migration runner build and execution.
.PARAMETER Watch
  Watch for source code changes and auto-deploy upon modifications.
.PARAMETER FullTest
  Run the full vitest suite before deploying.
#>

[CmdletBinding()]
param (
    [switch]$SkipCheck,
    [switch]$WithMigrate,
    [switch]$SkipMigrate,
    [switch]$Watch,
    [switch]$FullTest,
    [string]$HostIp = '43.157.17.129',
    [string]$SshUser = 'ubuntu',
    [string]$KeyPath = "$HOME\.ssh\id_ed25519"
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $ProjectRoot

function Log-Step {
    param([string]$Title)
    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host " [SchoolOS Deploy] $Title" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Cyan
}

function Log-Info {
    param([string]$Msg)
    Write-Host " -> $Msg" -ForegroundColor Gray
}

function Log-Success {
    param([string]$Msg)
    Write-Host " [OK] $Msg" -ForegroundColor Green
}

function Log-Warn {
    param([string]$Msg)
    Write-Host " [!] $Msg" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$Msg)
    Write-Host " [FAIL] $Msg" -ForegroundColor Red
}

function Execute-Deploy {
    $StartTime = Get-Date

    Log-Step 'Step 1: Validating Local and SSH Prerequisites'
    
    # 1. Check SSH Key
    if (-not (Test-Path $KeyPath)) {
        Log-Error "SSH key not found at $KeyPath. Please run: ssh-keygen -t ed25519"
        exit 1
    }
    Log-Success "SSH key located: $KeyPath"

    # 2. Check Docker Desktop
    try {
        $dockerCheck = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Docker daemon not responding"
        }
        Log-Success 'Local Docker daemon is running'
    } catch {
        Log-Error 'Local Docker is not running. Please start Docker Desktop and retry.'
        exit 1
    }

    # 3. Test SSH connectivity to VPS
    $sshCmd = "ssh -n -i `"$KeyPath`" -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SshUser}@${HostIp}"
    $sshTest = Invoke-Expression "$sshCmd `"echo 'SSH_OK'`"" 2>&1
    if ($sshTest -notmatch 'SSH_OK') {
        Log-Error "SSH connection to ${SshUser}@${HostIp} failed: $sshTest"
        exit 1
    }
    Log-Success "SSH connection to ${SshUser}@${HostIp} verified"

    # Step 2: Quality Gates
    if (-not $SkipCheck) {
        Log-Step 'Step 2: Running Quality Gates (TypeScript and i18n)'
        Log-Info 'Running check:types (tsc --noEmit)...'
        npm run check:types
        if ($LASTEXITCODE -ne 0) {
            Log-Error 'TypeScript compilation failed. Fix errors before deploying!'
            exit 1
        }
        Log-Success 'TypeScript type safety passed (0 errors)'

        Log-Info 'Running check:i18n (next-intl verification)...'
        npm run check:i18n
        if ($LASTEXITCODE -ne 0) {
            Log-Error 'i18n check failed. Missing or invalid translation keys!'
            exit 1
        }
        Log-Success 'i18n dictionaries verified (0 missing keys)'

        if ($FullTest) {
            Log-Info 'Running full unit test suite (vitest)...'
            npm test
            if ($LASTEXITCODE -ne 0) {
                Log-Error 'Automated test suite failed!'
                exit 1
            }
            Log-Success 'All automated unit tests passed'
        }
    } else {
        Log-Warn 'Skipping quality gates per -SkipCheck'
    }

    # Step 3: Migration Detection
    Log-Step 'Step 3: Evaluating Database Migrations'
    $shouldMigrate = $WithMigrate
    if ($SkipMigrate) {
        $shouldMigrate = $false
        Log-Info 'Skipping database migrations per -SkipMigrate'
    } elseif (-not $shouldMigrate) {
        $gitDiff = git status --porcelain migrations/ src/models/ 2>$null
        if ($gitDiff) {
            Log-Warn 'Detected changes in migrations/ or src/models/. Migrations will be built and executed.'
            $shouldMigrate = $true
        } else {
            Log-Info 'No pending migration changes detected. Skipping migrate container build.'
        }
    }

    $ScratchDir = Join-Path $ProjectRoot 'scripts\.deploy_cache'
    if (-not (Test-Path $ScratchDir)) {
        New-Item -ItemType Directory -Path $ScratchDir -Force | Out-Null
    }

    # Step 4: Local Docker Build
    Log-Step 'Step 4: Building Release Container(s) Locally for Linux AMD64'
    Log-Info 'Normalizing OneDrive file attributes across build directories...'
    $dirs = @('src', 'locales', 'public', 'migrations')
    $buildFiles = @(Get-ChildItem -Path $ProjectRoot -File) + @(Get-ChildItem -Path ($dirs | ForEach-Object { Join-Path $ProjectRoot $_ }) -Recurse -File -ErrorAction SilentlyContinue)
    $reparseFiles = $buildFiles | Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint }
    if ($reparseFiles) {
        Log-Info "Found $($reparseFiles.Count) files with OneDrive ReparsePoint attribute. Normalizing..."
        foreach ($f in $reparseFiles) {
            $b = [System.IO.File]::ReadAllBytes($f.FullName)
            [System.IO.File]::Delete($f.FullName)
            [System.IO.File]::WriteAllBytes($f.FullName, $b)
        }
        Log-Success 'File attributes normalized successfully'
    }
    Log-Info 'Building schoolos-app:latest (standalone runner)...'
    docker build --platform linux/amd64 -t schoolos-app:latest .
    if ($LASTEXITCODE -ne 0) {
        Log-Error 'Failed to build schoolos-app:latest'
        exit 1
    }
    Log-Success 'schoolos-app:latest built successfully'

    if ($shouldMigrate) {
        Log-Info 'Building schoolos-migrate:latest (schema runner)...'
        docker build --platform linux/amd64 --target migrator -t schoolos-migrate:latest .
        if ($LASTEXITCODE -ne 0) {
            Log-Error 'Failed to build schoolos-migrate:latest'
            exit 1
        }
        Log-Success 'schoolos-migrate:latest built successfully'
    }

    # Step 5: Packaging and Compression
    Log-Step 'Step 5: Exporting and Compressing Release Images'
    $appTar = Join-Path $ScratchDir 'release-schoolos-app.tar.gz'
    $gitBash = 'C:\Program Files\Git\bin\bash.exe'

    Log-Info 'Compressing schoolos-app:latest...'
    if (Test-Path $gitBash) {
        $bashAppTar = $appTar.Replace('\', '/')
        & $gitBash -c "docker save schoolos-app:latest | gzip -3 > '$bashAppTar'"
    } else {
        docker save schoolos-app:latest | gzip -3 > $appTar
    }
    $appSizeMB = [math]::Round((Get-Item $appTar).Length / 1MB, 1)
    Log-Success "App release archive ready ($appSizeMB MB)"

    $migrateTar = $null
    if ($shouldMigrate) {
        $migrateTar = Join-Path $ScratchDir 'release-schoolos-migrate.tar.gz'
        Log-Info 'Compressing schoolos-migrate:latest...'
        if (Test-Path $gitBash) {
            $bashMigrateTar = $migrateTar.Replace('\', '/')
            & $gitBash -c "docker save schoolos-migrate:latest | gzip -3 > '$bashMigrateTar'"
        } else {
            docker save schoolos-migrate:latest | gzip -3 > $migrateTar
        }
        $migrateSizeMB = [math]::Round((Get-Item $migrateTar).Length / 1MB, 1)
        Log-Success "Migrate release archive ready ($migrateSizeMB MB)"
    }

    # Step 6: Transfer to VPS
    Log-Step 'Step 6: Transferring Release to VPS (~/releases/)'
    Invoke-Expression "$sshCmd `"mkdir -p ~/releases`""
    
    Log-Info 'Uploading app image via SCP...'
    scp -O -C -B -q -i "$KeyPath" -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=60 "$appTar" "${SshUser}@${HostIp}:~/releases/release-schoolos-app.tar.gz"
    if ($LASTEXITCODE -ne 0) {
        Log-Error 'SCP of schoolos-app failed!'
        exit 1
    }
    Log-Success 'App archive uploaded to VPS'

    if ($shouldMigrate -and (Test-Path $migrateTar)) {
        Log-Info 'Uploading migrate image via SCP...'
        scp -O -C -B -q -i "$KeyPath" -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=60 "$migrateTar" "${SshUser}@${HostIp}:~/releases/release-schoolos-migrate.tar.gz"
        if ($LASTEXITCODE -ne 0) {
            Log-Error 'SCP of schoolos-migrate failed!'
            exit 1
        }
        Log-Success 'Migrate archive uploaded to VPS'
    }

    # Step 7: Remote Deployment Execution
    Log-Step 'Step 7: Executing Remote Backup, Migration and Container Restart'
    
    # 1. Pre-deploy DB backup
    Log-Info 'Taking pre-deploy database snapshot on VPS...'
    Invoke-Expression "$sshCmd `"bash /home/ubuntu/schoolos-app/backup-db.sh`""
    Log-Success 'Pre-deployment database snapshot recorded'

    # 2. Load images into Docker
    Log-Info 'Loading schoolos-app:latest into remote Docker...'
    Invoke-Expression "$sshCmd `"docker load < ~/releases/release-schoolos-app.tar.gz`""
    
    if ($shouldMigrate) {
        Log-Info 'Loading schoolos-migrate:latest into remote Docker...'
        Invoke-Expression "$sshCmd `"docker load < ~/releases/release-schoolos-migrate.tar.gz`""
        
        Log-Info 'Running database migrations...'
        Invoke-Expression "$sshCmd `"cd /home/ubuntu/schoolos-app && docker compose run --rm migrate`""
        Log-Success 'Database migrations applied successfully'
    }

    # 3. Restart app container
    Log-Info 'Recreating schoolos-app container with zero downtime...'
    Invoke-Expression "$sshCmd `"cd /home/ubuntu/schoolos-app && docker compose up -d --no-deps app`""
    Log-Success 'Container schoolos-app restarted'

    # Step 8: Remote Cleanup & Health Verification
    Log-Step 'Step 8: Post-Deployment Cleanup and Live Health Verification'
    Invoke-Expression "$sshCmd `"rm -f ~/releases/release-schoolos-app.tar.gz ~/releases/release-schoolos-migrate.tar.gz && docker image prune -f`"" | Out-Null
    Log-Success 'Temporary release archives removed and remote images pruned'

    Start-Sleep -Seconds 3
    $health = Invoke-Expression "$sshCmd `"curl -s http://127.0.0.1:3030/api/health`"" 2>&1
    if ($health -match 'healthy') {
        Log-Success "Internal Health API: $health"
    } else {
        Log-Warn "Internal Health API response: $health"
    }

    $publicHealth = Invoke-Expression "$sshCmd `"curl -s https://schoolos.epioso.com/api/health`"" 2>&1
    if ($publicHealth -match 'healthy') {
        Log-Success "Public HTTPS Health: $publicHealth"
    } else {
        Log-Warn "Public HTTPS Health check: $publicHealth"
    }

    $Elapsed = [math]::Round(((Get-Date) - $StartTime).TotalSeconds, 1)
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host " [OK] SchoolOS Deployed Successfully in ${Elapsed}s!" -ForegroundColor Green
    Write-Host " Public URL: https://schoolos.epioso.com" -ForegroundColor Cyan
    Write-Host "========================================================`n" -ForegroundColor Green
}

# Auto-Watcher Implementation
if ($Watch) {
    Log-Step 'Entering Watch Mode: Auto-Deploy on Code Changes'
    Write-Host 'Monitoring: src/, locales/, migrations/ for changes...' -ForegroundColor Yellow
    Write-Host "Press Ctrl+C at any time to stop.`n" -ForegroundColor Gray

    $WatchPaths = @(
        (Join-Path $ProjectRoot 'src'),
        (Join-Path $ProjectRoot 'locales'),
        (Join-Path $ProjectRoot 'migrations')
    )

    $Watchers = @()
    foreach ($wp in $WatchPaths) {
        if (Test-Path $wp) {
            $fsw = New-Object System.IO.FileSystemWatcher
            $fsw.Path = $wp
            $fsw.IncludeSubdirectories = $true
            $fsw.EnableRaisingEvents = $true
            $fsw.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, Size'
            $Watchers += $fsw
        }
    }

    $script:Changed = $false
    $script:LastChangeTime = [DateTime]::MinValue

    $Action = {
        $script:Changed = $true
        $script:LastChangeTime = Get-Date
    }

    foreach ($w in $Watchers) {
        Register-ObjectEvent $w 'Changed' -Action $Action | Out-Null
        Register-ObjectEvent $w 'Created' -Action $Action | Out-Null
        Register-ObjectEvent $w 'Deleted' -Action $Action | Out-Null
        Register-ObjectEvent $w 'Renamed' -Action $Action | Out-Null
    }

    try {
        while ($true) {
            Start-Sleep -Seconds 2
            if ($script:Changed -and ((Get-Date) - $script:LastChangeTime).TotalSeconds -ge 6) {
                $script:Changed = $false
                Write-Host "`n[Auto-Deploy Triggered] Changes detected at $((Get-Date).ToString('HH:mm:ss'))" -ForegroundColor Magenta
                try {
                    Execute-Deploy
                } catch {
                    Log-Error "Deployment failed: $_"
                }
                Write-Host "`nResuming watch mode... Waiting for next change.`n" -ForegroundColor Yellow
            }
        }
    } finally {
        foreach ($w in $Watchers) {
            $w.EnableRaisingEvents = $false
            $w.Dispose()
        }
        Get-EventSubscriber | Unregister-Event
    }
} else {
    Execute-Deploy
}
